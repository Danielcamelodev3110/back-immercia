const { Router } = require("express");
const favoritosController = require("./favoritos.controller");

const router = Router();

router.post("/", favoritosController.adicionar);

// ⚠️ Rota com sufixo fixo precisa vir ANTES de '/:idCliente'
router.get("/:idCliente/ids", favoritosController.findIdsPorCliente);

router.get("/:idCliente", favoritosController.findByCliente);
router.delete("/:idCliente/:idProduto", favoritosController.remover);

module.exports = router;
