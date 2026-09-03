// Exemplo de integração no seu app.js / server.js principal
require('dotenv').config();
const express = require('express');
const produtosRoutes = require('./produtos.routes');

const app = express();
app.use(express.json());

app.use('/produtos', produtosRoutes);

// Error handler central: transforma os erros lançados nos services/controllers
// (equivalente às NotFoundException do Nest) em respostas HTTP.
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Erro interno no servidor.',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
