const { Router } = require("express");
const reservasController = require("./reservas.controller");

const router = Router();

// ⚠️ IMPORTANTE: rotas com prefixo fixo precisam vir ANTES de '/:id',
// senão o Express interpreta "minhas-compras" e "recebidas" como :id.

// POST /reservas — cria uma reserva
router.post("/", reservasController.create);

// GET /reservas — lista todas
router.get("/", reservasController.findAll);

// GET /reservas/minhas-compras/:idCliente
router.get("/minhas-compras/:idCliente", reservasController.findByCliente);

// GET /reservas/recebidas/:idAnfitriao
router.get("/recebidas/:idAnfitriao", reservasController.findByAnfitriao);

// GET /reservas/:id — precisa vir DEPOIS das rotas com prefixo fixo
router.get("/:id", reservasController.findOne);

// PATCH /reservas/:id/status
router.patch("/:id/status", reservasController.updateStatus);

// DELETE /reservas/:id
router.delete("/:id", reservasController.remove);

module.exports = router;
