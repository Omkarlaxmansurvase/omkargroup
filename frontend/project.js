(() => {
  const p = window.__PROJECT__ || {};
  const e = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cfgs = p.configurations || [], am = p.amenities || [], near = p.nearby || [];
  const gal = (p.gallery && p.gallery.length ? p.gallery : p.hero_image ? [p.hero_image] : []);
  const types = cfgs.map((c) => c.type).filter(Boolean).join(" & ");
  const $ = (s) => document.querySelector(s);

  $("#brandName").textContent = p.name;
  $("#brandBy").textContent = p.builder ? "by " + p.builder : "";
  $("#projRera").textContent = p.rera_number ? `Project RERA: ${p.rera_number}` : "";
  if (p.hero_image) document.documentElement.style.setProperty("--hero", `url("${p.hero_image}")`);

  const options = (cfgs.length ? cfgs.map((c) => c.type + (c.size ? " - " + c.size : "")) : ["Not sure yet"])
    .map((o) => `<option>${e(o)}</option>`).join("");

  const nav = [
    ["configurations", "Configurations", cfgs.length], ["amenities", "Amenities", am.length],
    ["location", "Location", near.length || p.map_link], ["gallery", "Gallery", gal.length], ["contact", "Contact", 1],
  ].filter((n) => n[2]).map((n) => `<a href="#${n[0]}">${n[1]}</a>`).join("");
  $("#nav").innerHTML = nav;

  const heroForm = `
    <form class="card lead-form" data-lead-form novalidate>
      <h2>Request a private tour</h2>
      <p class="muted">We call you back within the hour.</p>
      <label>Full name<input name="name" autocomplete="name" required></label>
      <label>Phone number<input name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="10-digit mobile" required></label>
      <label>Interested in<select name="configuration">${options}</select></label>
      <button class="btn btn-gold btn-block" type="submit">Get pricing and site visit</button>
      <p class="form-msg" role="status"></p>
    </form>`;

  const unit = (c) => `
    <article class="card unit">
      <h3>${e(c.type)}</h3>
      <p class="size">${e(c.size)}</p>
      <p class="price">${e(c.price || "Price on request")}</p>
      ${(c.plans || []).length ? `<div class="plans">${c.plans.map((u, i) =>
        `<figure><img src="${e(u)}" data-zoom alt="${e(c.type)} floor plan ${i + 1}" loading="lazy"><figcaption>Plan ${i + 1}</figcaption></figure>`).join("")}</div>` : ""}
      <a class="btn btn-gold btn-block" href="#contact">Get ${e(c.type)} price</a>
    </article>`;

  const html = [
    `<section class="hero">
      <div class="hero-text">
        <p class="tag">${e([types, p.location].filter(Boolean).join(" in "))}</p>
        <h1>${e(p.name)}</h1>
        <p class="lead">${e(p.tagline)}</p>
        <div class="hero-cta">
          <a class="btn btn-gold" href="#contact">Get price and floor plans</a>
          ${p.brochure_url ? `<a class="btn btn-line" href="${e(p.brochure_url)}" target="_blank" rel="noopener">Download brochure</a>` : ""}
          <a class="btn btn-line" data-wa href="#">Chat on WhatsApp</a>
        </div>
      </div>${heroForm}
    </section>`,
    p.description ? `<section class="section" id="about"><h2>About ${e(p.name)}</h2><p class="sub about">${e(p.description)}</p>${p.video_url ? `<p><a class="btn btn-line" href="${e(p.video_url)}" target="_blank" rel="noopener">Watch video</a></p>` : ""}</section>` : "",
    cfgs.length ? `<section class="section alt" id="configurations"><h2>Configurations and floor plans</h2><p class="sub">Tap a plan to enlarge it.</p><div class="grid-2">${cfgs.map(unit).join("")}</div><p class="note">Confirm RERA carpet area and current price at the site visit.</p></section>` : "",
    am.length ? `<section class="section" id="amenities"><h2>Amenities</h2><ul class="amen">${am.map((a) => `<li>${e(a)}</li>`).join("")}</ul></section>` : "",
    near.length || p.map_link ? `<section class="section alt" id="location"><h2>Location${p.location ? " in " + e(p.location) : ""}</h2><div class="grid-3">${near.map((n) => `<div class="card"><h3>${e(n.category)}</h3><p>${e((n.items || []).join(", "))}</p></div>`).join("")}</div>${p.map_link ? `<p class="note"><a href="${e(p.map_link)}" target="_blank" rel="noopener">Open location in Google Maps</a></p>` : ""}</section>` : "",
    gal.length ? `<section class="section" id="gallery"><h2>Gallery</h2><div class="gallery">${gal.map((u, i) => `<img src="${e(u)}" data-zoom alt="${e(p.name)} image ${i + 1}" loading="lazy">`).join("")}</div><p class="note">Images are artistic impressions.</p></section>` : "",
    `<section class="section alt" id="contact"><div class="contact contact-info-only">
      <div>
        <h2>Book a site visit and get today's price</h2>
        <p class="sub">Share your number. <span data-broker></span> will call you with the price sheet, payment plan and available floors.</p>
        <p class="contact-line"><a data-call href="#">Call <span data-phone></span></a></p>
        <p class="contact-line"><a data-wa href="#">Message on WhatsApp</a></p>
      </div>
    </div></section>`,
  ].join("");

  $("#top").innerHTML = html;
})();
