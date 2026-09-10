const { Router } = require("express");
const pagamentosController = require("./pagamentos.controller");

const router = Router();

router.post("/", pagamentosController.create);

// ⚠️ Precisa vir antes de '/:id' pra não ser interpretada como um ID
router.get("/reserva/:idReserva", pagamentosController.findByReserva);

router.get("/:id", pagamentosController.findOne);

module.exports = router;
