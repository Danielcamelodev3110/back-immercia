const { Router } = require("express");
const relatorioController = require("./relatorio.controller");

const router = Router();

router.get("/financeiro", relatorioController.financeiro);

module.exports = router;
