const supabase = require("../supabaseClient");

// Tabela "favoritos": id_cliente, id_produto, data_criacao.
// Um cliente favorita um produto no máximo uma vez (constraint única).

class FavoritosService {
  // Adiciona um produto aos favoritos do cliente. Se já existir, devolve
  // o registro existente em vez de dar erro — assim o front pode chamar
  // direto ao tocar no coração, sem precisar checar antes se já existe.
  async adicionar(idCliente, idProduto) {
    const { data: existente, error: existenteError } = await supabase
      .from("favoritos")
      .select("*")
      .eq("id_cliente", idCliente)
      .eq("id_produto", idProduto)
      .maybeSingle();

    if (existenteError) throw existenteError;
    if (existente) return existente;

    const { data: produto, error: produtoError } = await supabase
      .from("produtos")
      .select("id")
      .eq("id", idProduto)
      .maybeSingle();

    if (produtoError) throw produtoError;
    if (!produto) {
      const err = new Error("Produto não encontrado.");
      err.status = 404;
      throw err;
    }

    const { data: favorito, error } = await supabase
      .from("favoritos")
      .insert({ id_cliente: idCliente, id_produto: idProduto })
      .select()
      .single();

    if (error) throw error;
    return favorito;
  }

  async remover(idCliente, idProduto) {
    const { data, error } = await supabase
      .from("favoritos")
      .delete()
      .eq("id_cliente", idCliente)
      .eq("id_produto", idProduto)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const err = new Error("Esse produto não estava nos favoritos.");
      err.status = 404;
      throw err;
    }
    return data;
  }

  // Lista os favoritos de um cliente, já com os dados do produto (join),
  // mais recentes primeiro — é isso que a tela de Favoritos consome.
  async findByCliente(idCliente) {
    const { data, error } = await supabase
      .from("favoritos")
      .select("id, data_criacao, produto:produtos(*)")
      .eq("id_cliente", idCliente)
      .order("data_criacao", { ascending: false });

    if (error) throw error;
    return data;
  }

  // Ids dos produtos que um cliente favoritou — útil pras telas de
  // listagem de produtos pintarem o coração preenchido sem precisar
  // buscar o favorito inteiro por item.
  async findIdsPorCliente(idCliente) {
    const { data, error } = await supabase
      .from("favoritos")
      .select("id_produto")
      .eq("id_cliente", idCliente);

    if (error) throw error;
    return (data || []).map((f) => f.id_produto);
  }
}

module.exports = new FavoritosService();
