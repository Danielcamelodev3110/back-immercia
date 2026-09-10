const pagamentosService = require("./pagamentos.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// POST /pagamentos — simula a aprovação de um pagamento pra uma reserva
exports.create = asyncHandler(async (req, res) => {
  const pagamento = await pagamentosService.create(req.body);
  res.status(201).json(pagamento);
});

// GET /pagamentos/:id
exports.findOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const pagamento = await pagamentosService.findOne(id);
  res.json(pagamento);
});

// GET /pagamentos/reserva/:idReserva
exports.findByReserva = asyncHandler(async (req, res) => {
  const idReserva = Number(req.params.idReserva);
  const pagamento = await pagamentosService.findByReserva(idReserva);
  res.json(pagamento);
});
