// Login Google compartilhado pelos widgets "Meu dia" e "Gmail".
// O token fica só no navegador (localStorage) e vale ~1h; depois disso o widget pede um clique em "Conectar".
const QG_CLIENT_ID = "99352588861-25ueol4ga6jpp72h6ah615v0ih4p26n8.apps.googleusercontent.com";
const QG_EMAIL = "chgf312@gmail.com";
const QG_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");
const QG_KEY = "qg_google_token";

function qgLoadGis() {
  return new Promise((ok, fail) => {
    if (window.google && google.accounts && google.accounts.oauth2) return ok();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = ok;
    s.onerror = () => fail(new Error("Não carregou o login do Google"));
    document.head.appendChild(s);
  });
}

function qgSavedToken() {
  try {
    const t = JSON.parse(localStorage.getItem(QG_KEY) || "null");
    if (t && t.exp > Date.now() + 60000) return t.token;
  } catch (e) {}
  return null;
}

function qgForget() {
  try { localStorage.removeItem(QG_KEY); } catch (e) {}
}

// Precisa ser chamado a partir de um clique (o Google abre um pop-up).
async function qgConnect() {
  await qgLoadGis();
  return new Promise((ok, fail) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: QG_CLIENT_ID,
      scope: QG_SCOPES,
      login_hint: QG_EMAIL,
      callback: r => {
        if (r.error) return fail(new Error(r.error));
        try { localStorage.setItem(QG_KEY, JSON.stringify({ token: r.access_token, exp: Date.now() + r.expires_in * 1000 })); } catch (e) {}
        ok(r.access_token);
      },
      error_callback: e => fail(new Error(e.type || "popup")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

class QgAuthError extends Error {}

async function qgApi(url) {
  const token = qgSavedToken();
  if (!token) throw new QgAuthError("sem token");
  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  if (r.status === 401) { qgForget(); throw new QgAuthError("expirou"); }
  if (!r.ok) throw new Error("Google API " + r.status);
  return r.json();
}

// Monta o fluxo padrão: tenta carregar; sem login, mostra o botão "Conectar".
function qgMount({ el, load, every }) {
  async function run() {
    try {
      await load();
    } catch (e) {
      if (e instanceof QgAuthError) {
        el.innerHTML = `<div class="connect"><p>Conecte sua conta Google para ver aqui.</p><button id="qg-btn">Conectar Google</button></div>`;
        document.getElementById("qg-btn").onclick = async () => {
          try { await qgConnect(); run(); }
          catch (err) { el.querySelector("p").textContent = "Não deu para conectar (" + err.message + "). Tente de novo."; }
        };
      } else {
        el.innerHTML = `<div class="msg">Erro ao carregar: ${e.message}</div>`;
      }
    }
  }
  run();
  setInterval(() => { if (qgSavedToken()) run(); }, every);
  return run;
}
