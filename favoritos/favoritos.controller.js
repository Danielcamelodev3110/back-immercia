const favoritosService = require("./favoritos.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /favoritos/:idCliente/ids?tipo=hospedagem  ->  [3, 7, 12]
exports.findIds = asyncHandler(async (req, res) => {
  res.json(
    await favoritosService.findIdsByCliente(
      req.params.idCliente,
      req.query.tipo,
    ),
  );
});

// GET /favoritos/:idCliente?tipo=hospedagem  ->  [ { ...produto }, ... ]
exports.findByCliente = asyncHandler(async (req, res) => {
  res.json(
    await favoritosService.findByCliente(req.params.idCliente, req.query.tipo),
  );
});

// POST /favoritos  body: { id_cliente, id_produto }
exports.add = asyncHandler(async (req, res) => {
  res.status(201).json(await favoritosService.add(req.body || {}));
});

// DELETE /favoritos/:idCliente/:idProduto
exports.remove = asyncHandler(async (req, res) => {
  res.json(
    await favoritosService.remove(req.params.idCliente, req.params.idProduto),
  );
});
