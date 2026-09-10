const reservasService = require("./reservas.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// POST /reservas — realiza a compra do produto
exports.create = asyncHandler(async (req, res) => {
  const reserva = await reservasService.create(req.body);
  res.status(201).json(reserva);
});

exports.findAll = asyncHandler(async (req, res) => {
  const reservas = await reservasService.findAll();
  res.json(reservas);
});

exports.findOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const reserva = await reservasService.findOne(id);
  res.json(reserva);
});

// GET /reservas/minhas-compras/:idCliente
exports.findByCliente = asyncHandler(async (req, res) => {
  const idCliente = Number(req.params.idCliente);
  const reservas = await reservasService.findByCliente(idCliente);
  res.json(reservas);
});

// GET /reservas/recebidas/:idAnfitriao
exports.findByAnfitriao = asyncHandler(async (req, res) => {
  const idAnfitriao = Number(req.params.idAnfitriao);
  const reservas = await reservasService.findByAnfitriao(idAnfitriao);
  res.json(reservas);
});

// PATCH /reservas/:id/status  body: { status: "confirmada" }
exports.updateStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const reserva = await reservasService.updateStatus(id, status);
  res.json(reserva);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const reserva = await reservasService.remove(id);
  res.json(reserva);
});
