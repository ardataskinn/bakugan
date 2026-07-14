const DATA = window.BAKU_DATA;
if (!DATA) {
  document.body.innerHTML = "<p style='padding:2rem;color:#e8e4da;font-family:sans-serif'>Veri yüklenemedi. Sayfayı yenile veya sunucuyu kontrol et.</p>";
  throw new Error("BAKU_DATA missing");
}

const { attributes, seasons, warriors, bakugan } = DATA;
const PAGE_SIZE = 48;
const ATTR_ORDER = Object.keys(attributes);

const state = {
  warriorSeason: "all",
  season: 1,
  attr: "all",
  query: "",
  selectedId: null,
  form: "closed",
  page: 0,
  gallerySrc: null
};

const els = {
  warriorFilters: document.getElementById("warriorSeasonFilters"),
  warriorRail: document.getElementById("warriorRail"),
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

function galleryList(b) {
  const list = [];
  const seen = new Set();
  for (const src of [b.imageOpen, b.imageClosed, ...(b.altImages || [])]) {
    if (!src || seen.has(src)) continue;
    seen.add(src);
    list.push(src);
  }
  return list;
}

function closedVisual(b) {
  const src = b.imageClosed || b.imageOpen;
  const distinct = b.imageClosed && b.imageClosed !== b.imageOpen;
  if (distinct) {
    return `<div class="form-photo">${imgTag(src, `${b.name} kapalı`, "form-img")}</div>`;
  }
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

function stageVisual(b) {
  if (state.gallerySrc) {
    return `<div class="form-photo">${imgTag(state.gallerySrc, `${b.name} galeri`, "form-img")}</div>`;
  }
  return state.form === "closed" ? closedVisual(b) : openVisual(b);
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
          <div class="trait-row">${(w.traits || []).map((t) => `<span class="trait">${t}</span>`).join("")}</div>
          <p class="warrior-partner"><strong>Partner:</strong> ${w.partner}</p>
          <p class="warrior-sig"><strong>İmza:</strong> ${w.signature}</p>
        </article>
      `;
    })
    .join("");
}

function renderSeasonTabs() {
  const tabs = [{ id: "all", label: "Tümü" }, ...seasons.map((s) => ({ id: s.id, label: `S${s.id} · ${s.code}` }))];
  els.seasonTabs.innerHTML = tabs
    .map(
      (t) =>
        `<button type="button" class="tab${String(state.season) === String(t.id) ? " is-active" : ""}" role="tab" aria-selected="${String(state.season) === String(t.id)}" data-season="${t.id}">${t.label}</button>`
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

function groupKey(b) {
  return `${b.name}::${b.season}`;
}

function sortVariants(variants) {
  return [...variants].sort(
    (a, b) => ATTR_ORDER.indexOf(a.attribute) - ATTR_ORDER.indexOf(b.attribute)
  );
}

function preferredVariant(variants) {
  if (state.selectedId) {
    const selected = variants.find((v) => v.id === state.selectedId);
    if (selected) return selected;
  }
  if (state.attr !== "all") {
    const match = variants.find((v) => v.attribute === state.attr);
    if (match) return match;
  }
  const withPartner = variants.find((v) => v.partner && v.partner !== "—");
  if (withPartner) return withPartner;
  return sortVariants(variants)[0];
}

function variantsOf(b) {
  if (!b) return [];
  return sortVariants(bakugan.filter((x) => x.name === b.name && Number(x.season) === Number(b.season)));
}

function filteredGroups() {
  const q = state.query.trim().toLowerCase();
  const byGroup = new Map();

  for (const b of bakugan) {
    if (state.season !== "all" && Number(b.season) !== Number(state.season)) continue;
    const key = groupKey(b);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(b);
  }

  const groups = [];
  for (const [, variantsRaw] of byGroup) {
    const variants = sortVariants(variantsRaw);
    if (state.attr !== "all" && !variants.some((v) => v.attribute === state.attr)) continue;

    if (q) {
      const blob = variants
        .flatMap((b) => [
          b.name,
          b.nickname,
          b.partner,
          b.form,
          b.attribute,
          attributes[b.attribute]?.name,
          attributes[b.attribute]?.tr,
          ...(b.powers || []),
          ...(b.superPowers || [])
        ])
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) continue;
    }

    groups.push({
      key: groupKey(variants[0]),
      name: variants[0].name,
      season: variants[0].season,
      variants,
      display: preferredVariant(variants)
    });
  }

  return groups;
}

function renderGrid() {
  const list = filteredGroups();
  const total = list.length;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  if (state.page > maxPage) state.page = maxPage;
  const start = state.page * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  if (!total) {
    els.bakuGrid.innerHTML = `<div class="no-results">Bu filtreye uyan bakugan yok.</div>`;
    return;
  }

  const cards = pageItems
    .map((group) => {
      const b = group.display;
      const color = attrColor(b.attribute);
      const selected = group.variants.some((v) => v.id === state.selectedId) ? " is-selected" : "";
      const attrName = attributes[b.attribute]?.name || b.attribute;
      const partnerNote = b.partner && b.partner !== "—" ? ` · ${b.partner}` : "";
      const highlightId = group.variants.some((v) => v.id === state.selectedId) ? state.selectedId : b.id;
      const variantDots =
        group.variants.length > 1
          ? `<div class="variant-dots" aria-label="${group.variants.length} element varyantı">${group.variants
              .map((v) => {
                const active = v.id === highlightId ? " is-active" : "";
                return `<i class="${active}" style="--dot:${attrColor(v.attribute)}" title="${attributes[v.attribute]?.name || v.attribute}"></i>`;
              })
              .join("")}</div>`
          : "";
      const sub =
        group.variants.length > 1
          ? `${group.variants.length} element${partnerNote}`
          : `${attrName}${partnerNote}`;

      return `
        <button type="button" class="baku-card${selected}" style="--attr:${color}" data-baku="${b.id}">
          <span class="g-badge">G ${b.gPower}</span>
          <div class="baku-visual">${cardVisual(b)}</div>
          <h3>${b.name}</h3>
          <p class="baku-sub">${sub}</p>
          ${variantDots}
          <div class="attr-pill"><i></i>${attrName}</div>
        </button>
      `;
    })
    .join("");

  const pager =
    total > PAGE_SIZE
      ? `<div class="pager">
          <button type="button" class="btn btn-ghost btn-small" data-page="prev" ${state.page <= 0 ? "disabled" : ""}>Önceki</button>
          <span class="pager-info">${start + 1}–${Math.min(start + PAGE_SIZE, total)} / ${total}</span>
          <button type="button" class="btn btn-ghost btn-small" data-page="next" ${state.page >= maxPage ? "disabled" : ""}>Sonraki</button>
        </div>`
      : `<div class="pager"><span class="pager-info">${total} bakugan</span></div>`;

  els.bakuGrid.innerHTML = cards + pager;
}

function selectBakugan(id, resetForm = true) {
  state.selectedId = id;
  if (resetForm) {
    state.form = "closed";
    state.gallerySrc = null;
  }
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
  const season = seasons.find((s) => s.id === Number(b.season));
  const closed = state.form === "closed";
  const variants = variantsOf(b);
  const gallery = galleryList(b);
  const activeGallery = state.gallerySrc || (closed ? b.imageClosed || b.imageOpen : b.imageOpen || b.imageClosed);

  const variantSwitcher =
    variants.length > 1
      ? `<div class="variant-toggle" role="group" aria-label="Element varyantı">
          ${variants
            .map((v) => {
              const a = attributes[v.attribute];
              const active = v.id === b.id ? " is-active" : "";
              return `<button type="button" data-variant="${v.id}" class="${active}" style="--attr:${attrColor(v.attribute)}" title="${a?.tr || v.attribute}">
                <i></i><span>${a?.name || v.attribute}</span>
              </button>`;
            })
            .join("")}
        </div>`
      : "";

  const galleryBlock =
    gallery.length > 1
      ? `<div class="image-gallery">
          <div class="image-gallery-head">
            <h4>Daha fazla görsel</h4>
            <span>${gallery.length}</span>
          </div>
          <div class="image-gallery-rail" role="list">
            ${gallery
              .map((src, idx) => {
                const active = src === activeGallery ? " is-active" : "";
                return `<button type="button" class="gallery-thumb${active}" data-gallery-index="${idx}" role="listitem">
                  ${imgTag(src, `${b.name} görsel ${idx + 1}`, "gallery-img")}
                </button>`;
              })
              .join("")}
          </div>
        </div>`
      : "";

  els.detailEmpty.classList.add("is-hidden");
  els.detailBody.classList.remove("is-hidden");
  els.detailBody.style.setProperty("--attr", color);

  const caption = state.gallerySrc
    ? "Galeri görseli — başka bir görsele veya Kapalı/Açık’a geçebilirsin."
    : closed
      ? b.closedNote
      : b.openNote;

  els.detailBody.innerHTML = `
    ${variantSwitcher}

    <div class="form-toggle" role="group" aria-label="Form görünümü">
      <button type="button" data-form="closed" class="${closed && !state.gallerySrc ? "is-active" : ""}">Kapalı</button>
      <button type="button" data-form="open" class="${!closed && !state.gallerySrc ? "is-active" : ""}">Açık</button>
    </div>

    <div class="form-stage">
      ${stageVisual(b)}
      <p class="form-caption">${caption}</p>
    </div>

    ${galleryBlock}

    <div class="detail-top">
      <h3>${b.name}</h3>
      <div class="detail-g">G ${b.gPower}</div>
    </div>
    <div class="detail-tags">
      <span class="tag attr">${attrLabel(b.attribute)}</span>
      <span class="tag">Sezon ${b.season}${season ? ` · ${season.code}` : ""}</span>
      <span class="tag">${b.form || "Bakugan"}</span>
    </div>
    <p class="detail-bio">${b.bio}</p>

    <div class="meta-grid">
      <div class="meta-box"><span>Partner</span><strong>${b.partner || "—"}</strong></div>
      <div class="meta-box"><span>Evrim</span><strong>${b.evolution || "—"}</strong></div>
      <div class="meta-box"><span>Element</span><strong>${attributes[b.attribute]?.desc || "—"}</strong></div>
      <div class="meta-box"><span>Varyant</span><strong>${b.nickname || b.name}</strong></div>
    </div>

    <div class="stats">
      ${Object.entries(b.stats || {})
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
      <ul class="power-list">${(b.powers || []).map((p) => `<li>${p}</li>`).join("")}</ul>
      <h4>Süper Güçler</h4>
      <ul class="power-list super">${(b.superPowers || []).map((p) => `<li>${p}</li>`).join("")}</ul>
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

els.seasonTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-season]");
  if (!btn) return;
  state.season = btn.dataset.season === "all" ? "all" : Number(btn.dataset.season);
  state.selectedId = null;
  state.page = 0;
  renderSeasonTabs();
  renderGrid();
  renderDetail();
});

els.attrFilters.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-attr-filter]");
  if (!btn) return;
  state.attr = btn.dataset.attrFilter;
  state.page = 0;
  if (state.selectedId) {
    const current = bakugan.find((x) => x.id === state.selectedId);
    if (current) {
      const pick = preferredVariant(variantsOf(current));
      if (pick) state.selectedId = pick.id;
    }
  }
  renderAttrFilters();
  renderGrid();
  renderDetail();
});

els.searchInput.addEventListener("input", () => {
  state.query = els.searchInput.value;
  state.page = 0;
  renderGrid();
});

els.bakuGrid.addEventListener("click", (e) => {
  const pageBtn = e.target.closest("[data-page]");
  if (pageBtn) {
    if (pageBtn.disabled) return;
    if (pageBtn.dataset.page === "prev") state.page -= 1;
    if (pageBtn.dataset.page === "next") state.page += 1;
    renderGrid();
    els.bakuGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const btn = e.target.closest("[data-baku]");
  if (!btn) return;
  selectBakugan(btn.dataset.baku);
});

els.detailBody.addEventListener("click", (e) => {
  const variantBtn = e.target.closest("[data-variant]");
  if (variantBtn) {
    state.gallerySrc = null;
    selectBakugan(variantBtn.dataset.variant, false);
    return;
  }
  const galleryBtn = e.target.closest("[data-gallery-index]");
  if (galleryBtn) {
    const b = bakugan.find((x) => x.id === state.selectedId);
    const src = galleryList(b || {})[Number(galleryBtn.dataset.galleryIndex)];
    if (src) {
      state.gallerySrc = src;
      renderDetail();
    }
    return;
  }
  const formBtn = e.target.closest("[data-form]");
  if (!formBtn) return;
  state.form = formBtn.dataset.form;
  state.gallerySrc = null;
  renderDetail();
});

els.menuToggle.addEventListener("click", () => {
  els.nav.classList.toggle("is-open");
});

els.nav.querySelectorAll("a").forEach((a) => {
  a.addEventListener("click", () => els.nav.classList.remove("is-open"));
});

/* ——— Boot ——— */
try {
  renderWarriorFilters();
  renderWarriors();
  renderSeasonTabs();
  renderAttrFilters();
  renderGrid();

  const first = filteredGroups()[0];
  if (first) selectBakugan(first.display.id);
} catch (err) {
  console.error(err);
  window.__bakuErr = String(err);
  const box = document.createElement("div");
  box.className = "boot-error";
  box.textContent = "Katalog yüklenirken hata: " + err.message;
  document.body.prepend(box);
}
