// teste-bcrypt.js
const bcrypt = require("bcrypt");

// 👇 Cole aqui o hash EXATO copiado do Supabase (coluna senha_hash do usuário id=11)
const hashDoBanco =
  "$2y$10$FTNEXupL6BQm0/Ox0jbpZORHl6Nousw9ri/nzZaZoMlc2IWotgfM2";

// 👇 Digite aqui a senha que você está usando pra tentar logar
const senhaDigitada = "1234567";

console.log("Tamanho do hash:", hashDoBanco.length);
console.log("Primeiros caracteres:", JSON.stringify(hashDoBanco.slice(0, 10)));
console.log("Últimos caracteres:", JSON.stringify(hashDoBanco.slice(-10)));

// teste-bcrypt.js (ajuste rápido pra confirmar a hipótese)
const hashCompativel = hashDoBanco.replace(/^\$2y\$/, "$2a$");

bcrypt.compare(senhaDigitada, hashCompativel, (err, result) => {
  if (err) {
    console.error("ERRO no bcrypt.compare:", err);
    return;
  }
  console.log("Resultado da comparação (com prefixo corrigido):", result);
});

bcrypt.compare(senhaDigitada, hashDoBanco, (err, result) => {
  if (err) {
    console.error("ERRO no bcrypt.compare:", err);
    return;
  }
  console.log("Resultado da comparação:", result);
});

// Teste extra: gera um hash novo pra confirmar que o bcrypt em si funciona
bcrypt.hash(senhaDigitada, 10, (err, novoHash) => {
  if (err) {
    console.error("ERRO ao gerar hash novo:", err);
    return;
  }
  console.log("Hash novo gerado (deve começar com $2b$):", novoHash);
  bcrypt.compare(senhaDigitada, novoHash, (err2, result2) => {
    console.log("Comparação com hash novo (deve ser true):", result2);
  });
});
