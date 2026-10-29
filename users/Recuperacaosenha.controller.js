const recuperacaoService = require("./Recuperacaosenha.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// POST /users/esqueci-senha   body: { email, idioma? }
exports.solicitar = asyncHandler(async (req, res) => {
  const { email, idioma } = req.body || {};
  await recuperacaoService.solicitar({ email, idioma });
  res.json({
    message: "Se o e-mail estiver cadastrado, enviaremos um código.",
  });
});

// POST /users/verificar-codigo   body: { email, codigo }
exports.verificar = asyncHandler(async (req, res) => {
  const { email, codigo } = req.body || {};
  res.json(await recuperacaoService.verificar({ email, codigo }));
});

// POST /users/redefinir-senha   body: { email, codigo, nova_senha }
exports.redefinir = asyncHandler(async (req, res) => {
  const { email, codigo, nova_senha } = req.body || {};
  res.json(await recuperacaoService.redefinir({ email, codigo, nova_senha }));
});
