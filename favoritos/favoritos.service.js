const supabase = require("../supabaseClient");

const TIPOS = ["experiencia", "hospedagem", "pacote"];

const erro = (mensagem, status = 400) => {
  const err = new Error(mensagem);
  err.status = status;
  return err;
};

const paraId = (valor, nome) => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw erro(`${nome} inválido.`);
  return n;
};

class FavoritosService {
  // Ids dos produtos favoritados pelo cliente (opcionalmente só de um tipo)
  async findIdsByCliente(idCliente, tipo) {
    const id = paraId(idCliente, "id_cliente");

    const { data, error } = await supabase
      .from("favoritos")
      .select("id_produto")
      .eq("id_cliente", id)
      .order("criado_em", { ascending: false });

    if (error) throw error;
    let ids = (data || []).map((f) => f.id_produto);

    if (tipo && ids.length > 0) {
      if (!TIPOS.includes(tipo))
        throw erro(`tipo inválido. Use: ${TIPOS.join(", ")}.`);
      const { data: produtos, error: prodError } = await supabase
        .from("produtos")
        .select("id")
        .in("id", ids)
        .eq("tipo_produto", tipo);
      if (prodError) throw prodError;
      const permitidos = new Set((produtos || []).map((p) => p.id));
      ids = ids.filter((i) => permitidos.has(i));
    }

    return ids;
  }

  // Produtos completos favoritados pelo cliente
  async findByCliente(idCliente, tipo) {
    const ids = await this.findIdsByCliente(idCliente, tipo);
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .in("id", ids);
    if (error) throw error;

    // mantém a ordem "mais recente primeiro"
    const porId = new Map((data || []).map((p) => [p.id, p]));
    return ids.map((i) => porId.get(i)).filter(Boolean);
  }

  // Idempotente: favoritar duas vezes não duplica nem dá erro
  async add({ id_cliente, id_produto }) {
    const cliente = paraId(id_cliente, "id_cliente");
    const produto = paraId(id_produto, "id_produto");

    const { data: existe, error: prodError } = await supabase
      .from("produtos")
      .select("id")
      .eq("id", produto)
      .maybeSingle();
    if (prodError) throw prodError;
    if (!existe) throw erro("Produto não encontrado.", 404);

    const { data, error } = await supabase
      .from("favoritos")
      .upsert(
        { id_cliente: cliente, id_produto: produto },
        { onConflict: "id_cliente,id_produto" },
      )
      .select()
      .maybeSingle();
    if (error) throw error;

    return data || { id_cliente: cliente, id_produto: produto };
  }

  async remove(idCliente, idProduto) {
    const cliente = paraId(idCliente, "id_cliente");
    const produto = paraId(idProduto, "id_produto");

    const { error } = await supabase
      .from("favoritos")
      .delete()
      .eq("id_cliente", cliente)
      .eq("id_produto", produto);
    if (error) throw error;

    return { id_cliente: cliente, id_produto: produto, removido: true };
  }
}

module.exports = new FavoritosService();
