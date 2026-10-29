const bcrypt = require("bcrypt");
const crypto = require("crypto");
const supabase = require("../supabaseClient");
const emailService = require("./Email.service");

// Tabela "redefinicao_senha": id, id_cliente, codigo_hash, expira_em,
// tentativas, criado_em (ver redefinicao_senha.sql).
const TABELA = "redefinicao_senha";

const VALIDADE_MIN = 15; // minutos de validade do código
const MAX_TENTATIVAS = 5; // erros permitidos por código
const INTERVALO_REENVIO_S = 60; // espera mínima entre dois códigos
const SENHA_MIN = 6;
const SENHA_MAX = 72; // limite do bcrypt

const erro = (mensagem, status = 400) => {
  const err = new Error(mensagem);
  err.status = status;
  return err;
};

const CODIGO_INVALIDO = () =>
  erro("Código inválido ou expirado. Solicite um novo código.", 400);

const normalizarEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ilike trata % e _ como curingas — escapa, senão "a_b@x.com" casaria
// com "axb@x.com" e o código poderia ir pra pessoa errada.
const escaparLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// O código nunca é guardado em texto puro: só o HMAC dele (amarrado ao
// cliente), com um segredo do servidor.
const SEGREDO = () =>
  process.env.RESET_SECRET || process.env.SUPABASE_KEY || "immersia-reset";

const hashDoCodigo = (idCliente, codigo) =>
  crypto
    .createHmac("sha256", SEGREDO())
    .update(`${idCliente}:${codigo}`)
    .digest("hex");

const iguais = (a, b) => {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

const mascarar = (email) => {
  const [u, d] = String(email).split("@");
  return d ? `${u.slice(0, 2)}***@${d}` : "***";
};

class RecuperacaoSenhaService {
  async buscarCliente(email) {
    const { data, error } = await supabase
      .from("registro_cliente")
      .select("id, email, nome_completo")
      .ilike("email", escaparLike(email))
      .limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  }

  async apagarCodigos(idCliente) {
    const { error } = await supabase
      .from(TABELA)
      .delete()
      .eq("id_cliente", idCliente);
    if (error) throw error;
  }

  // 1) Gera um código de 6 dígitos e envia por e-mail.
  // A resposta é a mesma exista o e-mail ou não (não revela quem tem conta).
  async solicitar({ email: emailBruto, idioma }) {
    const email = normalizarEmail(emailBruto);
    if (!emailValido(email)) throw erro("Informe um e-mail válido.");

    const cliente = await this.buscarCliente(email);
    if (!cliente) {
      console.log(
        `[recuperar-senha] e-mail não cadastrado: ${mascarar(email)}`,
      );
      return { ok: true };
    }

    // Evita spam de e-mails: respeita o intervalo mínimo entre códigos
    const { data: ultimos, error: ultimoError } = await supabase
      .from(TABELA)
      .select("criado_em")
      .eq("id_cliente", cliente.id)
      .order("criado_em", { ascending: false })
      .limit(1);
    if (ultimoError) throw ultimoError;
    if (ultimos && ultimos.length > 0) {
      const segundos =
        (Date.now() - new Date(ultimos[0].criado_em).getTime()) / 1000;
      if (segundos < INTERVALO_REENVIO_S) return { ok: true };
    }

    const logarCodigo = process.env.RESET_LOG_CODE === "true";
    if (!emailService.configurado() && !logarCodigo) {
      console.error(
        "[recuperar-senha] Envio de e-mail NÃO configurado (defina BREVO_API_KEY ou RESEND_API_KEY + EMAIL_FROM).",
      );
      throw erro(
        "O envio de e-mail ainda não está configurado no servidor.",
        503,
      );
    }

    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, "0");

    await this.apagarCodigos(cliente.id); // só o código mais recente vale
    const { error: insertError } = await supabase.from(TABELA).insert({
      id_cliente: cliente.id,
      codigo_hash: hashDoCodigo(cliente.id, codigo),
      expira_em: new Date(Date.now() + VALIDADE_MIN * 60 * 1000).toISOString(),
      tentativas: 0,
    });
    if (insertError) throw insertError;

    if (!emailService.configurado()) {
      // Só para testes (RESET_LOG_CODE=true): mostra o código no log do servidor
      console.warn(
        `[recuperar-senha] (TESTE) código de ${mascarar(email)}: ${codigo}`,
      );
      return { ok: true };
    }

    try {
      await emailService.enviarCodigoRedefinicao({
        para: cliente.email,
        nome: (cliente.nome_completo || "").split(" ")[0],
        codigo,
        idioma,
        validadeMin: VALIDADE_MIN,
      });
      console.log(`[recuperar-senha] código enviado para ${mascarar(email)}`);
    } catch (e) {
      console.error("[recuperar-senha] falha ao enviar e-mail:", e.message);
      await this.apagarCodigos(cliente.id).catch(() => {});
      throw erro(
        "Não foi possível enviar o e-mail de recuperação. Tente novamente em instantes.",
        502,
      );
    }

    return { ok: true };
  }

  // Confere e-mail + código. Erra de forma genérica (não diz se o e-mail
  // existe) e bloqueia o código depois de MAX_TENTATIVAS erros.
  async conferirCodigo(emailBruto, codigoBruto) {
    const email = normalizarEmail(emailBruto);
    const codigo = String(codigoBruto ?? "").trim();
    if (!emailValido(email) || !/^\d{6}$/.test(codigo)) throw CODIGO_INVALIDO();

    const cliente = await this.buscarCliente(email);
    if (!cliente) throw CODIGO_INVALIDO();

    const { data: linhas, error } = await supabase
      .from(TABELA)
      .select("*")
      .eq("id_cliente", cliente.id)
      .order("criado_em", { ascending: false })
      .limit(1);
    if (error) throw error;
    const linha = linhas && linhas[0];
    if (!linha) throw CODIGO_INVALIDO();

    if (new Date(linha.expira_em).getTime() < Date.now()) {
      await this.apagarCodigos(cliente.id);
      throw CODIGO_INVALIDO();
    }

    if (Number(linha.tentativas) >= MAX_TENTATIVAS) {
      await this.apagarCodigos(cliente.id);
      throw erro("Muitas tentativas. Solicite um novo código.", 429);
    }

    if (!iguais(hashDoCodigo(cliente.id, codigo), linha.codigo_hash)) {
      const tentativas = Number(linha.tentativas) + 1;
      if (tentativas >= MAX_TENTATIVAS) {
        await this.apagarCodigos(cliente.id);
      } else {
        const { error: updError } = await supabase
          .from(TABELA)
          .update({ tentativas })
          .eq("id", linha.id);
        if (updError) throw updError;
      }
      throw CODIGO_INVALIDO();
    }

    return cliente;
  }

  // 2) Só confere o código (a tela avança pro passo da nova senha)
  async verificar({ email, codigo }) {
    await this.conferirCodigo(email, codigo);
    return { valido: true };
  }

  // 3) Confere o código de novo e troca a senha
  async redefinir({ email, codigo, nova_senha }) {
    if (
      typeof nova_senha !== "string" ||
      nova_senha.length < SENHA_MIN ||
      nova_senha.length > SENHA_MAX
    ) {
      throw erro(
        `A nova senha deve ter entre ${SENHA_MIN} e ${SENHA_MAX} caracteres.`,
      );
    }

    const cliente = await this.conferirCodigo(email, codigo);

    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(nova_senha, salt);

    const { error } = await supabase
      .from("registro_cliente")
      .update({ senha_hash })
      .eq("id", cliente.id);
    if (error) throw error;

    await this.apagarCodigos(cliente.id); // o código só vale uma vez
    console.log(`[recuperar-senha] senha redefinida | id=${cliente.id}`);

    return { message: "Senha redefinida com sucesso." };
  }
}

module.exports = new RecuperacaoSenhaService();
