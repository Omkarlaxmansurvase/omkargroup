// Fill broker details from config.js
const waText = encodeURIComponent("Hi, I'm interested in National Mount View, Akurli.");
document.querySelectorAll("[data-wa]").forEach(a => {
  a.href = `https://wa.me/${CONFIG.WHATSAPP}?text=${waText}`;
  a.target = "_blank";
  a.rel = "noopener";
});
document.querySelectorAll("[data-call]").forEach(a => (a.href = `tel:+${CONFIG.PHONE}`));
document.querySelectorAll("[data-phone]").forEach(el => (el.textContent = `+${CONFIG.PHONE}`));
document.querySelectorAll("[data-broker]").forEach(el => (el.textContent = CONFIG.BROKER_NAME));
document.querySelectorAll("[data-rera]").forEach(el => (el.textContent = CONFIG.BROKER_RERA));

// Header background on scroll
const header = document.getElementById("header");
const onScroll = () => header.classList.toggle("solid", window.scrollY > 40);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// Mobile menu
const nav = document.getElementById("nav");
const menuBtn = document.getElementById("menuBtn");
menuBtn.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", open);
});
nav.addEventListener("click", e => {
  if (e.target.tagName === "A") {
    nav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
  }
});

// Lightbox
const lb = document.getElementById("lightbox");
const lbImg = lb.querySelector("img");
document.querySelectorAll("[data-zoom]").forEach(img => {
  img.addEventListener("click", () => {
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lb.hidden = false;
  });
});
lb.addEventListener("click", () => (lb.hidden = true));
document.addEventListener("keydown", e => {
  if (e.key === "Escape") lb.hidden = true;
});

// Lead forms
const params = new URLSearchParams(location.search);
document.querySelectorAll("[data-lead-form]").forEach(form => {
  const msg = form.querySelector(".form-msg");
  const btn = form.querySelector("button[type=submit]");
  const show = (text, ok) => {
    msg.textContent = text;
    msg.className = "form-msg " + (ok ? "ok" : "err");
  };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const phone = String(data.phone || "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");

    if (!data.name.trim()) return show("Enter your name.", false);
    if (!/^[6-9]\d{9}$/.test(phone)) return show("Enter a valid 10-digit mobile number.", false);

    btn.disabled = true;
    show("Sending...", true);
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          phone,
          email: data.email || undefined,
          configuration: data.configuration,
          message: data.message || undefined,
          project_slug: (window.__PROJECT__ || {}).slug || CONFIG.PROJECT_SLUG,
          utm_source: params.get("utm_source") || undefined,
          utm_campaign: params.get("utm_campaign") || undefined
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Request failed");
      form.reset();
      show("Thank you. We will call you shortly.", true);
    } catch (err) {
      show("Could not send. Please call or WhatsApp us instead.", false);
    } finally {
      btn.disabled = false;
    }
  });
});
