const supabase = require("../supabaseClient");

// Relatório financeiro da plataforma (visão de dono do negócio, não de um
// anfitrião específico). Junta TODAS as reservas confirmadas/concluídas
// pra mostrar:
// - Quanto os clientes gastaram no total (preco_total, preço + taxa de 10%)
// - Quanto ENTROU pra plataforma (taxa_plataforma + taxa_produto)
// - Quanto SAIU da plataforma em repasses aos anfitriões (valor_repasse)
class RelatorioService {
  // dataInicio/dataFim no formato "AAAA-MM-DD" (opcionais, filtram por
  // data_reserva). Sem elas, traz o histórico inteiro.
  async financeiro({ dataInicio, dataFim } = {}) {
    let query = supabase
      .from("reservas")
      .select(
        "id, codigo_reserva, status, data_reserva, quantidade, preco_total, " +
          "taxa_plataforma, taxa_produto, id_cliente, id_produto, " +
          "produto:produtos(nome, id_cliente_produto), " +
          "cliente:registro_cliente(nome_completo, email)",
      )
      .in("status", ["confirmada", "concluida"])
      .order("data_reserva", { ascending: false });

    if (dataInicio) query = query.gte("data_reserva", dataInicio);
    if (dataFim) query = query.lte("data_reserva", dataFim);

    const { data, error } = await query;
    if (error) throw error;

    // Monta uma linha "achatada" por reserva, já com todos os valores
    // calculados — isso é o que vira cada linha do CSV baixado no app.
    const linhas = (data || []).map((r) => {
      const precoTotal = Number(r.preco_total || 0);
      const taxaPlataforma = Number(r.taxa_plataforma || 0);
      const taxaProduto = Number(r.taxa_produto || 0);
      const precoBase = Number((precoTotal - taxaPlataforma).toFixed(2));
      const valorRepasse = Number((precoBase - taxaProduto).toFixed(2));

      return {
        id: r.id,
        codigo_reserva: r.codigo_reserva,
        data_reserva: r.data_reserva,
        status: r.status,
        cliente: r.cliente?.nome_completo || "—",
        email_cliente: r.cliente?.email || "—",
        produto: r.produto?.nome || "—",
        // 👇 quanto o cliente gastou nessa reserva (preço + taxa de 10%)
        gasto_cliente: precoTotal,
        // 👇 entrada: taxa de 10% cobrada do cliente
        taxa_plataforma: taxaPlataforma,
        // 👇 entrada: taxa de 3% cobrada do anfitrião
        taxa_produto: taxaProduto,
        // 👇 saída: quanto foi repassado ao anfitrião
        valor_repasse: valorRepasse,
      };
    });

    const totais = linhas.reduce(
      (acc, l) => {
        acc.totalGastoClientes += l.gasto_cliente;
        acc.totalTaxaPlataforma += l.taxa_plataforma;
        acc.totalTaxaProduto += l.taxa_produto;
        acc.totalSaidaAnfitrioes += l.valor_repasse;
        return acc;
      },
      {
        totalGastoClientes: 0,
        totalTaxaPlataforma: 0,
        totalTaxaProduto: 0,
        totalSaidaAnfitrioes: 0,
      },
    );

    const totalEntradaPlataforma = Number(
      (totais.totalTaxaPlataforma + totais.totalTaxaProduto).toFixed(2),
    );

    return {
      periodo: { dataInicio: dataInicio || null, dataFim: dataFim || null },
      quantidadeReservas: linhas.length,
      // quanto os clientes gastaram na plataforma, no total
      totalGastoClientes: Number(totais.totalGastoClientes.toFixed(2)),
      totalTaxaPlataforma: Number(totais.totalTaxaPlataforma.toFixed(2)),
      totalTaxaProduto: Number(totais.totalTaxaProduto.toFixed(2)),
      // o que ENTRA na Immercia (soma das duas taxas)
      totalEntradaPlataforma,
      // o que SAI da Immercia (repasses aos anfitriões)
      totalSaidaAnfitrioes: Number(totais.totalSaidaAnfitrioes.toFixed(2)),
      reservas: linhas,
    };
  }
}

module.exports = new RelatorioService();
