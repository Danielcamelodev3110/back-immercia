// =====================================================================
// ENVIO DE E-MAIL (recuperação de senha)
//
// O Render bloqueia as portas SMTP (25/465/587) nos planos gratuitos, então
// o envio é feito por API HTTPS. Configure UM dos provedores no Render
// (Environment):
//
//   Brevo  (grátis, 300 e-mails/dia, não exige domínio próprio):
//     BREVO_API_KEY   = chave da API (Brevo → SMTP & API → API Keys)
//     EMAIL_FROM      = e-mail remetente JÁ VERIFICADO no Brevo (Senders)
//
//   Resend (grátis, 100/dia — para enviar a qualquer pessoa exige domínio
//   verificado no Resend):
//     RESEND_API_KEY  = chave da API
//     EMAIL_FROM      = remetente de um domínio verificado
//
//   Opcional: EMAIL_FROM_NAME (padrão "Immersia")
// =====================================================================

const TIMEOUT_MS = 10000;

const escaparHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const TEXTOS = {
  pt: {
    assunto: "Seu código de recuperação de senha - Immersia",
    ola: (nome) => (nome ? `Olá, ${nome}!` : "Olá!"),
    intro: "Use o código abaixo para redefinir a sua senha na Immersia:",
    validade: (min) => `O código expira em ${min} minutos.`,
    aviso: "Se você não pediu a redefinição de senha, ignore este e-mail: sua senha continua a mesma.",
  },
  en: {
    assunto: "Your password reset code - Immersia",
    ola: (nome) => (nome ? `Hello, ${nome}!` : "Hello!"),
    intro: "Use the code below to reset your Immersia password:",
    validade: (min) => `The code expires in ${min} minutes.`,
    aviso: "If you didn't request a password reset, ignore this email: your password stays the same.",
  },
  es: {
    assunto: "Tu código para restablecer la contraseña - Immersia",
    ola: (nome) => (nome ? `¡Hola, ${nome}!` : "¡Hola!"),
    intro: "Usa el código de abajo para restablecer tu contraseña en Immersia:",
    validade: (min) => `El código expira en ${min} minutos.`,
    aviso: "Si no solicitaste restablecer tu contraseña, ignora este correo: tu contraseña sigue igual.",
  },
};

function montarMensagem({ idioma, nome, codigo, validadeMin }) {
  const t = TEXTOS[idioma] || TEXTOS.pt;
  const texto = `${t.ola(nome)}\n\n${t.intro}\n\n${codigo}\n\n${t.validade(validadeMin)}\n${t.aviso}\n`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#EDEAE0;font-family:Arial,Helvetica,sans-serif;color:#333">
<div style="max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<h2 style="margin:0 0 16px;color:#584128">Immersia</h2>
<p style="margin:0 0 12px">${escaparHtml(t.ola(nome))}</p>
<p style="margin:0 0 20px">${escaparHtml(t.intro)}</p>
<p style="margin:0 0 20px;text-align:center;font-size:34px;letter-spacing:8px;font-weight:bold;color:#584128">${escaparHtml(codigo)}</p>
<p style="margin:0 0 12px;color:#666">${escaparHtml(t.validade(validadeMin))}</p>
<p style="margin:0;color:#888;font-size:13px">${escaparHtml(t.aviso)}</p>
</div></body></html>`;
  return { assunto: t.assunto, texto, html };
}

async function postJson(url, headers, corpo) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(corpo),
      signal: controle.signal,
    });
    if (!resp.ok) {
      const detalhe = (await resp.text().catch(() => "")).slice(0, 300);
      throw new Error(`Provedor de e-mail respondeu ${resp.status}: ${detalhe}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

class EmailService {
  provedor() {
    if (process.env.BREVO_API_KEY && process.env.EMAIL_FROM) return "brevo";
    if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
    return null;
  }

  configurado() {
    return this.provedor() !== null;
  }

  async enviarCodigoRedefinicao({ para, nome, codigo, idioma, validadeMin }) {
    const { assunto, texto, html } = montarMensagem({ idioma, nome, codigo, validadeMin });
    const remetenteEmail = process.env.EMAIL_FROM;
    const remetenteNome = process.env.EMAIL_FROM_NAME || "Immersia";

    const provedor = this.provedor();
    if (provedor === "brevo") {
      await postJson(
        "https://api.brevo.com/v3/smtp/email",
        { "api-key": process.env.BREVO_API_KEY },
        {
          sender: { name: remetenteNome, email: remetenteEmail },
          to: [{ email: para }],
          subject: assunto,
          htmlContent: html,
          textContent: texto,
        },
      );
      return;
    }

    if (provedor === "resend") {
      await postJson(
        "https://api.resend.com/emails",
        { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        {
          from: `${remetenteNome} <${remetenteEmail}>`,
          to: [para],
          subject: assunto,
          html,
          text: texto,
        },
      );
      return;
    }

    throw new Error("Nenhum provedor de e-mail configurado.");
  }
}

module.exports = new EmailService();
