const express = require("express");
const cors = require("cors");

const produtosRoutes = require("./produto/produtos.routes");
const usersRoutes = require("./users/users.routes");
const reservasRoutes = require("./reservas/reservas.routes");
const carrinhoRoutes = require("./carrinho/carrinho.routes");
const pagamentosRoutes = require("./pagamentos/pagamentos.routes");
const relatorioRoutes = require("./reservas/relatorio.routes");
const cuponsRoutes = require("./reservas/cupons/Cupons.routes");
const traducoesRoutes = require("./traducoes/traducoes.routes");
const favoritosRoutes = require("./favoritos/favoritos.routes");
const blogRoutes = require("./blog/blog.routes");

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

// ---------------------------------------------------------------------
// Alguns caminhos aceitam mais de um endereço, pra funcionar com todas as
// versões do app (o app chama /produtos, o servidor antes só tinha
// /produto; os cupons estavam em "/rservas/cupons" — com erro de digitação
// — e o carrinho usa /cupons).
// ---------------------------------------------------------------------
app.use(["/produto", "/produtos"], produtosRoutes);
app.use("/users", usersRoutes);

// ⚠️ relatório e cupons ficam ANTES de "/reservas" pra uma rota genérica
// de reservas nunca "engolir" /reservas/relatorio ou /reservas/cupons.
app.use(["/reservas/relatorio", "/relatorio"], relatorioRoutes);
app.use(["/reservas/cupons", "/rservas/cupons", "/cupons"], cuponsRoutes);
app.use("/reservas", reservasRoutes);
app.use("/carrinho", carrinhoRoutes);
app.use("/pagamentos", pagamentosRoutes);
app.use("/traducoes", traducoesRoutes);
app.use("/favoritos", favoritosRoutes);
app.use("/blog", blogRoutes);

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
