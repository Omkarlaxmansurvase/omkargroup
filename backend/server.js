require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5000;
const FRONT = path.resolve(process.env.FRONTEND_DIR || path.join(__dirname, "../frontend"));
const BUCKET = "project-files";
const RESERVED = ["admin", "api", "images", "sitemap", "robots"];

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
db.storage.createBucket(BUCKET, { public: true }).then(() => {}); // no-op if it exists

app.set("trust proxy", 1);
if (process.env.FRONTEND_ORIGIN) app.use(cors({ origin: process.env.FRONTEND_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

// ---------- helpers ----------
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const requireAdmin = (req, res, next) => {
  try {
    jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const base = (req) => process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

const PROJECT_FIELDS = [
  "slug", "name", "builder", "location", "rera_number", "tagline", "description",
  "hero_image", "gallery", "brochure_url", "video_url", "map_link",
  "configurations", "amenities", "nearby", "status", "seo_title", "seo_description",
];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
const badSlug = (s) => s !== undefined && (!/^[a-z0-9-]+$/.test(s) || RESERVED.includes(s));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const leadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const ALLOWED = /^(image\/(jpeg|png|webp)|application\/pdf)$/;

// ---------- API ----------
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.post("/api/admin/login", loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!password || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "Wrong password" });
  }
  res.json({ token: jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "12h" }) });
});

app.post("/api/upload", requireAdmin, upload.single("file"), async (req, res) => {
  const f = req.file;
  if (!f || !ALLOWED.test(f.mimetype)) {
    return res.status(400).json({ error: "Upload a JPG, PNG, WebP or PDF (max 15 MB)" });
  }
  const ext = path.extname(f.originalname).toLowerCase();
  const key = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(key, f.buffer, { contentType: f.mimetype });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ url: db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl });
});

// projects: public
app.get("/api/projects", async (req, res) => {
  const { data, error } = await db.from("projects").select("*").eq("status", "active").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.get("/api/projects/:slug", async (req, res) => {
  const { data, error } = await db.from("projects").select("*").eq("slug", req.params.slug).eq("status", "active").maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Project not found" });
  res.json(data);
});

// projects: admin
app.get("/api/admin/projects", requireAdmin, async (req, res) => {
  const { data, error } = await db.from("projects").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post("/api/projects", requireAdmin, async (req, res) => {
  const body = pick(req.body, PROJECT_FIELDS);
  if (!body.slug || !body.name) return res.status(400).json({ error: "Name and slug are required" });
  if (badSlug(body.slug)) return res.status(400).json({ error: "Slug: use lowercase letters, numbers and hyphens only" });
  const { data, error } = await db.from("projects").insert(body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});
app.put("/api/projects/:id", requireAdmin, async (req, res) => {
  const body = pick(req.body, PROJECT_FIELDS);
  if (badSlug(body.slug)) return res.status(400).json({ error: "Slug: use lowercase letters, numbers and hyphens only" });
  const { data, error } = await db.from("projects").update(body).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
app.delete("/api/projects/:id", requireAdmin, async (req, res) => {
  const { error } = await db.from("projects").delete().eq("id", req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// leads
app.post("/api/leads", leadLimiter, async (req, res) => {
  const { name, phone, email, configuration, message, project_slug, utm_source, utm_campaign } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: "Name and phone are required" });
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: "Invalid phone number" });
  const { error } = await db.from("leads").insert({
    name: String(name).slice(0, 100),
    phone,
    email: email ? String(email).slice(0, 150) : null,
    configuration,
    message: message ? String(message).slice(0, 1000) : null,
    project_slug,
    utm_source,
    utm_campaign,
  });
  if (error) return res.status(500).json({ error: "Could not save lead" });
  res.status(201).json({ success: true });
});
app.get("/api/leads", requireAdmin, async (req, res) => {
  const { data, error } = await db.from("leads").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.delete("/api/leads/:id", requireAdmin, async (req, res) => {
  const { error } = await db.from("leads").delete().eq("id", req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// ---------- pages ----------
app.use(express.static(FRONT));
app.get("/admin/laxman", (req, res) => res.sendFile(path.join(FRONT, "admin.html")));

app.get("/robots.txt", (req, res) =>
  res.type("text").send(`User-agent: *\nDisallow: /admin/\nSitemap: ${base(req)}/sitemap.xml\n`));

app.get("/sitemap.xml", async (req, res) => {
  const { data } = await db.from("projects").select("slug").eq("status", "active");
  const b = base(req);
  const urls = [`${b}/`, ...(data || []).map((p) => `${b}/${p.slug}`)];
  res.type("xml").send(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
      .map((u) => `<url><loc>${esc(u)}</loc></url>`).join("")}</urlset>`);
});

// each project gets its own URL and its own title / description / share image
app.get("/:slug", async (req, res, next) => {
  const s = req.params.slug;
  if (!/^[a-z0-9-]+$/.test(s) || RESERVED.includes(s)) return next();
  const { data: p } = await db.from("projects").select("*").eq("slug", s).eq("status", "active").maybeSingle();
  if (!p) return next();

  const b = base(req);
  const abs = (u) => (!u ? "" : /^https?:/.test(u) ? u : b + u);
  const types = (p.configurations || []).map((c) => c.type).filter(Boolean).join(" & ");
  const title = p.seo_title || [p.name, [types, p.location].filter(Boolean).join(" in ")].filter(Boolean).join(" | ");
  const desc = (p.seo_description || p.tagline || p.description || "").replace(/\s+/g, " ").slice(0, 160);

  const html = fs.readFileSync(path.join(FRONT, "project.html"), "utf8")
    .replaceAll("{{TITLE}}", esc(title))
    .replaceAll("{{DESC}}", esc(desc))
    .replaceAll("{{URL}}", esc(`${b}/${s}`))
    .replaceAll("{{IMAGE}}", esc(abs(p.hero_image)))
    .replace("{{DATA}}", () => JSON.stringify(p).replace(/</g, "\\u003c"));
  res.send(html);
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => res.status(400).json({ error: err.message }));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));