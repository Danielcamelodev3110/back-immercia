const supabase = require("../supabaseClient");

// Tabela "reservas": data_reserva, data_checkin, data_checkout, quantidade,
// preco_total, status (pendente|confirmada|cancelada|concluida),
// forma_pagamento (cartao|pix|boleto|dinheiro), codigo_reserva (único),
// observacoes, id_cliente, id_produto, taxa_plataforma, taxa_produto.

// 👇 Percentuais das taxas. Configuráveis via .env:
// - TAXA_PLATAFORMA_PERCENTUAL (padrão 0.10 = 10%): cobrada do CLIENTE,
//   somada ao preço do produto. É o que aparece pro comprador no
//   carrinho e no pagamento como "Taxa da Plataforma".
// - TAXA_PRODUTO_PERCENTUAL (padrão 0.03 = 3%): cobrada do ANFITRIÃO,
//   descontada do valor que ele recebe. Calculada sobre o preço BASE do
//   produto (sem a taxa da plataforma embutida). Essa taxa NUNCA deve
//   ser exibida nas telas de carrinho ou pagamento — é informação
//   interna do repasse ao anfitrião.
const TAXA_PLATAFORMA_PERCENTUAL = Number(
  process.env.TAXA_PLATAFORMA_PERCENTUAL || 0.1,
);
const TAXA_PRODUTO_PERCENTUAL = Number(
  process.env.TAXA_PRODUTO_PERCENTUAL || 0.03,
);

function gerarCodigoReserva() {
  const aleatorio = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `RES-${aleatorio}`;
}

// Calcula os valores derivados do lado do anfitrião:
// - preco_base: preço do produto sem nenhuma taxa (preco_total - taxa_plataforma,
//   já que preco_total inclui a taxa de 10% paga pelo cliente).
// - valor_repasse: o que o anfitrião efetivamente recebe (preco_base - taxa_produto,
//   a taxa de 3% dele).
// Nenhum dos dois é uma coluna no banco — são derivados em tempo real pra
// nunca ficar desatualizado em relação a preco_total/taxa_plataforma/taxa_produto.
function comValorRepasse(reserva) {
  if (!reserva) return reserva;

  const aplicar = (r) => {
    if (r.preco_total === undefined || r.preco_total === null) return r;
    const taxaPlataforma = Number(r.taxa_plataforma || 0);
    const taxaProduto = Number(r.taxa_produto || 0);
    const preco_base = Number(
      (Number(r.preco_total) - taxaPlataforma).toFixed(2),
    );
    const valor_repasse = Number((preco_base - taxaProduto).toFixed(2));
    return { ...r, preco_base, valor_repasse };
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
    // 🔧 preco_base = preço do produto x quantidade, sem nenhuma taxa.
    // taxa_plataforma (10%) = cobrada do CLIENTE, somada ao preco_base
    //   → forma o preco_total, que é o que o cliente paga. Aparece nas
    //   telas de carrinho e pagamento.
    // taxa_produto (3%) = cobrada do ANFITRIÃO, calculada sobre o
    //   preco_base (nunca sobre o preco_total, que já tem a taxa do
    //   cliente embutida) → só é descontada do repasse ao anfitrião.
    //   NUNCA deve ser exibida nas telas de carrinho ou pagamento.
    const preco_base = Number(
      (Number(produto.preco) * quantidadeCompra).toFixed(2),
    );
    const taxa_plataforma = Number(
      (TAXA_PLATAFORMA_PERCENTUAL * preco_base).toFixed(2),
    );
    const taxa_produto = Number(
      (TAXA_PRODUTO_PERCENTUAL * preco_base).toFixed(2),
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
        taxa_produto,
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

  // Resumo financeiro do anfitrião — mostra só o que é dele: quanto ele
  // vendeu (preço base, sem a taxa de 10% que é do cliente), quanto foi
  // descontado da taxa dele (3%) e quanto sobrou líquido. Não expõe nada
  // relacionado à taxa do cliente. Considera apenas reservas "confirmada"
  // ou "concluida" (pendentes/canceladas ainda não geram receita real).
  async resumoGanhos(idAnfitriao) {
    const { data, error } = await supabase
      .from("reservas")
      .select(
        "id, status, preco_total, taxa_plataforma, taxa_produto, produto:produtos!inner(id_cliente_produto)",
      )
      .eq("produto.id_cliente_produto", idAnfitriao)
      .in("status", ["confirmada", "concluida"]);

    if (error) throw error;

    const resumo = (data || []).reduce(
      (acc, r) => {
        const precoTotal = Number(r.preco_total || 0);
        const taxaPlataforma = Number(r.taxa_plataforma || 0);
        const taxaProduto = Number(r.taxa_produto || 0);
        // preço base = o que a reserva vale sem a taxa do cliente
        const precoBase = precoTotal - taxaPlataforma;

        acc.totalBruto += precoBase;
        acc.totalTaxaProduto += taxaProduto;
        acc.totalLiquido += precoBase - taxaProduto;
        acc.quantidadeReservas += 1;
        return acc;
      },
      {
        totalBruto: 0,
        totalTaxaProduto: 0,
        totalLiquido: 0,
        quantidadeReservas: 0,
      },
    );

    return {
      totalBruto: Number(resumo.totalBruto.toFixed(2)),
      totalTaxaProduto: Number(resumo.totalTaxaProduto.toFixed(2)),
      totalLiquido: Number(resumo.totalLiquido.toFixed(2)),
      quantidadeReservas: resumo.quantidadeReservas,
      percentualTaxaProduto: TAXA_PRODUTO_PERCENTUAL,
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
