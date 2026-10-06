const crypto = require("crypto");
const supabase = require("../supabaseClient");

// Idiomas de destino aceitos (o texto de origem sempre é português).
const IDIOMAS = ["en", "es"];

const MAX_TEXTOS = 40; // por requisição
const MAX_CARACTERES = 2000; // por texto

const hash = (texto) => crypto.createHash("sha1").update(texto).digest("hex");

const erro = (mensagem, status = 400) => {
  const err = new Error(mensagem);
  err.status = status;
  return err;
};

// ---------------------------------------------------------------------
// PROVEDORES DE TRADUÇÃO
// 1) Google Cloud Translation (oficial) — usado se GOOGLE_TRANSLATE_API_KEY
//    estiver definida no .env / Render. Recomendado em produção.
// 2) MyMemory (gratuito, sem chave, com limite diário) — usado como
//    alternativa. Defina MYMEMORY_EMAIL pra aumentar o limite diário.
// ---------------------------------------------------------------------
async function traduzirComGoogle(textos, alvo) {
  const resp = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: textos,
        source: "pt",
        target: alvo,
        format: "text",
      }),
    },
  );
  if (!resp.ok) {
    throw new Error(`Google Translate respondeu ${resp.status}`);
  }
  const dados = await resp.json();
  return dados.data.translations.map((t) => t.translatedText);
}

const decodificarEntidades = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// MyMemory aceita no máximo ~500 caracteres por consulta
function dividirEmPartes(texto, max = 450) {
  if (texto.length <= max) return [texto];
  const frases = texto.split(/(?<=[.!?])\s+/);
  const partes = [];
  let atual = "";
  for (const frase of frases) {
    if ((atual + " " + frase).trim().length > max && atual) {
      partes.push(atual);
      atual = frase;
    } else {
      atual = (atual + " " + frase).trim();
    }
    while (atual.length > max) {
      partes.push(atual.slice(0, max));
      atual = atual.slice(max);
    }
  }
  if (atual) partes.push(atual);
  return partes;
}

async function traduzirParteMyMemory(parte, alvo) {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", parte);
  url.searchParams.set("langpair", `pt|${alvo}`);
  if (process.env.MYMEMORY_EMAIL)
    url.searchParams.set("de", process.env.MYMEMORY_EMAIL);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`MyMemory respondeu ${resp.status}`);
  const dados = await resp.json();
  const traduzido = dados?.responseData?.translatedText;

  if (
    !traduzido ||
    Number(dados.responseStatus) !== 200 ||
    /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(traduzido)
  ) {
    throw new Error("MyMemory indisponível ou limite diário atingido");
  }
  return decodificarEntidades(traduzido);
}

async function traduzirComMyMemory(textos, alvo) {
  const resultados = [];
  for (const texto of textos) {
    const partes = dividirEmPartes(texto);
    const traduzidas = [];
    for (const parte of partes) {
      traduzidas.push(await traduzirParteMyMemory(parte, alvo));
    }
    resultados.push(traduzidas.join(" "));
  }
  return resultados;
}

// Traduz uma lista; devolve array com o texto traduzido ou null (falhou)
async function traduzirNoProvedor(textos, alvo) {
  try {
    if (process.env.GOOGLE_TRANSLATE_API_KEY) {
      return await traduzirComGoogle(textos, alvo);
    }
  } catch (e) {
    console.error("[traducoes] Google falhou:", e.message);
  }

  // MyMemory: um por vez, falha de um texto não derruba os outros
  const saida = [];
  for (const texto of textos) {
    try {
      const [t] = await traduzirComMyMemory([texto], alvo);
      saida.push(t);
    } catch (e) {
      console.error("[traducoes] MyMemory falhou:", e.message);
      saida.push(null);
    }
  }
  return saida;
}

// ---------------------------------------------------------------------
// SERVIÇO
// ---------------------------------------------------------------------
class TraducoesService {
  /**
   * @param {string} idioma  "en" | "es"
   * @param {string[]} textos  textos em português
   * @returns {Promise<Record<string,string>>}  { original: traduzido }
   *   Textos que não puderam ser traduzidos ficam de fora do resultado.
   */
  async traduzir(idioma, textos) {
    if (!IDIOMAS.includes(idioma)) {
      throw erro('Idioma inválido. Use "en" ou "es".');
    }
    if (!Array.isArray(textos) || textos.length === 0) {
      throw erro("Envie uma lista de textos em 'textos'.");
    }

    const unicos = [
      ...new Set(
        textos
          .filter((t) => typeof t === "string")
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && t.length <= MAX_CARACTERES),
      ),
    ];

    if (unicos.length === 0) return {};
    if (unicos.length > MAX_TEXTOS) {
      throw erro(`Máximo de ${MAX_TEXTOS} textos por requisição.`);
    }

    const resultado = {};

    // 1. Cache (Supabase) — cada texto só é traduzido uma vez
    const hashes = unicos.map(hash);
    try {
      const { data, error } = await supabase
        .from("traducoes_cache")
        .select("texto_hash, texto_traduzido")
        .eq("idioma", idioma)
        .in("texto_hash", hashes);

      if (error) throw error;
      const porHash = new Map(
        (data || []).map((r) => [r.texto_hash, r.texto_traduzido]),
      );
      unicos.forEach((t, i) => {
        if (porHash.has(hashes[i])) resultado[t] = porHash.get(hashes[i]);
      });
    } catch (e) {
      // sem tabela de cache o sistema continua funcionando, só sem cache
      console.error("[traducoes] Falha ao ler cache:", e.message);
    }

    // 2. O que faltou vai pro provedor
    const faltando = unicos.filter((t) => resultado[t] === undefined);
    if (faltando.length > 0) {
      const traduzidos = await traduzirNoProvedor(faltando, idioma);
      const novos = [];

      faltando.forEach((original, i) => {
        const traduzido = traduzidos[i];
        if (typeof traduzido === "string" && traduzido.trim() !== "") {
          resultado[original] = traduzido;
          novos.push({
            texto_hash: hash(original),
            idioma,
            texto_original: original,
            texto_traduzido: traduzido,
          });
        }
      });

      // 3. Guarda no cache
      if (novos.length > 0) {
        try {
          const { error } = await supabase
            .from("traducoes_cache")
            .upsert(novos, { onConflict: "texto_hash,idioma" });
          if (error) throw error;
        } catch (e) {
          console.error("[traducoes] Falha ao gravar cache:", e.message);
        }
      }
    }

    return resultado;
  }
}

module.exports = new TraducoesService();
