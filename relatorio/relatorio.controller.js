const relatorioService = require("./relatorio.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /relatorio/financeiro
// GET /relatorio/financeiro?dataInicio=2026-01-01&dataFim=2026-01-31
exports.financeiro = asyncHandler(async (req, res) => {
  const { dataInicio, dataFim } = req.query;
  const relatorio = await relatorioService.financeiro({ dataInicio, dataFim });
  res.json(relatorio);
});
