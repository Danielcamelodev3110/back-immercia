const { Router } = require("express");
const carrinhoController = require("./carrinho.controller");

const router = Router();

router.post("/", carrinhoController.adicionar);
router.get("/:id_cliente", carrinhoController.findAllByCliente);
router.patch("/:id", carrinhoController.updateQuantidade);
router.delete("/:id", carrinhoController.remove);

module.exports = router;
