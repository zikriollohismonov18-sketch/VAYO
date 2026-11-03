
/*
 VAYO Language — Cloud Integration
 Existing lessons, exams, hearts and XP are preserved.
*/

(() => {
"use strict";

const URL = "https://rgminzzmlktkliliiupt.supabase.co";
const KEY = "sb_publishable_UHJzsYIpimmjtDtHEnacQA_BJVKE2pD";
const TABLE = "vayo_language_progress";
const PROGRESS_KEY = "vayo_language_v2";

let client = null;
let user = null;
let busy = false;

const style = document.createElement("style");
style.textContent = `
#vayoCloud {
  max-width:1050px;
  margin:16px auto;
  padding:0 14px;
  font-family:Arial,sans-serif;
}
#vayoCloud .vc-card {
  background:white;
  border:1px solid #e7e4f3;
  border-radius:18px;
  padding:18px;
  margin-bottom:14px;
}
#vayoCloud .vc-title {
  font-size:21px;
  font-weight:800;
  color:#24213e;
  margin-bottom:12px;
}
#vayoCloud .vc-input {
  width:100%;
  padding:13px;
  border:1px solid #d9d5ec;
  border-radius:11px;
  margin:7px 0;
  font:inherit;
}
#vayoCloud .vc-btn {
  padding:12px 16px;
  border:0;
  border-radius:11px;
  background:#7355ef;
  color:white;
  font-weight:bold;
  cursor:pointer;
  margin:5px 5px 5px 0;
}
#vayoCloud .vc-btn:disabled {
  opacity:.5;
  cursor:wait;
}
#vayoCloud .vc-green {background:#21ae73}
#vayoCloud .vc-red {background:#ed5369}
#vayoCloud .vc-light {
  background:#eeeaff;
  color:#24213e;
}
#vayoCloud .vc-status {
  background:#f3f0ff;
  padding:12px;
  border-radius:11px;
  margin-top:12px;
  overflow-wrap:anywhere;
}
#vayoCloud .vc-error {
  background:#ffe8ed;
  color:#a51f3a;
}
#vayoCloud .vc-success {
  background:#e3f9ed;
  color:#126b43;
}
#vayoCloud .vc-hidden {display:none!important}
#vayoCloud .vc-muted {
  color:#77758b;
  font-size:14px;
  line-height:1.6;
}
#vayoCloud .vc-grid {
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:10px;
}
#vayoCloud .vc-stat {
  padding:14px;
  border-radius:12px;
  background:#f6f4ff;
  text-align:center;
}
#vayoCloud .vc-stat b {
  display:block;
  font-size:25px;
  color:#7355ef;
}
@media(max-width:480px) {
  #vayoCloud .vc-grid {grid-template-columns:1fr}
}
`;
document.head.appendChild(style);

const root = document.createElement("section");
root.id = "vayoCloud";

root.innerHTML = `
<div class="vc-card">
  <div class="vc-title">☁️ VAYO Language — Ҳисоби ман</div>

  <div id="vcConnection" class="vc-status">
    Пайвастшавӣ оғоз мешавад...
  </div>

  <div id="vcGuest">
    <p class="vc-muted">
      Барои нигоҳ доштани XP дар Supabase
      ворид шавед ё сабти ном кунед.
    </p>

    <input
      id="vcEmail"
      class="vc-input"
      type="email"
      autocomplete="email"
      placeholder="Почтаи электронӣ"
    >

    <input
      id="vcPassword"
      class="vc-input"
      type="password"
      minlength="8"
      autocomplete="current-password"
      placeholder="Парол (камаш 8 аломат)"
    >

    <button class="vc-btn" id="vcLogin">
      🔐 Ворид шудан
    </button>

    <button class="vc-btn vc-green" id="vcSignup">
      📝 Сабти ном
    </button>

    <button class="vc-btn vc-light" id="vcForgot">
      Паролро фаромӯш кардам
    </button>
  </div>

  <div id="vcRecovery" class="vc-hidden">
    <p>Пароли нави худро ворид кунед.</p>
    <input
      id="vcNewPassword"
      class="vc-input"
      type="password"
      minlength="8"
      placeholder="Пароли нав"
    >
    <button id="vcSavePassword" class="vc-btn">
      Нигоҳ доштани парол
    </button>
  </div>

  <div id="vcUser" class="vc-hidden">
    <p>
      👤 <strong id="vcUserEmail"></strong>
    </p>

    <div class="vc-grid">
      <div class="vc-stat">
        <b id="vcLocalXP">0</b>
        XP дар телефон
      </div>
      <div class="vc-stat">
        <b id="vcServerXP">0</b>
        XP дар Supabase
      </div>
    </div>

    <button class="vc-btn vc-green" id="vcSync">
      ☁️ XP-ро нигоҳ доштан
    </button>

    <button class="vc-btn vc-light" id="vcRefresh">
      🔄 Навсозӣ
    </button>

    <button class="vc-btn vc-red" id="vcLogout">
      Баромадан
    </button>
  </div>

  <div id="vcMessage" class="vc-status vc-hidden"></div>
</div>
`;

const main = document.querySelector("main");
if (main) {
  main.insertAdjacentElement("afterbegin", root);
} else {
  document.body.prepend(root);
}

const $ = id => document.getElementById(id);

function visible(id, yes) {
  $(id).classList.toggle("vc-hidden", !yes);
}

function notify(text, error=false) {
  const el = $("vcMessage");
  el.textContent = text;
  el.className =
    "vc-status " + (error ? "vc-error" : "vc-success");
}

function errorText(err) {
  const msg = err?.message || String(err);

  if (/invalid login credentials/i.test(msg))
    return "Почта ё парол нодуруст аст.";

  if (/email not confirmed/i.test(msg))
    return "Почтаи худро аввал тасдиқ кунед.";

  if (/rate limit/i.test(msg))
    return "Маҳдудияти почта. Баъдтар кӯшиш кунед.";

  return msg;
}

function getLocalData() {
  try {
    const value = JSON.parse(
      localStorage.getItem(PROGRESS_KEY) || "{}"
    );

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) return value;

  } catch (e) {
    console.warn("Local progress error:", e);
  }

  return {};
}

function getXP() {
  return Math.max(
    0,
    Math.floor(Number(getLocalData().xp) || 0)
  );
}

function getLanguage() {
  const lang = getLocalData().lang;
  return ["de","en","ru","zh","ko"].includes(lang)
    ? lang
    : "de";
}

function render() {
  const signedIn = Boolean(user);

  visible("vcGuest", !signedIn);
  visible("vcUser", signedIn);

  if (signedIn) {
    $("vcUserEmail").textContent = user.email || "";
    $("vcLocalXP").textContent = getXP();
  }
}

async function runSafely(callback) {
  if (busy) return;

  busy = true;

  const buttons = root.querySelectorAll("button");
  buttons.forEach(button => button.disabled = true);

  try {
    await callback();
  } catch (error) {
    notify("❌ " + errorText(error), true);
  } finally {
    busy = false;
    buttons.forEach(button => button.disabled = false);
  }
}

async function initialize() {
  try {
    if (!window.supabase?.createClient) {
      throw new Error("Китобхонаи Supabase бор нашуд.");
    }

    client = window.supabase.createClient(URL, KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    client.auth.onAuthStateChange((event, session) => {
      user = session?.user || null;

      if (event === "PASSWORD_RECOVERY") {
        visible("vcRecovery", true);
        visible("vcGuest", false);
        visible("vcUser", false);
      } else {
        visible("vcRecovery", false);
        render();
      }

      if (event === "SIGNED_IN" && user) {
        setTimeout(refreshXP, 0);
      }
    });

    const result = await client.auth.getSession();

    if (result.error) throw result.error;

    user = result.data.session?.user || null;

    $("vcConnection").textContent =
      "✅ Supabase омода аст";

    $("vcConnection").className =
      "vc-status vc-success";

    render();

    if (user) await refreshXP();

  } catch (error) {
    $("vcConnection").textContent =
      "❌ " + errorText(error);

    $("vcConnection").className =
      "vc-status vc-error";
  }
}

async function signup() {
  if (!client) throw new Error("Supabase омода нест.");

  const email = $("vcEmail").value.trim();
  const password = $("vcPassword").value;

  if (!email || password.length < 8) {
    throw new Error(
      "Почтаи дуруст ва пароли камаш 8-аломатӣ ворид кунед."
    );
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        window.location.origin + window.location.pathname
    }
  });

  if (error) throw error;

  if (data.session) {
    user = data.session.user;
    render();
    await refreshXP();
    notify("✅ Сабти ном иҷро шуд.");
  } else {
    notify(
      "✅ Дархост қабул шуд. Агар тасдиқи почта фаъол бошад, почтаи худро санҷед."
    );
  }
}

async function login() {
  if (!client) throw new Error("Supabase омода нест.");

  const email = $("vcEmail").value.trim();
  const password = $("vcPassword").value;

  const { data, error } =
    await client.auth.signInWithPassword({
      email,
      password
    });

  if (error) throw error;

  user = data.user;
  render();
  await refreshXP();

  notify("✅ Ба VAYO Language ворид шудед.");
}

async function forgotPassword() {
  if (!client) throw new Error("Supabase омода нест.");

  const email = $("vcEmail").value.trim();

  if (!email) {
    throw new Error("Аввал почтаро ворид кунед.");
  }

  const { error } = await client.auth.resetPasswordForEmail(
    email,
    {
      redirectTo:
        window.location.origin + window.location.pathname
    }
  );

  if (error) throw error;

  notify(
    "Агар ин почта ҳисоб дошта бошад, пайванди барқароркунӣ фиристода мешавад."
  );
}

async function savePassword() {
  if (!client) throw new Error("Supabase омода нест.");

  const password = $("vcNewPassword").value;

  if (password.length < 8) {
    throw new Error("Парол бояд камаш 8 аломат дошта бошад.");
  }

  const { error } = await client.auth.updateUser({
    password
  });

  if (error) throw error;

  visible("vcRecovery", false);
  render();

  notify("✅ Пароли нав нигоҳ дошта шуд.");
}

async function refreshXP() {
  if (!client || !user) return;

  $("vcLocalXP").textContent = getXP();

  const { data, error } = await client
    .from(TABLE)
    .select("xp")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    notify("❌ " + errorText(error), true);
    return;
  }

  $("vcServerXP").textContent =
    Math.max(0, Number(data?.xp) || 0);
}

async function syncXP() {
  if (!client || !user) {
    throw new Error("Аввал ворид шавед.");
  }

  const { data, error: readError } = await client
    .from(TABLE)
    .select("xp")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) throw readError;

  const deviceXP = getXP();
  const serverXP = Math.max(
    0,
    Number(data?.xp) || 0
  );

  const finalXP = Math.max(deviceXP, serverXP);

  const { error } = await client
    .from(TABLE)
    .upsert({
      user_id: user.id,
      xp: finalXP,
      language: getLanguage(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: "user_id"
    });

  if (error) throw error;

  $("vcServerXP").textContent = finalXP;
  $("vcLocalXP").textContent = deviceXP;

  notify(
    "✅ " + finalXP + " XP дар Supabase нигоҳ дошта шуд."
  );
}

async function logout() {
  if (!client) return;

  const { error } = await client.auth.signOut();

  if (error) throw error;

  user = null;
  render();

  notify("✅ Аз ҳисоб баромадед.");
}

$("vcSignup").addEventListener(
  "click", () => runSafely(signup)
);

$("vcLogin").addEventListener(
  "click", () => runSafely(login)
);

$("vcForgot").addEventListener(
  "click", () => runSafely(forgotPassword)
);

$("vcSavePassword").addEventListener(
  "click", () => runSafely(savePassword)
);

$("vcSync").addEventListener(
  "click", () => runSafely(syncXP)
);

$("vcRefresh").addEventListener(
  "click", () => runSafely(refreshXP)
);

$("vcLogout").addEventListener(
  "click", () => runSafely(logout)
);

initialize();

})();
