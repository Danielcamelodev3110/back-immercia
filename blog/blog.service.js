const supabase = require("../supabaseClient");

// Tabela "posts_blog": titulo, subtitulo, destino, categoria, conteudo,
// imagem_capa, id_autor, publicado, data_publicacao, data_atualizacao.

class BlogService {
  async create(createPostDto) {
    const {
      titulo,
      subtitulo,
      destino,
      categoria,
      conteudo,
      imagem_capa,
      imagens,
      id_autor,
    } = createPostDto;

    // Aceita só strings não vazias; se não vier nada, vira array vazio.
    const imagensLimpas = Array.isArray(imagens)
      ? imagens
          .filter((url) => typeof url === "string" && url.trim() !== "")
          .map((url) => url.trim())
      : [];

    if (!titulo || !conteudo) {
      const err = new Error("titulo e conteudo são obrigatórios.");
      err.status = 400;
      throw err;
    }
    if (!id_autor) {
      const err = new Error("id_autor é obrigatório.");
      err.status = 400;
      throw err;
    }

    // ⚠️ Confere se quem está postando é administrador, olhando o
    // tipo_usuario de verdade na tabela — não confia em nada que o app
    // mande além do id. IMPORTANTE: como esse backend ainda não tem
    // autenticação por token (qualquer chamada manda o id_autor que
    // quiser), isso impede o uso normal do app por quem não é admin,
    // mas não protege contra alguém chamando a API direto com o id de
    // outra pessoa. Quando o login tiver token/JWT de verdade, essa
    // checagem deve vir do token decodificado, não de um campo do body.
    const { data: autor, error: autorError } = await supabase
      .from("registro_cliente")
      .select("id, tipo_usuario")
      .eq("id", id_autor)
      .maybeSingle();

    if (autorError) throw autorError;
    if (!autor) {
      const err = new Error("Usuário não encontrado.");
      err.status = 404;
      throw err;
    }
    if (autor.tipo_usuario !== "administrador") {
      const err = new Error("Só administradores podem publicar no blog.");
      err.status = 403;
      throw err;
    }

    const { data: post, error } = await supabase
      .from("posts_blog")
      .insert({
        titulo,
        subtitulo: subtitulo || null,
        destino: destino || null,
        categoria: categoria || "Destino",
        conteudo,
        imagem_capa: imagem_capa || null,
        id_autor,
        publicado: true,
      })
      .select()
      .single();

    if (error) throw error;
    return post;
  }

  // Lista as postagens publicadas, mais recentes primeiro — é isso que
  // a tela de blog consome.
  async findAll() {
    const { data, error } = await supabase
      .from("posts_blog")
      .select("*, autor:registro_cliente(nome_completo)")
      .eq("publicado", true)
      .order("data_publicacao", { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOne(id) {
    const { data, error } = await supabase
      .from("posts_blog")
      .select("*, autor:registro_cliente(nome_completo)")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const err = new Error("Postagem não encontrada.");
      err.status = 404;
      throw err;
    }
    return data;
  }
}

module.exports = new BlogService();
