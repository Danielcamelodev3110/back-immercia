const { Router } = require("express");
const cuponsController = require("cupons.controller");

const router = Router();

router.post("/", cuponsController.create);
router.get("/", cuponsController.findAll);

// ⚠️ Rota com prefixo fixo precisa vir ANTES de '/:codigo'
router.get("/resgatados/:idCliente", cuponsController.findResgatadosPorCliente);

router.get("/:codigo", cuponsController.findByCodigo);
router.post("/:id/resgatar", cuponsController.resgatar);

module.exports = router;
