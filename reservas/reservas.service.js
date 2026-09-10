const supabase = require("../supabaseClient");

// Tabela "reservas": data_reserva, data_checkin, data_checkout, quantidade,
// preco_total, status (pendente|confirmada|cancelada|concluida),
// forma_pagamento (cartao|pix|boleto|dinheiro), codigo_reserva (único),
// observacoes, id_cliente, id_produto.

function gerarCodigoReserva() {
  // Ex: RES-93F1K2A7 — simples e único o suficiente pra esse caso de uso.
  const aleatorio = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `RES-${aleatorio}`;
}

class ReservasService {
  async create(createReservaDto) {
    const {
      id_cliente,
      id_produto,
      quantidade,
      data_checkin,
      data_checkout,
      forma_pagamento,
      observacoes,
    } = createReservaDto;

    // Validação básica de campos obrigatórios
    if (!id_cliente || !id_produto) {
      const err = new Error("id_cliente e id_produto são obrigatórios.");
      err.status = 400;
      throw err;
    }

    // 1. Verifica se o cliente existe
    const { data: cliente, error: clienteError } = await supabase
      .from("registro_cliente")
      .select("id")
      .eq("id", id_cliente)
      .maybeSingle();

    if (clienteError) throw clienteError;
    if (!cliente) {
      const err = new Error("Cliente não encontrado.");
      err.status = 404;
      throw err;
    }

    // 2. Verifica se o produto existe e pega o preço/estoque atuais
    const { data: produto, error: produtoError } = await supabase
      .from("produtos")
      .select("id, preco, quantidade_estoque, status")
      .eq("id", id_produto)
      .maybeSingle();

    if (produtoError) throw produtoError;
    if (!produto) {
      const err = new Error("Produto não encontrado.");
      err.status = 404;
      throw err;
    }

    if (produto.status !== "disponivel") {
      const err = new Error("Este produto não está disponível para compra.");
      err.status = 409;
      throw err;
    }

    const quantidadeCompra = quantidade || 1;

    // 3. Verifica estoque, se o produto controla estoque
    if (
      produto.quantidade_estoque !== null &&
      produto.quantidade_estoque < quantidadeCompra
    ) {
      const err = new Error("Estoque insuficiente para essa quantidade.");
      err.status = 409;
      throw err;
    }

    // 4. Calcula o preço total no backend (nunca confia no valor vindo do front)
    const preco_total = Number(produto.preco) * quantidadeCompra;

    // 5. Cria a reserva
    const { data: reserva, error: reservaError } = await supabase
      .from("reservas")
      .insert({
        id_cliente,
        id_produto,
        quantidade: quantidadeCompra,
        preco_total,
        status: "pendente",
        forma_pagamento: forma_pagamento || null,
        codigo_reserva: gerarCodigoReserva(),
        data_checkin: data_checkin || null,
        data_checkout: data_checkout || null,
        observacoes: observacoes || null,
      })
      .select()
      .single();

    if (reservaError) throw reservaError;

    // 6. Abate do estoque, se aplicável
    if (produto.quantidade_estoque !== null) {
      const { error: estoqueError } = await supabase
        .from("produtos")
        .update({
          quantidade_estoque: produto.quantidade_estoque - quantidadeCompra,
        })
        .eq("id", id_produto);

      if (estoqueError) throw estoqueError;
    }

    return reserva;
  }

  async findAll() {
    const { data, error } = await supabase
      .from("reservas")
      .select("*, produto:produtos(*), cliente:registro_cliente(*)")
      .order("data_reserva", { ascending: false });

    if (error) throw error;

    return data;
  }

  async findOne(id) {
    const { data: reserva, error } = await supabase
      .from("reservas")
      .select("*, produto:produtos(*), cliente:registro_cliente(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!reserva) {
      const err = new Error("Reserva não encontrada.");
      err.status = 404;
      throw err;
    }

    return reserva;
  }

  // "Minhas compras" — reservas feitas por um cliente
  async findByCliente(idCliente) {
    const { data, error } = await supabase
      .from("reservas")
      .select("*, produto:produtos(*)")
      .eq("id_cliente", idCliente)
      .order("data_reserva", { ascending: false });

    if (error) throw error;

    return data;
  }

  // Reservas recebidas pelo anfitrião (produtos dele que foram comprados)
  async findByAnfitriao(idAnfitriao) {
    const { data, error } = await supabase
      .from("reservas")
      .select("*, produto:produtos!inner(*), cliente:registro_cliente(*)")
      .eq("produto.id_cliente_produto", idAnfitriao)
      .order("data_reserva", { ascending: false });

    if (error) throw error;

    return data;
  }

  async updateStatus(id, status) {
    const statusValidos = ["pendente", "confirmada", "cancelada", "concluida"];
    if (!statusValidos.includes(status)) {
      const err = new Error(
        `Status inválido. Use um destes: ${statusValidos.join(", ")}.`,
      );
      err.status = 400;
      throw err;
    }

    const { data: reserva, error } = await supabase
      .from("reservas")
      .update({ status })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!reserva) {
      const err = new Error("Reserva não encontrada.");
      err.status = 404;
      throw err;
    }

    return reserva;
  }

  async remove(id) {
    const { data, error } = await supabase
      .from("reservas")
      .delete()
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const err = new Error("Reserva não encontrada.");
      err.status = 404;
      throw err;
    }

    return data;
  }
}

module.exports = new ReservasService();
