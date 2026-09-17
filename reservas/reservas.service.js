const supabase = require("../supabaseClient");

// Tabela "reservas": data_reserva, data_checkin, data_checkout, quantidade,
// preco_total, status (pendente|confirmada|cancelada|concluida),
// forma_pagamento (cartao|pix|boleto|dinheiro), codigo_reserva (único),
// observacoes, id_cliente, id_produto, taxa_plataforma.

// 👇 Percentual da taxa da plataforma. Configurável via .env (ex:
// TAXA_PLATAFORMA_PERCENTUAL=0.08 para 8%).
//
// 🔧 REGRA DE NEGÓCIO (atualizada): a taxa é um ACRÉSCIMO cobrado do
// COMPRADOR sobre o preço do produto — não é mais descontada do
// anfitrião. `preco_total` (o que o cliente efetivamente paga) já
// inclui a taxa; o anfitrião recebe o preço cheio do produto.
const TAXA_PLATAFORMA_PERCENTUAL = Number(
  process.env.TAXA_PLATAFORMA_PERCENTUAL || 0.08,
);

function gerarCodigoReserva() {
  const aleatorio = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `RES-${aleatorio}`;
}

// Calcula quanto o anfitrião efetivamente recebe. Como agora a taxa é
// somada em cima do preço (e não descontada dele), "preco_total - taxa"
// devolve exatamente o preço cheio do produto — o que o anfitrião recebe.
// Não é uma coluna no banco — é derivado em tempo real pra nunca ficar
// desatualizado em relação a preco_total/taxa_plataforma.
function comValorRepasse(reserva) {
  if (!reserva) return reserva;

  const aplicar = (r) => {
    if (r.preco_total === undefined || r.preco_total === null) return r;
    const taxa = Number(r.taxa_plataforma || 0);
    const valor_repasse = Number((Number(r.preco_total) - taxa).toFixed(2));
    return { ...r, valor_repasse };
  };

  return Array.isArray(reserva) ? reserva.map(aplicar) : aplicar(reserva);
}

class ReservasService {
  async create(createReservaDto) {
    const {
      id_cliente,
      id_produto,
      quantidade,
      data_checkin,
      data_checkout,
      observacoes,
    } = createReservaDto;

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

    // 4. Calcula os valores no backend (garante precisão de 2 casas decimais)
    // 🔧 preco_base = valor que o anfitrião recebe (preço do produto x quantidade).
    // taxa_plataforma = percentual aplicado sobre o preco_base.
    // preco_total = preco_base + taxa_plataforma → é isso que o CLIENTE paga,
    // e é o valor que deve ser usado na tela/cobrança de pagamento.
    const preco_base = Number(
      (Number(produto.preco) * quantidadeCompra).toFixed(2),
    );
    const taxa_plataforma = Number(
      (TAXA_PLATAFORMA_PERCENTUAL * preco_base).toFixed(2),
    );
    const preco_total = Number((preco_base + taxa_plataforma).toFixed(2));

    // 5. Cria a reserva
    const { data: reserva, error: reservaError } = await supabase
      .from("reservas")
      .insert({
        id_cliente,
        id_produto,
        quantidade: quantidadeCompra,
        preco_total,
        taxa_plataforma,
        status: "pendente",
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

    return comValorRepasse(reserva);
  }

  async findAll() {
    const { data, error } = await supabase
      .from("reservas")
      .select("*, produto:produtos(*), cliente:registro_cliente(*)")
      .order("data_reserva", { ascending: false });

    if (error) throw error;

    return comValorRepasse(data);
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

    return comValorRepasse(reserva);
  }

  // "Minhas compras" — reservas feitas por um cliente
  async findByCliente(idCliente) {
    const { data, error } = await supabase
      .from("reservas")
      .select("*, produto:produtos(*)")
      .eq("id_cliente", idCliente)
      .order("data_reserva", { ascending: false });

    if (error) throw error;

    return comValorRepasse(data);
  }

  // Reservas recebidas pelo anfitrião (produtos dele que foram comprados)
  async findByAnfitriao(idAnfitriao) {
    const { data, error } = await supabase
      .from("reservas")
      .select("*, produto:produtos!inner(*), cliente:registro_cliente(*)")
      .eq("produto.id_cliente_produto", idAnfitriao)
      .order("data_reserva", { ascending: false });

    if (error) throw error;

    return comValorRepasse(data);
  }

  // Resumo financeiro do anfitrião: quanto foi cobrado dos clientes no
  // total (incluindo a taxa da plataforma, que agora é paga por eles),
  // quanto disso é taxa da plataforma, e quanto o anfitrião efetivamente
  // recebe (o preço cheio do produto, sem desconto nenhum).
  // Considera apenas reservas "confirmada" ou "concluida" (reservas
  // pendentes/canceladas ainda não geram receita real).
  async resumoGanhos(idAnfitriao) {
    const { data, error } = await supabase
      .from("reservas")
      .select(
        "id, status, preco_total, taxa_plataforma, produto:produtos!inner(id_cliente_produto)",
      )
      .eq("produto.id_cliente_produto", idAnfitriao)
      .in("status", ["confirmada", "concluida"]);

    if (error) throw error;

    const resumo = (data || []).reduce(
      (acc, r) => {
        const bruto = Number(r.preco_total || 0);
        const taxa = Number(r.taxa_plataforma || 0);
        acc.totalBruto += bruto;
        acc.totalTaxaPlataforma += taxa;
        acc.totalLiquido += bruto - taxa;
        acc.quantidadeReservas += 1;
        return acc;
      },
      {
        totalBruto: 0,
        totalTaxaPlataforma: 0,
        totalLiquido: 0,
        quantidadeReservas: 0,
      },
    );

    return {
      totalBruto: Number(resumo.totalBruto.toFixed(2)),
      totalTaxaPlataforma: Number(resumo.totalTaxaPlataforma.toFixed(2)),
      totalLiquido: Number(resumo.totalLiquido.toFixed(2)),
      quantidadeReservas: resumo.quantidadeReservas,
      percentualTaxa: TAXA_PLATAFORMA_PERCENTUAL,
    };
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

    return comValorRepasse(data);
  }
}

module.exports = new ReservasService();
