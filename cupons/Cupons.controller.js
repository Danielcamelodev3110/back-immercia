const cuponsService = require("cupons.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

exports.create = asyncHandler(async (req, res) => {
  const cupom = await cuponsService.create(req.body);
  res.status(201).json(cupom);
});

exports.findAll = asyncHandler(async (req, res) => {
  const cupons = await cuponsService.findAll();
  res.json(cupons);
});

exports.findByCodigo = asyncHandler(async (req, res) => {
  const cupom = await cuponsService.findByCodigo(req.params.codigo);
  res.json(cupom);
});

// POST /cupons/:id/resgatar  body: { id_cliente }
exports.resgatar = asyncHandler(async (req, res) => {
  const idCupom = Number(req.params.id);
  const { id_cliente } = req.body;

  if (!id_cliente) {
    const err = new Error("id_cliente é obrigatório.");
    err.status = 400;
    throw err;
  }

  const resgate = await cuponsService.resgatar(idCupom, id_cliente);
  res.status(201).json(resgate);
});

// GET /cupons/resgatados/:idCliente
exports.findResgatadosPorCliente = asyncHandler(async (req, res) => {
  const idCliente = Number(req.params.idCliente);
  const ids = await cuponsService.findResgatadosPorCliente(idCliente);
  res.json(ids);
});
