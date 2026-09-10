const supabase = require("../supabaseClient");

// ⚠️ Ajuste os nomes das tabelas ('carrinho', 'produtos') caso sejam
// diferentes no seu banco Supabase.

class CarrinhoService {
  async adicionar({ id_cliente, id_produto, quantidade }) {
    if (!id_cliente || !id_produto) {
      const err = new Error("id_cliente e id_produto são obrigatórios.");
      err.status = 400;
      throw err;
    }

    const quantidadeAdicionar = Number(quantidade) || 1;
    if (quantidadeAdicionar <= 0) {
      const err = new Error("quantidade deve ser maior que zero.");
      err.status = 400;
      throw err;
    }

    // 1. Confere se o produto existe e se tem estoque
    const { data: produto, error: produtoError } = await supabase
      .from("produtos")
      .select("id, quantidade_estoque")
      .eq("id", id_produto)
      .maybeSingle();

    if (produtoError) throw produtoError;
    if (!produto) {
      const err = new Error("Produto não encontrado.");
      err.status = 404;
      throw err;
    }

    // 2. Verifica se o item já está no carrinho desse cliente
    const { data: itemExistente, error: itemError } = await supabase
      .from("carrinho")
      .select("id, quantidade")
      .eq("id_cliente", id_cliente)
      .eq("id_produto", id_produto)
      .maybeSingle();

    if (itemError) throw itemError;

    const quantidadeFinal =
      (itemExistente?.quantidade || 0) + quantidadeAdicionar;

    if (
      produto.quantidade_estoque !== null &&
      produto.quantidade_estoque !== undefined &&
      quantidadeFinal > produto.quantidade_estoque
    ) {
      const err = new Error(
        "Quantidade solicitada maior que o estoque disponível.",
      );
      err.status = 409; // Conflict
      err.details = `Estoque disponível: ${produto.quantidade_estoque}`;
      throw err;
    }

    // 3. Já existe -> soma a quantidade. Não existe -> cria o item.
    if (itemExistente) {
      const { data: item, error } = await supabase
        .from("carrinho")
        .update({ quantidade: quantidadeFinal })
        .eq("id", itemExistente.id)
        .select()
        .single();

      if (error) throw error;
      return item;
    }

    const { data: item, error } = await supabase
      .from("carrinho")
      .insert({ id_cliente, id_produto, quantidade: quantidadeAdicionar })
      .select()
      .single();

    if (error) throw error;
    return item;
  }

  async findAllByCliente(id_cliente) {
    const { data: itens, error } = await supabase
      .from("carrinho")
      .select(
        `
        id,
        quantidade,
        data_criacao,
        data_atualizacao,
        produtos (
          id,
          nome,
          descricao,
          preco,
          imagem_url,
          quantidade_estoque,
          status
        )
      `,
      )
      .eq("id_cliente", id_cliente)
      .order("data_criacao", { ascending: false });

    if (error) throw error;

    const itensComTotal = itens.map((item) => ({
      ...item,
      preco_total: item.quantidade * (item.produtos?.preco || 0),
    }));

    const total = itensComTotal.reduce(
      (soma, item) => soma + item.preco_total,
      0,
    );

    return { itens: itensComTotal, total };
  }

  async updateQuantidade(id, quantidade) {
    const quantidadeNova = Number(quantidade);

    if (!quantidadeNova || quantidadeNova <= 0) {
      const err = new Error("quantidade deve ser maior que zero.");
      err.status = 400;
      throw err;
    }

    const { data: item, error } = await supabase
      .from("carrinho")
      .update({ quantidade: quantidadeNova })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!item) {
      const err = new Error("Item do carrinho não encontrado.");
      err.status = 404;
      throw err;
    }

    return item;
  }

  async remove(id) {
    const { data: item, error } = await supabase
      .from("carrinho")
      .delete()
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!item) {
      const err = new Error("Item do carrinho não encontrado.");
      err.status = 404;
      throw err;
    }

    return item;
  }
}

module.exports = new CarrinhoService();
