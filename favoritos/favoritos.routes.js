const { Router } = require("express");
const favoritosController = require("./favoritos.controller");

const router = Router();

router.post("/", favoritosController.add);

// ⚠️ '/:idCliente/ids' precisa vir ANTES de '/:idCliente'
router.get("/:idCliente/ids", favoritosController.findIds);
router.get("/:idCliente", favoritosController.findByCliente);
router.delete("/:idCliente/:idProduto", favoritosController.remove);

module.exports = router;
