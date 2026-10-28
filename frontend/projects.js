(() => {
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  let allProjects = [];

  const broker = CONFIG.BROKER_NAME || "Your property consultant";
  document.querySelectorAll("[data-footer-broker]").forEach((node) => node.textContent = broker);
  $("#currentYear").textContent = new Date().getFullYear();
  const phone = String(CONFIG.PHONE || "").replace(/\D/g, "");
  document.querySelectorAll("[data-home-call]").forEach((link) => {
    if (phone) {
      link.href = `tel:+${phone}`;
      link.querySelector("[data-home-phone]")?.replaceChildren(document.createTextNode(`+${phone}`));
    } else link.hidden = true;
  });
  document.querySelectorAll("[data-home-email]").forEach((link) => {
    if (CONFIG.EMAIL) { link.href = `mailto:${encodeURIComponent(CONFIG.EMAIL)}`; link.textContent = CONFIG.EMAIL; }
    else link.hidden = true;
  });
  document.querySelectorAll("[data-home-whatsapp]").forEach((link) => {
    const number = String(CONFIG.WHATSAPP || "").replace(/\D/g, "");
    if (number) link.href = `https://wa.me/${number}`;
    else link.hidden = true;
  });

  const uniqueValues = (values) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const customSelects = new WeakMap();
  const fillSelect = (select, firstLabel, values) => {
    select.innerHTML = `<option value="">${firstLabel}</option>` + values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
    customSelects.get(select)?.refresh();
  };

  function enhanceSelect(select) {
    const wrapper = document.createElement("div");
    wrapper.className = "project-custom-select";
    const label = select.closest("label");
    const labelText = [...(label?.childNodes || [])].find((node) => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || "Filter";
    select.classList.add("project-select-native");
    select.tabIndex = -1;
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "project-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", `${labelText} filter`);
    const value = document.createElement("span");
    const caret = document.createElement("span");
    caret.className = "project-select-caret";
    caret.setAttribute("aria-hidden", "true");
    trigger.append(value, caret);

    const menu = document.createElement("div");
    menu.className = "project-select-menu";
    menu.id = `${select.id}-options`;
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", labelText);
    menu.hidden = true;
    trigger.setAttribute("aria-controls", menu.id);
    wrapper.append(trigger, menu);

    const close = (returnFocus = false) => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      wrapper.classList.remove("is-open");
      if (returnFocus) trigger.focus();
    };
    const refresh = () => {
      value.textContent = select.selectedOptions[0]?.textContent || "Choose";
      menu.innerHTML = [...select.options].map((option) => `<button type="button" class="project-select-option" role="option" aria-selected="${option.value === select.value}" data-select-value="${esc(option.value)}">${esc(option.textContent)}</button>`).join("");
    };
    const open = (focusSelected = false) => {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      wrapper.classList.add("is-open");
      if (focusSelected) (menu.querySelector('[aria-selected="true"]') || menu.querySelector("button"))?.focus();
    };
    trigger.addEventListener("click", () => menu.hidden ? open() : close());
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); open(true); }
    });
    wrapper.addEventListener("focusout", (event) => {
      if (!wrapper.contains(event.relatedTarget)) close();
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-select-value]");
      if (!option) return;
      select.value = option.dataset.selectValue;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      refresh();
      close(true);
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); close(true); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const options = [...menu.querySelectorAll("button")];
        const index = options.indexOf(document.activeElement);
        options[(index + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length]?.focus();
      }
    });
    select.addEventListener("change", refresh);
    document.addEventListener("pointerdown", (event) => { if (!wrapper.contains(event.target)) close(); });
    refresh();
    customSelects.set(select, { refresh });
  }

  document.querySelectorAll(".project-filter-grid select").forEach(enhanceSelect);

  function renderAmenityOptions() {
    const amenities = uniqueValues(allProjects.flatMap((project) => project.amenities || []));
    $("#amenityOptions").innerHTML = amenities.length ? amenities.map((amenity, index) => {
      const id = `amenity-${index}`;
      return `<label class="amenity-option" for="${id}"><input id="${id}" type="checkbox" value="${esc(amenity)}"><span>${esc(amenity)}</span></label>`;
    }).join("") : `<span class="muted">No amenity details available.</span>`;
  }

  const projectCard = (project) => {
    const types = (project.configurations || []).map((configuration) => configuration.type).filter(Boolean);
    const prices = (project.configurations || []).map((configuration) => configuration.price).filter(Boolean);
    const amenities = (project.amenities || []).filter(Boolean);
    return `<a class="home-project-card" href="/${esc(project.slug)}">
      <div class="home-project-image">${project.hero_image ? `<img src="${esc(project.hero_image)}" alt="${esc(project.name)}" loading="lazy">` : `<img src="/images/facade.jpg" alt="Residential project" loading="lazy">`}<span class="home-image-arrow" aria-hidden="true">↗</span></div>
      <div class="home-project-info"><p class="home-project-location">${esc(project.location || "Navi Mumbai")}</p><h3>${esc(project.name)}</h3>
        ${project.builder ? `<p class="browse-builder">${esc(project.builder)}</p>` : ""}
        <p class="home-project-types">${esc(types.join(" · ") || "Configuration details available on project page")}</p>
        ${prices.length ? `<p class="browse-price">${esc(prices.join(" · "))}</p>` : ""}
        ${amenities.length ? `<p class="browse-amenities">${esc(amenities.slice(0, 3).join(" · "))}${amenities.length > 3 ? ` <span>+${amenities.length - 3} more</span>` : ""}</p>` : ""}
        <span class="home-project-link">View project details <span aria-hidden="true">→</span></span>
      </div>
    </a>`;
  };

  function renderProjects() {
    const query = $("#projectSearch").value.trim().toLocaleLowerCase();
    const location = $("#locationFilter").value;
    const configuration = $("#configurationFilter").value;
    const builder = $("#builderFilter").value;
    const selectedAmenities = [...document.querySelectorAll("#amenityOptions input:checked")].map((input) => input.value.toLocaleLowerCase());
    let filtered = allProjects.filter((project) => {
      const projectAmenities = (project.amenities || []).map((item) => String(item).toLocaleLowerCase());
      const searchText = [project.name, project.builder, project.location, project.tagline, project.description,
        ...(project.configurations || []).flatMap((item) => [item.type, item.size, item.price]),
        ...projectAmenities, ...(project.nearby || []).flatMap((item) => [item.category, ...(item.items || [])])]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      return (!query || searchText.includes(query))
        && (!location || project.location === location)
        && (!builder || project.builder === builder)
        && (!configuration || (project.configurations || []).some((item) => item.type === configuration))
        && selectedAmenities.every((amenity) => projectAmenities.includes(amenity));
    });

    const sort = $("#sortProjects").value;
    if (sort === "name") filtered.sort((a, b) => String(a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    if (sort === "location") filtered.sort((a, b) => String(a.location || "").localeCompare(b.location || "", undefined, { sensitivity: "base" }));
    if (sort === "amenities") filtered.sort((a, b) => (b.amenities || []).length - (a.amenities || []).length);
    if (sort === "configurations") filtered.sort((a, b) => (b.configurations || []).length - (a.configurations || []).length);

    $("#projectResultsCount").textContent = `${filtered.length} ${filtered.length === 1 ? "project" : "projects"} found`;
    $("#allProjectList").innerHTML = filtered.length
      ? filtered.map(projectCard).join("")
      : `<div class="project-no-results"><strong>No projects match these filters.</strong><span>Try changing your search or clearing some filters.</span></div>`;
    $("#amenitySelectionCount").textContent = selectedAmenities.length ? `${selectedAmenities.length} selected` : "Choose amenities";
  }

  ["#projectSearch", "#locationFilter", "#configurationFilter", "#builderFilter", "#sortProjects"].forEach((selector) => {
    $(selector).addEventListener(selector === "#projectSearch" ? "input" : "change", renderProjects);
  });
  $("#amenityOptions").addEventListener("change", renderProjects);
  $("#clearProjectFilters").addEventListener("click", () => {
    $("#projectSearch").value = "";
    $("#locationFilter").value = "";
    $("#configurationFilter").value = "";
    $("#builderFilter").value = "";
    $("#sortProjects").value = "newest";
    document.querySelectorAll("#amenityOptions input").forEach((input) => input.checked = false);
    renderProjects();
  });

  fetch("/api/projects").then((response) => {
    if (!response.ok) throw new Error("Projects could not be loaded");
    return response.json();
  }).then((data) => {
    allProjects = Array.isArray(data) ? data : [];
    fillSelect($("#locationFilter"), "All locations", uniqueValues(allProjects.map((project) => project.location)));
    fillSelect($("#configurationFilter"), "All configurations", uniqueValues(allProjects.flatMap((project) => (project.configurations || []).map((item) => item.type))));
    fillSelect($("#builderFilter"), "All builders", uniqueValues(allProjects.map((project) => project.builder)));
    renderAmenityOptions();
    renderProjects();
  }).catch(() => {
    $("#projectResultsCount").textContent = "Projects unavailable";
    $("#allProjectList").innerHTML = `<div class="project-no-results"><strong>We couldn’t load the projects.</strong><span>Please try again in a little while.</span></div>`;
    $("#amenityOptions").textContent = "Amenity filters are unavailable.";
  });
})();
