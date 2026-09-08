const supabase = require("../supabaseClient");

// ⚠️ Ajuste os nomes das tabelas ('carrinho', 'produtos') caso sejam
// diferentes no seu banco Supabase.

class CarrinhoService {
  async adicionar({
    id_cliente,
    id_produto,
    quantidade,
    data_checkin,
    data_checkout,
  }) {
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

    // 1. Confere se o produto existe, se tem estoque e qual o tipo dele
    const { data: produto, error: produtoError } = await supabase
      .from("produtos")
      .select("id, quantidade_estoque, tipo_produto")
      .eq("id", id_produto)
      .maybeSingle();

    if (produtoError) throw produtoError;
    if (!produto) {
      const err = new Error("Produto não encontrado.");
      err.status = 404;
      throw err;
    }

    const ehHospedagem = produto.tipo_produto === "hospedagem";

    // ⚠️ Hospedagem exige período (check-in/check-out). Outros tipos de
    // produto (ex: "experiencia") não usam essas datas.
    if (ehHospedagem) {
      if (!data_checkin || !data_checkout) {
        const err = new Error(
          "data_checkin e data_checkout são obrigatórios para hospedagem.",
        );
        err.status = 400;
        throw err;
      }

      if (new Date(data_checkout) <= new Date(data_checkin)) {
        const err = new Error("data_checkout deve ser depois da data_checkin.");
        err.status = 400;
        throw err;
      }
    }

    // 2. Verifica se já existe um item igual no carrinho desse cliente.
    // ⚠️ Pra hospedagem, "igual" significa mesmo produto E MESMO PERÍODO —
    // duas reservas diferentes do mesmo imóvel são itens separados no
    // carrinho, não devem ter a quantidade somada entre si.
    let queryItemExistente = supabase
      .from("carrinho")
      .select("id, quantidade")
      .eq("id_cliente", id_cliente)
      .eq("id_produto", id_produto);

    queryItemExistente = ehHospedagem
      ? queryItemExistente
          .eq("data_checkin", data_checkin)
          .eq("data_checkout", data_checkout)
      : queryItemExistente.is("data_checkin", null).is("data_checkout", null);

    const { data: itemExistente, error: itemError } =
      await queryItemExistente.maybeSingle();

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

    // 3. Já existe (mesmo produto + mesmo período) -> soma a quantidade.
    //    Não existe -> cria um item novo no carrinho.
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
      .insert({
        id_cliente,
        id_produto,
        quantidade: quantidadeAdicionar,
        data_checkin: data_checkin || null,
        data_checkout: data_checkout || null,
      })
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
        data_checkin,
        data_checkout,
        data_criacao,
        data_atualizacao,
        produtos (
          id,
          nome,
          descricao,
          preco,
          imagem_url,
          quantidade_estoque,
          status,
          tipo_produto
        )
      `,
      )
      .eq("id_cliente", id_cliente)
      .order("data_criacao", { ascending: false });

    if (error) throw error;

    // preco_total já é proporcional: quantidade representa "diárias/noites"
    // pra hospedagem, então preco (diária) * quantidade dá o total do período.
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

  async updateQuantidade(id, quantidade, data_checkin, data_checkout) {
    const quantidadeNova = Number(quantidade);

    if (!quantidadeNova || quantidadeNova <= 0) {
      const err = new Error("quantidade deve ser maior que zero.");
      err.status = 400;
      throw err;
    }

    const dadosAtualizacao = { quantidade: quantidadeNova };

    // 👇 Opcional: permite reajustar o período junto da quantidade
    // (ex: usuário mudou a data de check-in na tela do carrinho).
    // Só aplica se os dois vierem preenchidos, pra não gravar um período
    // pela metade.
    if (data_checkin && data_checkout) {
      if (new Date(data_checkout) <= new Date(data_checkin)) {
        const err = new Error("data_checkout deve ser depois da data_checkin.");
        err.status = 400;
        throw err;
      }
      dadosAtualizacao.data_checkin = data_checkin;
      dadosAtualizacao.data_checkout = data_checkout;
    }

    const { data: item, error } = await supabase
      .from("carrinho")
      .update(dadosAtualizacao)
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
