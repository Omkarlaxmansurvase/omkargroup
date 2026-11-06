(() => {
  const button = document.querySelector(".home-menu-btn");
  const nav = document.querySelector(".home-nav");
  if (!button || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  };

  button.addEventListener("click", () => setOpen(button.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!nav.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) setOpen(false);
  });
})();
