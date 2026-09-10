const produtosService = require("./produtos.service");

// Pequeno helper pra evitar repetir try/catch em toda rota
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

exports.create = asyncHandler(async (req, res) => {
  const produto = await produtosService.create(req.body);
  res.status(201).json(produto);
});

exports.findAll = asyncHandler(async (req, res) => {
  const produtos = await produtosService.findAll();
  res.json(produtos);
});

exports.findOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const produto = await produtosService.findOne(id);
  res.json(produto);
});

exports.findMinhasHospedagens = asyncHandler(async (req, res) => {
  const idCliente = Number(req.params.idCliente);
  const hospedagens = await produtosService.findMinhasHospedagens(idCliente);
  res.json(hospedagens);
});

exports.remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const produto = await produtosService.remove(id);
  res.json(produto);
});
