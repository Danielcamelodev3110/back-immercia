const express = require("express");
const cors = require("cors");

// ─── Rotas ────────────────────────────────────────────────
const produtosRoutes = require("./produto/produtos.routes");
const usersRoutes = require("./users/users.routes");
const reservasRoutes = require("./reservas/reservas.routes");
const carrinhoRoutes = require("./carrinho/carrinho.routes");
const pagamentosRoutes = require("./pagamentos/pagamentos.routes");

const app = express();

// ─── CORS liberado para qualquer origem ──────────────────
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions)); // já cobre o preflight automaticamente

// ─── Parser de JSON ──────────────────────────────────────
app.use(express.json());

// ─── Registro das rotas ──────────────────────────────────
app.use("/produtos", produtosRoutes);
app.use("/users", usersRoutes);
app.use("/reservas", reservasRoutes);
app.use("/carrinho", carrinhoRoutes);
app.use("/pagamentos", pagamentosRoutes);

// ─── Error handler central ───────────────────────────────
// Precisa ser o ÚLTIMO app.use(), com 4 parâmetros.
app.use((err, req, res, next) => {
  console.error(err);

  const status = err.status || 500;

  res.status(status).json({
    message: err.message || "Erro interno no servidor.",
    ...(err.details ? { details: err.details } : {}),
    ...(err.hint ? { hint: err.hint } : {}),
  });
});

// ─── Start do servidor ───────────────────────────────────
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
