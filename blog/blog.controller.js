const blogService = require("./blog.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// POST /blog  body: { titulo, subtitulo, destino, categoria, conteudo, imagem_capa, id_autor }
exports.create = asyncHandler(async (req, res) => {
  const post = await blogService.create(req.body);
  res.status(201).json(post);
});

exports.findAll = asyncHandler(async (req, res) => {
  const posts = await blogService.findAll();
  res.json(posts);
});

exports.findOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const post = await blogService.findOne(id);
  res.json(post);
});
