const supabase = require("../supabaseClient");

// ⚠️ Ajuste os nomes das tabelas ('produtos', 'registro_cliente') e da coluna
// de relação ('cliente') para os nomes reais que você usa no Supabase.
// No Prisma o model era RegistroCliente/Produto — no Postgres/Supabase o
// nome da tabela costuma estar em snake_case, então confira no seu schema.

class ProdutosService {
  async create(createProdutoDto) {
    // Verifica se o usuário existe (equivalente ao findUnique do Prisma)
    const { data: usuario, error: usuarioError } = await supabase
      .from("registro_cliente")
      .select("*")
      .eq("id", createProdutoDto.id_cliente_produto)
      .maybeSingle();

    if (usuarioError) {
      throw usuarioError;
    }

    if (!usuario) {
      const err = new Error("Usuário não encontrado para vincular ao produto.");
      err.status = 404;
      throw err;
    }

    // Cria o produto
    const { data: produto, error: produtoError } = await supabase
      .from("produtos")
      .insert({
        nome: createProdutoDto.nome,
        descricao: createProdutoDto.descricao,
        preco: createProdutoDto.preco,
        categoria: createProdutoDto.categoria || "geral",
        imagem_url: createProdutoDto.imagem_url,
        quantidade_estoque: createProdutoDto.quantidade_estoque || 0,
        tipo_produto: createProdutoDto.tipo_produto,
        localizacao: createProdutoDto.localizacao,
        duracao: createProdutoDto.duracao,
        inclui: createProdutoDto.inclui,
        nao_inclui: createProdutoDto.nao_inclui,
        id_cliente_produto: createProdutoDto.id_cliente_produto,
      })
      .select()
      .single();

    if (produtoError) {
      throw produtoError;
    }

    return produto;
  }

  async findAll() {
    const { data, error } = await supabase.from("produtos").select("*"); // sem o join, só pra testar

    if (error) throw error;
    return data;
  }

  async findOne(id) {
    const { data: produto, error } = await supabase
      .from("produtos")
      .select("*, cliente:registro_cliente(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!produto) {
      const err = new Error("Produto não encontrado.");
      err.status = 404;
      throw err;
    }

    return produto;
  }

  async findMinhasHospedagens(idCliente) {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("id_cliente_produto", idCliente)
      .eq("tipo_produto", "hospedagem")
      .order("data_criacao", { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async remove(id) {
    const { data, error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      const err = new Error("Produto não encontrado.");
      err.status = 404;
      throw err;
    }

    return data;
  }
}

module.exports = new ProdutosService();
