const { Router } = require("express");
const reservasController = require("./reservas.controller");

const router = Router();

router.post("/", reservasController.create);
router.get("/", reservasController.findAll);

// ⚠️ Rotas com prefixo fixo precisam vir ANTES de '/:id'
router.get("/minhas-compras/:idCliente", reservasController.findByCliente);
router.get("/recebidas/:idAnfitriao", reservasController.findByAnfitriao);

router.get("/:id", reservasController.findOne);
router.patch("/:id/status", reservasController.updateStatus);
router.delete("/:id", reservasController.remove);

module.exports = router;
