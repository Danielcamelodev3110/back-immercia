const { Router } = require("express");
const traducoesController = require("./traducoes.controller");

const router = Router();

// Limite simples por IP (60 requisições por minuto) pra ninguém gastar
// a cota do serviço de tradução.
const LIMITE = 60;
const JANELA_MS = 60 * 1000;
const acessos = new Map();

router.use((req, res, next) => {
  const ip = (req.headers["x-forwarded-for"] || req.ip || "")
    .toString()
    .split(",")[0]
    .trim();
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
      .json({ message: "Muitas requisições de tradução. Aguarde um minuto." });
  }
  next();
});

// limpa a tabela de acessos de tempos em tempos
setInterval(() => {
  const agora = Date.now();
  for (const [ip, r] of acessos)
    if (agora - r.inicio > JANELA_MS) acessos.delete(ip);
}, JANELA_MS).unref();

router.post("/", traducoesController.traduzir);

module.exports = router;
