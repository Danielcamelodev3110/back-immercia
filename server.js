const express = require("express");
const cors = require("cors");

const produtosRoutes = require("./produto/produtos.routes");
const usersRoutes = require("./users/users.routes");
const reservasRoutes = require("./reservas/reservas.routes");
const carrinhoRoutes = require("./carrinho/carrinho.routes");
const pagamentosRoutes = require("./pagamentos/pagamentos.routes");

const app = express();

// 👇 CORS liberado para qualquer origem — precisa vir ANTES de qualquer
// rota, senão o preflight (OPTIONS) das rotas registradas antes dele
// nunca passa por esse middleware e o navegador bloqueia a requisição.
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions)); // já cobre o preflight automaticamente

app.use(express.json());
app.use("/produtos", produtosRoutes);
app.use("/users", usersRoutes);
app.use("/reservas", reservasRoutes);
app.use("/carrinho", carrinhoRoutes);
app.use("/pagamentos", pagamentosRoutes);

// 👇 Error handler central — precisa ser o ÚLTIMO app.use(), com 4 parâmetros
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Erro interno no servidor.",
    ...(err.details ? { details: err.details } : {}),
    ...(err.hint ? { hint: err.hint } : {}),
  });
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
