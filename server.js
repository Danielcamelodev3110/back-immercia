const express = require("express");
const cors = require("cors");

const produtosRoutes = require("./produto/produtos.routes");
const usersRoutes = require("./users/users.routes");
const reservasRoutes = require("./reservas/reservas.routes");
const carrinhoRoutes = require("./carrinho/carrinho.routes"); // 👈 novo
const app = express();

app.use(cors());
app.use(express.json());
app.use("/produtos", produtosRoutes);
app.use("/users", usersRoutes);
app.use("/reservas", reservasRoutes);
app.use("/carrinho", carrinhoRoutes); // 👈 novo

// 👇 Error handler central — precisa ser o ÚLTIMO app.use(), com 4 parâmetros
app.use((err, req, res, next) => {
  console.error(err); // isso vai te mostrar a causa real no terminal
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
