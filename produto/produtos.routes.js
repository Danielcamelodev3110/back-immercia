const { Router } = require('express');
const produtosController = require('./produtos.controller');

const router = Router();

router.post('/', produtosController.create);
router.get('/', produtosController.findAll);

// ⚠️ Rotas com prefixo fixo (ex: /minhas-hospedagens/:idCliente) precisam
// vir ANTES da rota genérica '/:id', senão o Express interpreta
// "minhas-hospedagens" como um valor de :id.
router.get('/minhas-hospedagens/:idCliente', produtosController.findMinhasHospedagens);

router.get('/:id', produtosController.findOne);
router.delete('/:id', produtosController.remove);

module.exports = router;
