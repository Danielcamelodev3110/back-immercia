const traducoesService = require("./traducoes.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// POST /traducoes   body: { idioma: "en" | "es", textos: ["...", "..."] }
// resposta: { traducoes: { "texto original": "translated text" } }
exports.traduzir = asyncHandler(async (req, res) => {
  const { idioma, textos } = req.body || {};
  const traducoes = await traducoesService.traduzir(idioma, textos);
  res.json({ traducoes });
});
