// =====================================================================
// SCRIPT DO GOOGLE PARA ENVIAR O E-MAIL DE RECUPERAÇÃO DE SENHA
// (cole este código em https://script.google.com → Novo projeto)
//
// 1) Troque SEGREDO por uma frase longa e aleatória (a mesma vai no Render
//    como GOOGLE_SCRIPT_SECRET). Quem souber o segredo + a URL consegue
//    mandar e-mails pelo seu Gmail, então não compartilhe.
// 2) Implantar → Nova implantação → tipo "App da Web"
//      Executar como:        Eu
//      Quem pode acessar:    Qualquer pessoa
// 3) Autorize quando o Google pedir (tela "app não verificado" → Avançado
//    → Acessar). Copie a URL do app da web (termina em /exec) e coloque no
//    Render como GOOGLE_SCRIPT_URL.
//
// Se mudar o código depois, é preciso criar uma NOVA VERSÃO da implantação
// (Implantar → Gerenciar implantações → Editar → Nova versão).
// =====================================================================

const SEGREDO = "TROQUE-POR-UMA-FRASE-LONGA-E-ALEATORIA";

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);

    if (d.segredo !== SEGREDO) {
      return resposta({ ok: false, erro: "não autorizado" });
    }
    if (!d.para || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.para)) {
      return resposta({ ok: false, erro: "destinatário inválido" });
    }

    MailApp.sendEmail({
      to: d.para,
      subject: d.assunto,
      body: d.texto,
      htmlBody: d.html,
      name: d.remetenteNome || "Immersia",
    });

    return resposta({ ok: true });
  } catch (erro) {
    return resposta({ ok: false, erro: String(erro) });
  }
}

// Abrir a URL no navegador deve mostrar isto (serve só para conferir que está no ar)
function doGet() {
  return resposta({
    ok: true,
    mensagem: "Script de e-mail da Immersia no ar.",
  });
}

function resposta(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
