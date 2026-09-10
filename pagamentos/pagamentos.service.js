const supabase = require("../supabaseClient");
const crypto = require("crypto");

// Tabela "pagamentos": valor, forma_pagamento (FormaPagamento), status,
// transacao_id (único), data_pagamento, comprovante_url, id_reserva
// (único — uma reserva tem no máximo um pagamento).

function gerarTransacaoId() {
  // ⚠️ SIMULAÇÃO: id fake, só pra preencher a coluna transacao_id.
  // Quando integrar um gateway real (Stripe/Mercado Pago/PagSeguro),
  // esse valor viria da resposta do próprio gateway.
  return `SIM-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

class PagamentosService {
  async create({ id_reserva, valor, forma_pagamento }) {
    if (!id_reserva || valor === undefined || valor === null) {
      const err = new Error("id_reserva e valor são obrigatórios.");
      err.status = 400;
      throw err;
    }

    // 1. Confere se a reserva existe
    const { data: reserva, error: reservaError } = await supabase
      .from("reservas")
      .select("id, status, preco_total")
      .eq("id", id_reserva)
      .maybeSingle();

    if (reservaError) throw reservaError;
    if (!reserva) {
      const err = new Error("Reserva não encontrada.");
      err.status = 404;
      throw err;
    }

    // 2. Confere se essa reserva já não tem um pagamento (coluna
    // id_reserva é única na tabela pagamentos)
    const { data: pagamentoExistente, error: pagamentoExistenteError } =
      await supabase
        .from("pagamentos")
        .select("id")
        .eq("id_reserva", id_reserva)
        .maybeSingle();

    if (pagamentoExistenteError) throw pagamentoExistenteError;
    if (pagamentoExistente) {
      const err = new Error("Essa reserva já possui um pagamento registrado.");
      err.status = 409;
      throw err;
    }

    // 3. ⚠️ SIMULAÇÃO DE PAGAMENTO — aprova imediatamente, sem gateway
    // real. Isso é o que muda quando você integrar um gateway de
    // verdade: o status normalmente começaria como "pendente" aqui e
    // seria atualizado depois, por um webhook do gateway confirmando
    // o pagamento — não na hora, direto nesse endpoint.
    const transacao_id = gerarTransacaoId();

    const { data: pagamento, error: pagamentoError } = await supabase
      .from("pagamentos")
      .insert({
        valor,
        forma_pagamento: forma_pagamento || null,
        status: "aprovado",
        transacao_id,
        id_reserva,
      })
      .select()
      .single();

    if (pagamentoError) throw pagamentoError;

    // 4. Pagamento aprovado -> confirma a reserva
    const { error: statusError } = await supabase
      .from("reservas")
      .update({ status: "confirmada" })
      .eq("id", id_reserva);

    if (statusError) throw statusError;

    return pagamento;
  }

  async findOne(id) {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*, reserva:reservas(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const err = new Error("Pagamento não encontrado.");
      err.status = 404;
      throw err;
    }

    return data;
  }

  async findByReserva(idReserva) {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("id_reserva", idReserva)
      .maybeSingle();

    if (error) throw error;

    // Pode ser null — nem toda reserva tem pagamento ainda, não é erro.
    return data;
  }
}

module.exports = new PagamentosService();
