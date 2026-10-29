const { Router } = require("express");
const usersController = require("./users.controller");
const recuperacaoController = require("./recuperacaoSenha.controller");

const router = Router();

router.post("/", usersController.create);

// ⚠️ Precisa vir antes de '/:id' pra não ser interpretada como um ID
router.post("/login", usersController.login);

// ---- Recuperação de senha (por código enviado por e-mail) ----
// Limite simples por IP: 30 requisições a cada 15 minutos nessas 3 rotas.
const LIMITE = 30;
const JANELA_MS = 15 * 60 * 1000;
const acessos = new Map();

const limitarRecuperacao = (req, res, next) => {
  const ip = (req.headers["x-forwarded-for"] || req.ip || "").toString().split(",")[0].trim();
  const agora = Date.now();
  const registro = acessos.get(ip);

  if (!registro || agora - registro.inicio > JANELA_MS) {
    acessos.set(ip, { inicio: agora, total: 1 });
    return next();
  }
  registro.total += 1;
  if (registro.total > LIMITE) {
    return res
      .status(429)
      .json({ message: "Muitas solicitações. Aguarde alguns minutos e tente novamente." });
  }
  next();
};

setInterval(() => {
  const agora = Date.now();
  for (const [ip, r] of acessos) if (agora - r.inicio > JANELA_MS) acessos.delete(ip);
}, JANELA_MS).unref();

router.get("/recuperacao-status", recuperacaoController.status);
router.post("/esqueci-senha", limitarRecuperacao, recuperacaoController.solicitar);
router.post("/verificar-codigo", limitarRecuperacao, recuperacaoController.verificar);
router.post("/redefinir-senha", limitarRecuperacao, recuperacaoController.redefinir);

router.get("/", usersController.findAll);
router.get("/:id", usersController.findOne);
router.patch("/:id", usersController.update);
router.delete("/:id", usersController.remove);

module.exports = router;
