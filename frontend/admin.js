const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let leads = [], projects = [], editId = null, st = { hero: "", gallery: [], brochure: "" };
const wizardSteps = ["Project details", "Project media", "Location and links", "Configurations and floor plans"];
let wizardStep = 0;

async function api(path, o = {}) {
  const headers = { Authorization: "Bearer " + sessionStorage.tok };
  if (o.json) { o.body = JSON.stringify(o.json); headers["Content-Type"] = "application/json"; }
  const r = await fetch(path, { method: o.method || "GET", headers, body: o.body });
  if (r.status === 401 && sessionStorage.tok) { logout(); throw new Error("Session expired. Log in again."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}

// ---------- auth ----------
function logout() { sessionStorage.removeItem("tok"); $("#app").hidden = true; $("#login").hidden = false; }
async function login() {
  $("#loginMsg").textContent = "";
  try {
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("#pw").value }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Login failed");
    sessionStorage.tok = j.token; $("#pw").value = "";
    start();
  } catch (err) { $("#loginMsg").textContent = err.message; }
}
$("#loginBtn").onclick = login;
$("#togglePassword").onclick = () => {
  const input = $("#pw"), button = $("#togglePassword"), visible = input.type === "password";
  input.type = visible ? "text" : "password";
  button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
  button.setAttribute("aria-pressed", String(visible));
  button.innerHTML = visible
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a15 15 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4-.8"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  input.focus();
};
$("#pw").addEventListener("keydown", (e) => e.key === "Enter" && login());
$("#logout").onclick = logout;

function start() {
  $("#login").hidden = true; $("#app").hidden = false;
  show("leads"); loadAll();
}
function show(tab) {
  ["leads", "projects", "edit"].forEach((t) => ($("#tab-" + t).hidden = t !== tab));
  $$("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
}
$$("[data-tab]").forEach((b) => (b.onclick = () => { if (b.dataset.tab === "edit" && !editId) fillForm(); show(b.dataset.tab); }));

async function loadAll() {
  try {
    [leads, projects] = await Promise.all([api("/api/leads"), api("/api/admin/projects")]);
    renderLeads(); renderProjects();
  } catch (err) { alert(err.message); }
}

// ---------- leads ----------
function renderLeads() {
  const sel = $("#leadFilter"), cur = sel.value;
  const slugs = [...new Set(leads.map((l) => l.project_slug).filter(Boolean))];
  sel.innerHTML = `<option value="">All projects</option>` + slugs.map((s) => `<option ${s === cur ? "selected" : ""}>${esc(s)}</option>`).join("");
  const rows = getVisibleLeads();
  $("#leadCount").textContent = `${rows.length} lead${rows.length === 1 ? "" : "s"}`;
  $("#leadRows").innerHTML = rows.map((l) => `<tr>
    <td>${new Date(l.created_at).toLocaleString("en-IN")}</td>
    <td>${esc(l.name)}</td><td>${l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : "<span class=\"muted\">—</span>"}</td>
    <td><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a><br><a href="https://wa.me/91${esc(l.phone)}" target="_blank" rel="noopener">WhatsApp</a></td>
    <td>${esc(l.project_slug)}</td><td>${esc(l.configuration)}</td><td>${esc(l.message)}</td>
    <td>${esc([l.utm_source, l.utm_campaign].filter(Boolean).join(" / "))}</td>
    <td><button data-del-lead="${l.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="9">No leads yet.</td></tr>`;
}
function getVisibleLeads() {
  const slug = $("#leadFilter").value;
  return leads.filter((l) => !slug || l.project_slug === slug);
}
async function downloadLeads() {
  const rows = getVisibleLeads();
  if (!rows.length) { alert("There are no leads to export."); return; }
  const columns = [
    ["Received", (l) => l.created_at ? new Date(l.created_at).toLocaleString("en-IN") : ""],
    ["Name", (l) => l.name], ["Email", (l) => l.email], ["Phone", (l) => l.phone],
    ["Project", (l) => l.project_slug], ["Interested in", (l) => l.configuration],
    ["Message", (l) => l.message], ["Source", (l) => l.utm_source],
    ["Campaign", (l) => l.utm_campaign],
  ];
  const records = [columns.map(([label]) => label), ...rows.map((lead) => columns.map(([, value]) => value(lead)))];
  const xml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
  const columnName = (index) => {
    let name = "";
    for (index++; index; index = Math.floor((index - 1) / 26)) name = String.fromCharCode(65 + (index - 1) % 26) + name;
    return name;
  };
  const sheetRows = records.map((record, rowIndex) => `<row r="${rowIndex + 1}">${record.map((value, columnIndex) => {
    const address = `${columnName(columnIndex)}${rowIndex + 1}`;
    return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Leads" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`],
  ];
  const workbook = await zipStore(files);
  const blob = new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  const suffix = $("#leadFilter").value ? "-" + $("#leadFilter").value.replace(/[^a-z0-9-]+/gi, "-") : "";
  link.href = url; link.download = `leads${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
function zipStore(files) {
  const encoder = new TextEncoder(), chunks = [], directory = [];
  let offset = 0;
  const u16 = (value) => [value & 255, value >>> 8 & 255];
  const u32 = (value) => [value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255];
  const crc32 = (bytes) => {
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ -1) >>> 0;
  };
  for (const [path, content] of files) {
    const name = encoder.encode(path), data = encoder.encode(content), crc = crc32(data);
    const header = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    chunks.push(header, name, data);
    directory.push({ name, crc, size: data.length, offset });
    offset += header.length + name.length + data.length;
  }
  const central = [];
  for (const file of directory) {
    const header = new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(file.crc), ...u32(file.size), ...u32(file.size), ...u16(file.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(file.offset)]);
    central.push(header, file.name);
  }
  const centralSize = central.reduce((size, chunk) => size + chunk.length, 0), centralOffset = offset;
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(directory.length), ...u16(directory.length), ...u32(centralSize), ...u32(centralOffset), ...u16(0)]);
  return new Blob([...chunks, ...central, end]).arrayBuffer();
}
$("#exportLeads").onclick = downloadLeads;
$("#leadFilter").onchange = renderLeads;
$("#leadRows").addEventListener("click", async (e) => {
  const id = e.target.dataset.delLead;
  if (!id || !confirm("Delete this lead?")) return;
  try { await api("/api/leads/" + id, { method: "DELETE" }); leads = leads.filter((l) => l.id !== id); renderLeads(); } catch (err) { alert(err.message); }
});

// ---------- projects list ----------
function renderProjects() {
  $("#projRows").innerHTML = projects.map((p) => `<tr>
    <td>${esc(p.name)}<br><span class="muted">${esc(p.location)}</span></td>
    <td><a href="/${esc(p.slug)}" target="_blank" rel="noopener">/${esc(p.slug)}</a></td>
    <td>${esc(p.status)}</td>
    <td><button data-edit="${p.id}">Edit</button> <button data-del="${p.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="4">No projects yet.</td></tr>`;
}
$("#projRows").addEventListener("click", async (e) => {
  const { edit, del } = e.target.dataset;
  if (edit) { fillForm(projects.find((p) => p.id === edit)); show("edit"); }
  if (del && confirm("Delete this project? Its page will stop working.")) {
    try { await api("/api/projects/" + del, { method: "DELETE" }); await loadAll(); } catch (err) { alert(err.message); }
  }
});

// ---------- project form ----------
function addCfg(c = {}) {
  const d = document.createElement("div");
  d.className = "cfg"; d.dataset.plans = JSON.stringify(c.plans || []);
  d.innerHTML = `<div class="grid3">
      <input data-k="type" placeholder="Type, e.g. 2 BHK" value="${esc(c.type)}">
      <input data-k="size" placeholder="Size, e.g. 1350 sq.ft" value="${esc(c.size)}">
      <input data-k="price" placeholder="Price, e.g. 1.45 Cr onwards" value="${esc(c.price)}"></div>
    <label>Floor plan images (optional, up to 3)<span class="file-pick"><span class="upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></svg></span><span class="file-pick-copy"><strong>Select floor plan images</strong><small data-file-name>No files selected</small></span><input data-k="files" type="file" accept="image/*" multiple aria-label="Select floor plan images"></span></label>
    <p class="hint" data-plan-hint>${(c.plans || []).length}/3 total saved. You can add more later.</p>
    <button type="button" class="link" data-rmcfg>Remove configuration</button>`;
  $("#cfgs").append(d);
}
$("#addCfg").onclick = () => addCfg();
$("#cfgs").addEventListener("click", (e) => e.target.dataset.rmcfg !== undefined && e.target.closest(".cfg").remove());
$("#cfgs").addEventListener("change", (e) => {
  if (e.target.dataset.k !== "files") return;
  const cfg = e.target.closest(".cfg"), savedCount = JSON.parse(cfg.dataset.plans).length;
  const selected = mergePickedFiles(e.target, Math.max(0, 3 - savedCount), "A configuration can have up to 3 floor plan images.");
  cfg.querySelector("[data-plan-hint]").textContent = `${savedCount + selected.length}/3 total selected. Floor plans are optional.`;
  showPickedFiles(e.target);
});
function mergePickedFiles(input, limit, message) {
  const previous = input._pickedFiles || [];
  const seen = new Set(previous.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const incoming = [...input.files].filter((file) => !seen.has(`${file.name}:${file.size}:${file.lastModified}`));
  let combined = [...previous, ...incoming];
  if (combined.length > limit) {
    alert(`${message} You can add ${Math.max(0, limit - previous.length)} more.`);
    combined = previous;
  }
  input._pickedFiles = combined;
  const transfer = new DataTransfer();
  combined.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  return combined;
}
function showPickedFiles(input) {
  const label = input.closest("label, .file-pick");
  const name = label?.querySelector("[data-file-name]");
  if (!name) return;
  const files = [...input.files];
  name.textContent = files.length > 1 ? `${files.length} images selected: ${files.map((file) => file.name).join(", ")}` : files.length ? files[0].name : "No file selected";
  name.title = name.textContent;
}
$("#pform").addEventListener("change", (e) => {
  if (e.target.matches('input[type="file"]') && e.target.name !== "gallery" && e.target.dataset.k !== "files") showPickedFiles(e.target);
});

function renderFiles() {
  $("#heroCur").innerHTML = st.hero ? `<span class="th"><img src="${esc(st.hero)}" alt=""></span>` : "";
  $("#brochCur").innerHTML = st.brochure ? `<a href="${esc(st.brochure)}" target="_blank" rel="noopener">Current brochure</a>` : "";
  $("#galCur").innerHTML = st.gallery.map((u, i) => `<span class="th"><img src="${esc(u)}" alt=""><button type="button" data-rm="${i}">&times;</button></span>`).join("");
  const galleryInput = $("#pform").elements.gallery;
  const staged = (galleryInput._pickedFiles || []).length;
  $("#galHint").textContent = `${st.gallery.length + staged}/3 total selected. Gallery images are optional; you can add ${Math.max(0, 3 - st.gallery.length - staged)} more.`;
  galleryInput.disabled = st.gallery.length >= 3;
}
$("#pform").elements.gallery.addEventListener("change", (e) => {
  const selected = mergePickedFiles(e.target, Math.max(0, 3 - st.gallery.length), "The gallery allows up to 3 images total.");
  showPickedFiles(e.target);
  $("#galHint").textContent = `${st.gallery.length + selected.length}/3 total selected. Gallery images are optional.`;
});
$("#galCur").addEventListener("click", (e) => {
  if (e.target.dataset.rm === undefined) return;
  st.gallery.splice(+e.target.dataset.rm, 1); renderFiles();
});

function fillForm(p = {}) {
  const f = $("#pform"), E = f.elements;
  f.reset();
  $$("input[type=file]").forEach((input) => { input._pickedFiles = []; });
  $$("[data-file-name]").forEach((label) => { label.textContent = "No file selected"; label.removeAttribute("title"); });
  ["name", "slug", "builder", "location", "rera_number", "tagline", "description", "seo_title", "seo_description", "video_url", "map_link"]
    .forEach((k) => (E[k].value = p[k] ?? ""));
  E.status.value = p.status || "active";
  E.amenities.value = (p.amenities || []).join("\n");
  E.nearby.value = (p.nearby || []).map((n) => `${n.category}: ${(n.items || []).join(", ")}`).join("\n");
  st = { hero: p.hero_image || "", gallery: [...(p.gallery || [])], brochure: p.brochure_url || "" };
  $("#cfgs").innerHTML = "";
  (p.configurations && p.configurations.length ? p.configurations : [{}]).forEach(addCfg);
  editId = p.id || null;
  $("#formTitle").textContent = editId ? "Edit project" : "Add project";
  $("#formMsg").textContent = ""; renderFiles(); setWizardStep(0);
}

function setWizardStep(step) {
  wizardStep = Math.max(0, Math.min(step, wizardSteps.length - 1));
  $$('[data-wizard-step]').forEach((panel) => { panel.hidden = Number(panel.dataset.wizardStep) !== wizardStep; });
  $("#wizardProgressFill").style.width = `${((wizardStep + 1) / wizardSteps.length) * 100}%`;
  $("#wizardStepCount").textContent = `Step ${wizardStep + 1} of ${wizardSteps.length}`;
  $("#wizardStepTitle").textContent = wizardSteps[wizardStep];
  $("#wizardPrev").hidden = wizardStep === 0;
  $("#wizardNext").hidden = wizardStep === wizardSteps.length - 1;
  $(".editor-actions").hidden = wizardStep !== wizardSteps.length - 1;
  $("#wizardMsg").textContent = "";
}
$("#wizardNext").onclick = () => {
  const name = $("#pform").elements.name, slug = $("#pform").elements.slug;
  if (wizardStep === 0 && !name.value.trim()) {
    $("#wizardMsg").textContent = "Enter a project name to continue."; name.focus(); return;
  }
  if (wizardStep === 0 && !slug.value.trim()) {
    $("#wizardMsg").textContent = "Enter a page address to continue."; slug.focus(); return;
  }
  setWizardStep(wizardStep + 1);
}
$("#wizardPrev").onclick = () => setWizardStep(wizardStep - 1);

$("#pform").elements.name.addEventListener("input", (e) => {
  if (!editId) $("#pform").elements.slug.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
});

$("#pform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const E = e.target.elements, btn = $("#saveBtn"), msg = $("#formMsg");
  if (!E.name.value.trim() || !E.slug.value.trim()) { msg.className = "form-msg err"; msg.textContent = "Name and page address are required."; return; }
  if (st.gallery.length + E.gallery.files.length > 3) { msg.className = "form-msg err"; msg.textContent = "The gallery can contain up to 3 images."; return; }
  for (const cfg of $$(".cfg")) {
    if (JSON.parse(cfg.dataset.plans).length + cfg.querySelector('[data-k="files"]').files.length > 3) {
      msg.className = "form-msg err"; msg.textContent = "Each configuration can contain up to 3 floor plan images."; return;
    }
  }
  btn.disabled = true; msg.className = "form-msg ok"; msg.textContent = "Uploading files, please wait...";
  try {
    const up = async (file) => { const fd = new FormData(); fd.append("file", file); return (await api("/api/upload", { method: "POST", body: fd })).url; };
    const hero_image = E.hero.files[0] ? await up(E.hero.files[0]) : st.hero;
    const brochure_url = E.brochure.files[0] ? await up(E.brochure.files[0]) : st.brochure;
    const gallery = [...st.gallery, ...(await Promise.all([...E.gallery.files].map(up)))];

    const configurations = [];
    for (const d of $$(".cfg")) {
      const v = (k) => d.querySelector(`[data-k=${k}]`);
      const type = v("type").value.trim();
      if (!type) continue;
      const plans = [...JSON.parse(d.dataset.plans), ...(await Promise.all([...v("files").files].map(up)))];
      configurations.push({ type, size: v("size").value.trim(), price: v("price").value.trim(), plans });
    }
    const list = (s) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
    const nearby = E.nearby.value.split("\n").map((l) => {
      const i = l.indexOf(":");
      return i < 1 ? null : { category: l.slice(0, i).trim(), items: l.slice(i + 1).split(",").map((x) => x.trim()).filter(Boolean) };
    }).filter(Boolean);

    const json = {
      slug: E.slug.value.trim(), name: E.name.value.trim(), builder: E.builder.value.trim(), location: E.location.value.trim(),
      rera_number: E.rera_number.value.trim(), tagline: E.tagline.value.trim(), description: E.description.value.trim(),
      seo_title: E.seo_title.value.trim(), seo_description: E.seo_description.value.trim(),
      video_url: E.video_url.value.trim(), map_link: E.map_link.value.trim(), status: E.status.value,
      hero_image, gallery, brochure_url, amenities: list(E.amenities.value), nearby, configurations,
    };
    const saved = await api(editId ? "/api/projects/" + editId : "/api/projects", { method: editId ? "PUT" : "POST", json });
    await loadAll();
    editId = null; show("projects");
    alert(`Saved. Live at /${saved.slug}`);
  } catch (err) { msg.className = "form-msg err"; msg.textContent = err.message; }
  btn.disabled = false;
});

if (sessionStorage.tok) start();
