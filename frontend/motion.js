// Visual-only enhancements: scroll reveals, header state, scroll progress, hero parallax, nav scrollspy.
// Nothing here touches data, filters, forms or links.
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector(".home-header");

  // Scroll progress bar
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.prepend(bar);

  // Reveal on scroll
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" })
    : null;
  const watch = (el) => {
    if (!io || reduce) el.classList.add("is-visible");
    else io.observe(el);
  };
  document.querySelectorAll("[data-reveal]").forEach(watch);

  // Dynamic lists (project cards, locations) are rendered after fetch / on every filter change
  ["#list", "#locationList", "#allProjectList"].forEach((selector) => {
    const host = document.querySelector(selector);
    if (!host) return;
    const tag = () => {
      [...host.children].forEach((child, i) => {
        if (child.hasAttribute("data-reveal")) return;
        child.setAttribute("data-reveal", "");
        child.style.setProperty("--d", `${Math.min(i, 8) * 0.07}s`);
        watch(child);
      });
    };
    new MutationObserver(tag).observe(host, { childList: true });
    tag();
  });

  // Hero image parallax
  const heroImg = document.querySelector(".home-hero-media img");

  // Scrollspy for in-page nav
  const navLinks = [...document.querySelectorAll('.home-nav a[href^="#"]')];
  const spy = navLinks.length && "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${entry.target.id}`));
        });
      }, { rootMargin: "-45% 0px -50% 0px" })
    : null;
  if (spy) navLinks.forEach((a) => {
    const section = document.querySelector(a.getAttribute("href"));
    if (section) spy.observe(section);
  });

  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (header) header.classList.toggle("scrolled", y > 8);
    if (heroImg && !reduce && y < 900) heroImg.style.transform = `translate3d(0, ${(y * 0.06).toFixed(1)}px, 0) scale(1.08)`;
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();