const { attributes, seasons, warriors, bakugan } = window.BAKU_DATA;

const state = {
  warriorSeason: "all",
  season: 1,
  attr: "all",
  query: "",
  selectedId: null,
  form: "closed"
};

const els = {
  warriorFilters: document.getElementById("warriorSeasonFilters"),
  warriorRail: document.getElementById("warriorRail"),
  seasonGrid: document.getElementById("seasonGrid"),
  seasonTabs: document.getElementById("seasonTabs"),
  attrFilters: document.getElementById("attrFilters"),
  bakuGrid: document.getElementById("bakuGrid"),
  searchInput: document.getElementById("searchInput"),
  detailEmpty: document.getElementById("detailEmpty"),
  detailBody: document.getElementById("detailBody"),
  menuToggle: document.getElementById("menuToggle"),
  nav: document.querySelector(".nav")
};

const STAT_LABELS = {
  power: "Güç",
  speed: "Hız",
  defense: "Defans",
  intel: "Zekâ",
  gForce: "G-Force"
};

function attrColor(key) {
  return attributes[key]?.color || "#c4783a";
}

function attrLabel(key) {
  const a = attributes[key];
  return a ? `${a.name} · ${a.tr}` : key;
}

function imgTag(src, alt, className) {
  if (!src) return "";
  return `<img class="${className}" src="${src}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.classList.add('is-broken')" />`;
}

function closedVisual(b) {
  const src = b.imageClosed || b.imageOpen;
  const distinct = b.imageClosed && b.imageClosed !== b.imageOpen;
  if (distinct) {
    return `<div class="form-photo">${imgTag(src, `${b.name} kapalı`, "form-img")}</div>`;
  }
  // Küre görünümü: resmi dairesel kesip hinge overlay
  return `
    <div class="sphere-photo">
      ${imgTag(b.imageOpen || src, `${b.name} kapalı küre`, "sphere-photo-img")}
      <span class="sphere-photo-hinge"></span>
      <span class="sphere-photo-shine"></span>
    </div>
  `;
}

function openVisual(b) {
  const src = b.imageOpen || b.imageClosed;
  if (!src) return `<div class="form-photo missing">Görsel yok</div>`;
  return `<div class="form-photo">${imgTag(src, `${b.name} açık`, "form-img")}</div>`;
}

function cardVisual(b) {
  const src = b.imageOpen || b.imageClosed;
  if (!src) return `<div class="mini-sphere"></div>`;
  return `<div class="card-photo">${imgTag(src, b.name, "card-img")}</div>`;
}

/* ——— Warriors ——— */
function renderWarriorFilters() {
  const opts = [
    { id: "all", label: "Tümü" },
    ...seasons.map((s) => ({ id: String(s.id), label: `S${s.id}` }))
  ];
  els.warriorFilters.innerHTML = opts
    .map(
      (o) =>
        `<button type="button" class="chip${state.warriorSeason === o.id ? " is-active" : ""}" data-wseason="${o.id}">${o.label}</button>`
    )
    .join("");
}

function renderWarriors() {
  const list =
    state.warriorSeason === "all"
      ? warriors
      : warriors.filter((w) => w.seasons.includes(Number(state.warriorSeason)));

  els.warriorRail.innerHTML = list
    .map((w) => {
      const color = attrColor(w.attribute);
      const photo = w.image
        ? `<div class="warrior-photo">${imgTag(w.image, w.name, "warrior-img")}</div>`
        : `<div class="warrior-photo warrior-photo-fallback"></div>`;
      return `
        <article class="warrior-card" style="--attr:${color}">
          ${photo}
          <div class="warrior-meta">
            <span>${attrLabel(w.attribute)}</span>
            <span>S${w.seasons.join("·")}</span>
          </div>
          <h3>${w.name}</h3>
          <p class="warrior-role">${w.role}</p>
          <p class="warrior-bio">${w.bio}</p>
          <div class="trait-row">${w.traits.map((t) => `<span class="trait">${t}</span>`).join("")}</div>
          <p class="warrior-partner"><strong>Partner:</strong> ${w.partner}</p>
          <p class="warrior-sig"><strong>İmza:</strong> ${w.signature}</p>
        </article>
      `;
    })
    .join("");
}

/* ——— Seasons ——— */
function renderSeasons() {
  els.seasonGrid.innerHTML = seasons
    .map(
      (s) => `
      <button type="button" class="season-card${state.season === s.id ? " is-active" : ""}" data-jump-season="${s.id}">
        <div class="season-code">${s.code}</div>
        <h3>Sezon ${s.id}</h3>
        <div class="season-years">${s.title} · ${s.years}</div>
        <p>${s.blurb}</p>
      </button>
    `
    )
    .join("");
}

function renderSeasonTabs() {
  els.seasonTabs.innerHTML = seasons
    .map(
      (s) =>
        `<button type="button" class="tab${state.season === s.id ? " is-active" : ""}" role="tab" aria-selected="${state.season === s.id}" data-season="${s.id}">S${s.id} · ${s.code}</button>`
    )
    .join("");
}

function renderAttrFilters() {
  const keys = ["all", ...Object.keys(attributes)];
  els.attrFilters.innerHTML = keys
    .map((key) => {
      if (key === "all") {
        return `<button type="button" class="chip${state.attr === "all" ? " is-active" : ""}" data-attr-filter="all">Tüm Elementler</button>`;
      }
      const a = attributes[key];
      return `<button type="button" class="chip${state.attr === key ? " is-active" : ""}" data-attr-filter="${key}" data-attr style="--chip-color:${a.color}">${a.name}</button>`;
    })
    .join("");
}

/* ——— Bakugan grid ——— */
function filteredBakugan() {
  const q = state.query.trim().toLowerCase();
  return bakugan.filter((b) => {
    if (b.season !== state.season) return false;
    if (state.attr !== "all" && b.attribute !== state.attr) return false;
    if (!q) return true;
    const blob = [b.name, b.nickname, b.partner, b.form, ...(b.powers || []), ...(b.superPowers || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}

function renderGrid() {
  const list = filteredBakugan();
  if (!list.length) {
    els.bakuGrid.innerHTML = `<div class="no-results">Bu filtreye uyan bakugan yok.</div>`;
    return;
  }

  els.bakuGrid.innerHTML = list
    .map((b) => {
      const color = attrColor(b.attribute);
      const selected = state.selectedId === b.id ? " is-selected" : "";
      return `
        <button type="button" class="baku-card${selected}" style="--attr:${color}" data-baku="${b.id}">
          <span class="g-badge">G ${b.gPower}</span>
          <div class="baku-visual">${cardVisual(b)}</div>
          <h3>${b.name}</h3>
          <p class="baku-sub">${b.form}${b.partner ? ` · ${b.partner}` : ""}</p>
          <div class="attr-pill"><i></i>${attributes[b.attribute].name}</div>
        </button>
      `;
    })
    .join("");
}

function selectBakugan(id, resetForm = true) {
  state.selectedId = id;
  if (resetForm) state.form = "closed";
  renderGrid();
  renderDetail();
}

function renderDetail() {
  const b = bakugan.find((x) => x.id === state.selectedId);
  if (!b) {
    els.detailEmpty.classList.remove("is-hidden");
    els.detailBody.classList.add("is-hidden");
    els.detailBody.innerHTML = "";
    return;
  }

  const color = attrColor(b.attribute);
  const season = seasons.find((s) => s.id === b.season);
  const closed = state.form === "closed";

  els.detailEmpty.classList.add("is-hidden");
  els.detailBody.classList.remove("is-hidden");
  els.detailBody.style.setProperty("--attr", color);

  els.detailBody.innerHTML = `
    <div class="form-toggle" role="group" aria-label="Form görünümü">
      <button type="button" data-form="closed" class="${closed ? "is-active" : ""}">Kapalı</button>
      <button type="button" data-form="open" class="${!closed ? "is-active" : ""}">Açık</button>
    </div>

    <div class="form-stage">
      <div class="form-closed ${closed ? "" : "is-off"}">
        ${closedVisual(b)}
      </div>
      <div class="form-open ${closed ? "is-off" : ""}">
        ${openVisual(b)}
      </div>
      <p class="form-caption">${closed ? b.closedNote : b.openNote}</p>
    </div>

    <div class="detail-top">
      <h3>${b.name}</h3>
      <div class="detail-g">G ${b.gPower}</div>
    </div>
    <div class="detail-tags">
      <span class="tag attr">${attrLabel(b.attribute)}</span>
      <span class="tag">Sezon ${b.season} · ${season?.code || ""}</span>
      <span class="tag">${b.form}</span>
    </div>
    <p class="detail-bio">${b.bio}</p>

    <div class="meta-grid">
      <div class="meta-box"><span>Partner</span><strong>${b.partner || "—"}</strong></div>
      <div class="meta-box"><span>Evrim</span><strong>${b.evolution || "—"}</strong></div>
      <div class="meta-box"><span>Element</span><strong>${attributes[b.attribute].desc}</strong></div>
      <div class="meta-box"><span>Takma ad</span><strong>${b.nickname || b.name}</strong></div>
    </div>

    <div class="stats">
      ${Object.entries(b.stats)
        .map(
          ([key, val]) => `
        <div class="stat">
          <span>${STAT_LABELS[key] || key}</span>
          <div class="stat-bar"><i style="width:${val}%"></i></div>
          <strong>${val}</strong>
        </div>`
        )
        .join("")}
    </div>

    <div class="power-block">
      <h4>Güçler</h4>
      <ul class="power-list">${b.powers.map((p) => `<li>${p}</li>`).join("")}</ul>
      <h4>Süper Güçler</h4>
      <ul class="power-list super">${b.superPowers.map((p) => `<li>${p}</li>`).join("")}</ul>
    </div>

    <p class="form-note">${closed ? b.closedNote : b.openNote}</p>
  `;

  requestAnimationFrame(() => {
    els.detailBody.querySelectorAll(".stat-bar i").forEach((el) => {
      const w = el.style.width;
      el.style.width = "0";
      requestAnimationFrame(() => {
        el.style.width = w;
      });
    });
  });
}

/* ——— Events ——— */
els.warriorFilters.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-wseason]");
  if (!btn) return;
  state.warriorSeason = btn.dataset.wseason;
  renderWarriorFilters();
  renderWarriors();
});

els.seasonGrid.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-jump-season]");
  if (!btn) return;
  state.season = Number(btn.dataset.jumpSeason);
  state.selectedId = null;
  renderSeasons();
  renderSeasonTabs();
  renderGrid();
  renderDetail();
  document.getElementById("katalog").scrollIntoView({ behavior: "smooth", block: "start" });
});

els.seasonTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-season]");
  if (!btn) return;
  state.season = Number(btn.dataset.season);
  state.selectedId = null;
  renderSeasons();
  renderSeasonTabs();
  renderGrid();
  renderDetail();
});

els.attrFilters.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-attr-filter]");
  if (!btn) return;
  state.attr = btn.dataset.attrFilter;
  renderAttrFilters();
  renderGrid();
});

els.searchInput.addEventListener("input", () => {
  state.query = els.searchInput.value;
  renderGrid();
});

els.bakuGrid.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-baku]");
  if (!btn) return;
  selectBakugan(btn.dataset.baku);
});

els.detailBody.addEventListener("click", (e) => {
  const formBtn = e.target.closest("[data-form]");
  if (!formBtn) return;
  state.form = formBtn.dataset.form;
  renderDetail();
});

els.menuToggle.addEventListener("click", () => {
  els.nav.classList.toggle("is-open");
});

els.nav.querySelectorAll("a").forEach((a) => {
  a.addEventListener("click", () => els.nav.classList.remove("is-open"));
});

/* ——— Boot ——— */
renderWarriorFilters();
renderWarriors();
renderSeasons();
renderSeasonTabs();
renderAttrFilters();
renderGrid();

const first = filteredBakugan()[0];
if (first) selectBakugan(first.id);
