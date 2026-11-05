const favoritosService = require("./favoritos.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// POST /favoritos  body: { id_cliente, id_produto }
exports.adicionar = asyncHandler(async (req, res) => {
  const { id_cliente, id_produto } = req.body;

  if (!id_cliente || !id_produto) {
    const err = new Error("id_cliente e id_produto são obrigatórios.");
    err.status = 400;
    throw err;
  }

  const favorito = await favoritosService.adicionar(id_cliente, id_produto);
  res.status(201).json(favorito);
});

// DELETE /favoritos/:idCliente/:idProduto
exports.remover = asyncHandler(async (req, res) => {
  const idCliente = Number(req.params.idCliente);
  const idProduto = Number(req.params.idProduto);

  await favoritosService.remover(idCliente, idProduto);
  res.json({ message: "Removido dos favoritos." });
});

// GET /favoritos/:idCliente
exports.findByCliente = asyncHandler(async (req, res) => {
  const idCliente = Number(req.params.idCliente);
  const favoritos = await favoritosService.findByCliente(idCliente);
  res.json(favoritos);
});

// GET /favoritos/:idCliente/ids
exports.findIdsPorCliente = asyncHandler(async (req, res) => {
  const idCliente = Number(req.params.idCliente);
  const ids = await favoritosService.findIdsPorCliente(idCliente);
  res.json(ids);
});
