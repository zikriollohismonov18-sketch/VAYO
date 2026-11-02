
/*
 VAYO — Маркази эълонҳо ва реклама
 Файл: pages/announcements-admin.js
 Кодҳои пешинаро тағйир намедиҳад.
*/
(function () {
  "use strict";

  const URL = "https://rgminzzmlktkliliiupt.supabase.co";
  const KEY = "sb_publishable_UHJzsYIpimmjtDtHEnacQA_BJVKE2pD";

  const client = window.supabase?.createClient(URL, KEY);

  let announcements = [];
  let editingId = null;
  let saving = false;

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    if (className) node.className = className;
    return node;
  }

  function button(text, callback, color) {
    const b = el("button", text);
    b.type = "button";
    b.style.cssText =
      "padding:10px 14px;border:0;border-radius:9px;" +
      "background:" + (color || "#ff6900") +
      ";color:white;cursor:pointer;font-weight:600";
    b.addEventListener("click", callback);
    return b;
  }

  function field(label, type, id, placeholder) {
    const wrap = el("div");
    const lbl = el("label", label);
    lbl.htmlFor = id;
    lbl.style.cssText =
      "display:block;font-weight:600;margin-bottom:6px";

    let input;
    if (type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 4;
    } else {
      input = document.createElement("input");
      input.type = type;
    }

    input.id = id;
    input.placeholder = placeholder || "";
    input.style.cssText =
      "width:100%;padding:11px;border:1px solid #ddd;" +
      "border-radius:9px;font:inherit;box-sizing:border-box";

    wrap.append(lbl, input);
    return wrap;
  }

  function selectField(label, id, choices) {
    const wrap = el("div");
    const lbl = el("label", label);
    lbl.htmlFor = id;
    lbl.style.cssText =
      "display:block;font-weight:600;margin-bottom:6px";

    const select = document.createElement("select");
    select.id = id;
    select.style.cssText =
      "width:100%;padding:11px;border:1px solid #ddd;" +
      "border-radius:9px;background:white";

    for (const [value, title] of choices) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = title;
      select.appendChild(option);
    }

    wrap.append(lbl, select);
    return wrap;
  }

  function get(id) {
    return document.getElementById(id);
  }

  function status(text, isError) {
    const node = get("vayoAnnouncementStatus");
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? "#b91c1c" : "#15803d";
  }

  function toLocalDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const local = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );
    return local.toISOString().slice(0, 16);
  }

  function toISO(value) {
    return value ? new Date(value).toISOString() : null;
  }

  function optionalURL(value) {
    const text = value.trim();
    if (!text) return null;

    const parsed = new URL(text, location.origin);

    if (
      parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" &&
        parsed.hostname === "localhost")
    ) {
      throw new Error("Танҳо пайванди HTTPS иҷозат аст.");
    }

    return parsed.href;
  }

  function clearForm() {
    editingId = null;
    get("vaTitle").value = "";
    get("vaMessage").value = "";
    get("vaType").value = "info";
    get("vaAudience").value = "all";
    get("vaImage").value = "";
    get("vaLink").value = "";
    get("vaStart").value = "";
    get("vaEnd").value = "";
    get("vaActive").checked = true;
    get("vaSave").textContent = "Нашр кардани эълон";
    status("Эълони нав");
  }

  function editAnnouncement(item) {
    editingId = item.id;

    get("vaTitle").value = item.title || "";
    get("vaMessage").value = item.message || "";
    get("vaType").value = item.type || "info";
    get("vaAudience").value = item.audience || "all";
    get("vaImage").value = item.image_url || "";
    get("vaLink").value = item.link_url || "";
    get("vaStart").value = toLocalDateTime(item.starts_at);
    get("vaEnd").value = toLocalDateTime(item.ends_at);
    get("vaActive").checked = !!item.active;

    get("vaSave").textContent = "Нигоҳ доштани тағйирот";
    status("Таҳрири эълон: " + item.title);

    get("vayoAnnouncementAdmin").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function saveAnnouncement() {
    if (saving) return;

    const title = get("vaTitle").value.trim();
    const message = get("vaMessage").value.trim();

    if (!title || !message) {
      status("Сарлавҳа ва матнро пур кун.", true);
      return;
    }

    try {
      saving = true;
      get("vaSave").disabled = true;

      const start = toISO(get("vaStart").value);
      const end = toISO(get("vaEnd").value);

      if (start && end && new Date(end) <= new Date(start)) {
        throw new Error(
          "Санаи анҷом бояд баъд аз санаи оғоз бошад."
        );
      }

      const params = {
        p_id: editingId,
        p_title: title,
        p_message: message,
        p_type: get("vaType").value,
        p_image_url: optionalURL(get("vaImage").value),
        p_link_url: optionalURL(get("vaLink").value),
        p_audience: get("vaAudience").value,
        p_active: get("vaActive").checked,
        p_starts_at: start,
        p_ends_at: end
      };

      const { error } = await client.rpc(
        "vayo_admin_save_announcement",
        params
      );

      if (error) throw error;

      clearForm();
      await loadAnnouncements();
      status("Эълон бомуваффақият нигоҳ дошта шуд.");

    } catch (error) {
      status(error.message || "Хатои сабт", true);
    } finally {
      saving = false;
      get("vaSave").disabled = false;
    }
  }

  async function toggleAnnouncement(item) {
    const newValue = !item.active;

    try {
      const { error } = await client.rpc(
        "vayo_admin_toggle_announcement",
        {
          p_id: item.id,
          p_active: newValue
        }
      );

      if (error) throw error;

      await loadAnnouncements();
      status(
        newValue
          ? "Эълон фаъол шуд."
          : "Эълон хомӯш шуд."
      );
    } catch (error) {
      status(error.message || "Хато", true);
    }
  }

  async function deleteAnnouncement(item) {
    if (!confirm(
      'Эълони "' + item.title + '" пурра нест карда шавад?'
    )) return;

    try {
      const { error } = await client.rpc(
        "vayo_admin_delete_announcement",
        { p_id: item.id }
      );

      if (error) throw error;

      if (editingId === item.id) clearForm();

      await loadAnnouncements();
      status("Эълон нест карда шуд.");

    } catch (error) {
      status(error.message || "Хато", true);
    }
  }

  function renderAnnouncements() {
    const list = get("vaList");
    list.replaceChildren();

    if (!announcements.length) {
      list.appendChild(el("p", "Ҳоло ягон эълон нест."));
      return;
    }

    for (const item of announcements) {
      const card = el("div");

      card.style.cssText =
        "border:1px solid #e5e7eb;border-radius:12px;" +
        "padding:16px;margin-bottom:12px;background:#fafafa";

      const title = el("h3", item.title);
      title.style.margin = "0 0 10px";

      const message = el("p", item.message);
      message.style.whiteSpace = "pre-wrap";

      const state = el(
        "p",
        item.active
          ? "● Фаъол (бо назардошти муҳлат)"
          : "● Хомӯш"
      );
      state.style.color = item.active
        ? "#15803d"
        : "#b91c1c";

      const details = el(
        "p",
        "Навъ: " + item.type +
        " | Ҷой: " + item.audience
      );
      details.style.cssText =
        "font-size:13px;color:#64748b";

      const actions = el("div");
      actions.style.cssText =
        "display:flex;gap:8px;flex-wrap:wrap";

      actions.append(
        button("Таҳрир", () => editAnnouncement(item), "#2563eb"),
        button(
          item.active ? "Хомӯш кардан" : "Фаъол кардан",
          () => toggleAnnouncement(item),
          item.active ? "#64748b" : "#16a34a"
        ),
        button(
          "Нест кардан",
          () => deleteAnnouncement(item),
          "#dc2626"
        )
      );

      card.append(title, state, message, details, actions);
      list.appendChild(card);
    }
  }

  async function loadAnnouncements() {
    const { data, error } = await client.rpc(
      "vayo_admin_list_announcements"
    );

    if (error) {
      status(error.message, true);
      return;
    }

    announcements = Array.isArray(data) ? data : [];
    renderAnnouncements();
  }

  function buildPanel() {
    if (get("vayoAnnouncementAdmin")) return;

    const dashboard = get("dashboard");
    if (!dashboard) return;

    const panel = el("section");
    panel.id = "vayoAnnouncementAdmin";
    panel.style.cssText =
      "background:white;border-radius:15px;padding:20px;" +
      "margin:22px 0;box-shadow:0 3px 15px #00000010";

    const heading = el(
      "h2",
      "📢 Маркази эълонҳо ва рекламаи VAYO"
    );

    const description = el(
      "p",
      "Эълонҳои техникӣ, хабарҳо ва рекламаҳоро " +
      "аз ҳамин ҷо идора кун."
    );

    const grid = el("div");
    grid.style.cssText =
      "display:grid;grid-template-columns:" +
      "repeat(auto-fit,minmax(240px,1fr));gap:15px";

    grid.append(
      field("Сарлавҳа", "text", "vaTitle", "Масалан: Корҳои техникӣ"),
      selectField("Навъи эълон", "vaType", [
        ["info", "Хабар"],
        ["warning", "Огоҳӣ"],
        ["maintenance", "Корҳои техникӣ"],
        ["advertisement", "Реклама"]
      ]),
      selectField("Ҷойи намоиш", "vaAudience", [
        ["all", "Дар ҳама саҳифаҳои пайвастшуда"],
        ["home", "Саҳифаи асосӣ"],
        ["seller", "Панели фурӯшанда"],
        ["customer", "Саҳифаҳои харидор"]
      ]),
      field("Сурати реклама (URL)", "url", "vaImage", "https://..."),
      field("Пайванди реклама (URL)", "url", "vaLink", "https://..."),
      field("Санаи оғоз (ихтиёрӣ)", "datetime-local", "vaStart"),
      field("Санаи анҷом (ихтиёрӣ)", "datetime-local", "vaEnd")
    );

    const messageField = field(
      "Матни эълон",
      "textarea",
      "vaMessage",
      "Матни эълонро навис..."
    );

    const activeWrap = el("label");
    activeWrap.style.cssText =
      "display:flex;align-items:center;gap:10px;margin:15px 0";

    const active = document.createElement("input");
    active.type = "checkbox";
    active.id = "vaActive";
    active.checked = true;
    active.style.width = "auto";

    activeWrap.append(
      active,
      el("span", "Эълон фаъол бошад")
    );

    const actions = el("div");
    actions.style.cssText =
      "display:flex;gap:10px;flex-wrap:wrap";

    const save = button(
      "Нашр кардани эълон",
      saveAnnouncement,
      "#ff6900"
    );
    save.id = "vaSave";

    actions.append(
      save,
      button("Эълони нав", clearForm, "#64748b"),
      button("Навсозӣ", loadAnnouncements, "#2563eb")
    );

    const feedback = el("p");
    feedback.id = "vayoAnnouncementStatus";
    feedback.setAttribute("role", "status");

    const listHeading = el("h3", "Эълонҳои сабтшуда");
    const list = el("div");
    list.id = "vaList";

    panel.append(
      heading,
      description,
      grid,
      messageField,
      activeWrap,
      actions,
      feedback,
      document.createElement("hr"),
      listHeading,
      list
    );

    dashboard.appendChild(panel);
  }

  async function init() {
    if (!client) return;

    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) return;

    const admin = await client.rpc("vayo_is_admin");
    if (admin.error || admin.data !== true) return;

    buildPanel();
    await loadAnnouncements();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
