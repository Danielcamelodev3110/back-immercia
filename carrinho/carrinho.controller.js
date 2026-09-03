const carrinhoService = require("./carrinho.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// POST /carrinho
exports.adicionar = asyncHandler(async (req, res) => {
  const item = await carrinhoService.adicionar(req.body);
  res.status(201).json(item);
});

// GET /carrinho/:id_cliente
exports.findAllByCliente = asyncHandler(async (req, res) => {
  const id_cliente = Number(req.params.id_cliente);
  const carrinho = await carrinhoService.findAllByCliente(id_cliente);
  res.json(carrinho);
});

// PATCH /carrinho/:id
exports.updateQuantidade = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const item = await carrinhoService.updateQuantidade(id, req.body.quantidade);
  res.json(item);
});

// DELETE /carrinho/:id
exports.remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const item = await carrinhoService.remove(id);
  res.json(item);
});
