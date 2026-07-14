#!/usr/bin/env node
/**
 * Re-assign attribute-specific + alternate images using wiki API + local cache.
 * Prefer exact Attr+Name files; never pick a wrong-attribute filename.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.js");
const CACHE_PATH = path.join(ROOT, "scripts", ".image-cache.json");
const API = "https://bakugan.fandom.com/api.php";

const ATTR_LABEL = {
  pyrus: "Pyrus",
  aquos: "Aquos",
  ventus: "Ventus",
  subterra: "Subterra",
  haos: "Haos",
  darkus: "Darkus"
};
const ATTRS = Object.keys(ATTR_LABEL);

const EVO_WORDS = [
  "helix",
  "titanium",
  "lumino",
  "fusion",
  "neo",
  "delta",
  "ultimate",
  "blitz",
  "mercury",
  "iron",
  "hyper",
  "ultra",
  "typhoon",
  "perfect",
  "infinity",
  "cross",
  "mutant",
  "mock",
  "deka",
  "torpedor",
  "genesis",
  "geogan",
  "colossus",
  "destroyer",
  "commandix",
  "meta",
  "sky and gaia",
  "sky & gaia"
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = API + "?" + new URLSearchParams({ ...params, format: "json" });
  const res = await fetch(url, {
    headers: { "User-Agent": "BakuArenaCatalog/1.1 (fan catalog; local)" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return { searches: {}, urls: {} };
  }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

async function searchFiles(query, cache, { force = false, pages = 3 } = {}) {
  const key = query.toLowerCase();
  if (!force && cache.searches[key]?.length) return cache.searches[key];
  if (!force && Array.isArray(cache.searches[key]) && cache.searches[key].length === 0) {
    // retry empty once when force not set — still allow refresh with force
  }
  const titles = [];
  let sroffset = 0;
  for (let page = 0; page < pages; page++) {
    const params = {
      action: "query",
      list: "search",
      srsearch: query,
      srnamespace: "6",
      srlimit: "50"
    };
    if (sroffset) params.sroffset = String(sroffset);
    const data = await api(params);
    for (const h of data?.query?.search || []) titles.push(h.title);
    if (!data.continue?.sroffset) break;
    sroffset = data.continue.sroffset;
    await sleep(70);
  }
  cache.searches[key] = [...new Set(titles)];
  await sleep(80);
  return cache.searches[key];
}

async function resolveUrls(titles, cache) {
  const uniq = [...new Set(titles)];
  const missing = uniq.filter((t) => cache.urls[t] === undefined);
  for (let i = 0; i < missing.length; i += 45) {
    const chunk = missing.slice(i, i + 45);
    const data = await api({
      action: "query",
      titles: chunk.join("|"),
      prop: "imageinfo",
      iiprop: "url|size|mime"
    });
    for (const p of Object.values(data?.query?.pages || {})) {
      const ii = (p.imageinfo || [])[0];
      if (!ii?.url || p.missing != null || (ii.mime && !String(ii.mime).startsWith("image/"))) {
        cache.urls[p.title] = null;
        continue;
      }
      cache.urls[p.title] = {
        url: ii.url.replace(/\/revision\/latest\/scale-to-width-down\/\d+/, "/revision/latest"),
        size: ii.size || 0
      };
    }
    await sleep(80);
  }
  return uniq
    .map((t) => {
      const hit = cache.urls[t];
      if (!hit) return null;
      return { title: t, url: hit.url, size: hit.size };
    })
    .filter(Boolean);
}

function tokens(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function fileMatchesName(title, name) {
  const file = title.replace(/^File:/i, "").toLowerCase();
  const toks = tokens(name);
  return toks.length > 0 && toks.every((t) => file.includes(t));
}

function otherAttrInFile(fileLower, attribute) {
  return ATTRS.filter((a) => a !== attribute).filter((a) => fileLower.includes(a));
}

function scoreFile(title, name, attribute, kind) {
  if (!fileMatchesName(title, name)) return -9999;
  const file = title.replace(/^File:/i, "");
  const lower = file.toLowerCase();
  const nameLower = name.toLowerCase();
  const attr = ATTR_LABEL[attribute];
  const attrLower = attr.toLowerCase();

  // Hard reject: another attribute mentioned without ours
  const others = otherAttrInFile(lower, attribute);
  const hasOwn = lower.includes(attrLower);
  if (others.length && !hasOwn) return -9999;

  let score = 5;
  if (hasOwn) score += 70;
  else score -= 25;

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${attr}\\b[\\s_-]*${escaped}`, "i").test(file)) score += 35;
  if (new RegExp(`${escaped}[\\s_-]*\\b${attr}\\b`, "i").test(file)) score += 25;

  // Extra words between attr and name (Torpedor Dragonoid) — only when name is short base
  if (hasOwn && nameLower === "dragonoid") {
    if (/torpedor|typhoon|genesis|mercury|neo|helix|titanium|lumino|fusion|blitz|iron|hyper|ultra|meta|commandix|colossus|destroyer/i.test(file)) {
      score -= 80;
    }
  }

  if (kind === "open") {
    if (/\b(closed|ball|sphere)\b/i.test(file)) score -= 40;
    if (/\b(open|standing|anime)\b/i.test(file)) score += 30;
    if (/bk_cd_/i.test(file) && hasOwn) score += 15;
    if (/bk_cd_/i.test(file) && !hasOwn) score -= 5;
  } else {
    if (/\b(closed|ball|sphere)\b/i.test(file)) score += 50;
    if (/\b(open|standing)\b/i.test(file)) score -= 30;
  }

  if (!EVO_WORDS.some((e) => nameLower.includes(e))) {
    for (const e of EVO_WORDS) {
      if (lower.includes(e)) score -= 40;
    }
  }

  if (/battle\s*planet|bakulog|packaging|mockup|factsheet|bakuboost|geogan rising/i.test(file)) score -= 35;
  if (/x_aquos|x_pyrus|_x_/i.test(file)) score -= 20;

  return score;
}

function rank(resolved, name, attribute, kind) {
  return resolved
    .map((r) => ({
      ...r,
      score: scoreFile(r.title, name, attribute, kind) + Math.min(6, Math.log10((r.size || 1) + 1))
    }))
    .filter((r) => r.score >= 40) // require attr-ish quality
    .sort((a, b) => b.score - a.score);
}

function rankLoose(resolved, name, attribute, kind) {
  return resolved
    .map((r) => ({
      ...r,
      score: scoreFile(r.title, name, attribute, kind) + Math.min(6, Math.log10((r.size || 1) + 1))
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

function probeTitles(name, attribute) {
  const A = ATTR_LABEL[attribute];
  const n = name;
  const variants = [
    `File:${A} ${n}.jpg`,
    `File:${A} ${n}.png`,
    `File:${A} ${n}.JPG`,
    `File:${A} ${n}.jpeg`,
    `File:${A}_${n}.jpg`,
    `File:${A}_${n}.png`,
    `File:${A}-${n}.jpg`,
    `File:${A} ${n} Open.jpg`,
    `File:${A} ${n} Open.png`,
    `File:${A} ${n} Closed.jpg`,
    `File:${A} ${n} Closed.png`,
    `File:${A} ${n} (Open).png`,
    `File:${A} ${n} (Ball Open).png`,
    `File:${A}_${n}_Open.jpg`,
    `File:BK_CD_${n.replace(/\s+/g, "")}.jpg`,
    `File:${n} ${A}.jpg`,
    `File:${n}_${A}.jpg`,
    `File:${A}${n}.png`,
    `File:${A}${n}.jpg`
  ];
  return variants;
}

async function filesForEntry(name, attribute, cache) {
  const titles = new Set();
  const queries = [
    `${ATTR_LABEL[attribute]} ${name}`,
    `"${ATTR_LABEL[attribute]} ${name}"`,
    `${ATTR_LABEL[attribute]}_${name}`,
    name
  ];
  for (const q of queries) {
    const forceEmpty = Array.isArray(cache.searches[q.toLowerCase()]) && cache.searches[q.toLowerCase()].length === 0;
    for (const t of await searchFiles(q, cache, { force: forceEmpty, pages: forceEmpty || q.includes(ATTR_LABEL[attribute]) ? 3 : 2 })) {
      titles.add(t);
    }
  }
  for (const t of probeTitles(name, attribute)) titles.add(t);
  return resolveUrls([...titles], cache);
}

function wikiLatest(url) {
  return url ? url.replace(/\/revision\/latest\/scale-to-width-down\/\d+/, "/revision/latest") : url;
}

function siblingsShare(url, siblings, field) {
  if (!url) return true;
  return siblings.filter((s) => s[field] === url).length > 1;
}

function hasAttr(url, attribute) {
  return String(url || "")
    .toLowerCase()
    .includes((ATTR_LABEL[attribute] || attribute).toLowerCase());
}

async function main() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const m = raw.match(/window\.BAKU_DATA\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!m) throw new Error("Could not parse data.js");
  const data = JSON.parse(m[1]);
  const bakugan = data.bakugan;
  const cache = loadCache();

  const byGroup = new Map();
  for (const b of bakugan) {
    const key = `${b.name}::${b.season}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(b);
  }

  // Prioritize multi-attr groups + anything with wrong-attr image
  const queue = [...bakugan].sort((a, b) => {
    const ga = (byGroup.get(`${a.name}::${a.season}`) || []).length;
    const gb = (byGroup.get(`${b.name}::${b.season}`) || []).length;
    return gb - ga;
  });

  let updatedOpen = 0;
  let updatedClosed = 0;
  let altsAdded = 0;
  let i = 0;

  for (const b of queue) {
    i += 1;
    const siblings = byGroup.get(`${b.name}::${b.season}`) || [b];
    process.stdout.write(`[${i}/${queue.length}] ${b.id}… `);

    let resolved = [];
    try {
      resolved = await filesForEntry(b.name, b.attribute, cache);
    } catch (err) {
      console.log("ERR", err.message);
      continue;
    }

    const openStrict = rank(resolved, b.name, b.attribute, "open");
    const openLoose = rankLoose(resolved, b.name, b.attribute, "open");
    const closedStrict = rank(resolved, b.name, b.attribute, "closed");
    const closedLoose = rankLoose(resolved, b.name, b.attribute, "closed");

    const pickOpen = openStrict[0] || openLoose[0];
    const pickClosed = closedStrict[0] || closedLoose[0];

    const currentBad =
      !b.imageOpen ||
      siblingsShare(b.imageOpen, siblings, "imageOpen") ||
      otherAttrInFile(String(b.imageOpen).toLowerCase(), b.attribute).length > 0;

    if (pickOpen?.url && (currentBad || (hasAttr(pickOpen.url, b.attribute) && !hasAttr(b.imageOpen, b.attribute)))) {
      // Prefer strict attr match when available
      const next = (openStrict[0] || pickOpen).url;
      if (next !== b.imageOpen) {
        b.imageOpen = next;
        updatedOpen += 1;
      }
    }

    const closedBad =
      !b.imageClosed ||
      siblingsShare(b.imageClosed, siblings, "imageClosed") ||
      otherAttrInFile(String(b.imageClosed).toLowerCase(), b.attribute).length > 0 ||
      b.imageClosed === siblings.find((s) => s.attribute !== b.attribute)?.imageClosed;

    if (pickClosed?.url && closedBad) {
      const next = (closedStrict[0] || pickClosed).url;
      if (next !== b.imageClosed) {
        b.imageClosed = next;
        updatedClosed += 1;
      }
    }

    const pool = [...openLoose, ...closedLoose]
      .filter((r) => r.url && (r.size || 0) > 3500 && r.score > 0)
      .sort((a, c) => c.score - a.score);

    const alts = [];
    const seen = new Set([wikiLatest(b.imageOpen), wikiLatest(b.imageClosed)].filter(Boolean));
    for (const r of pool) {
      const u = wikiLatest(r.url);
      if (seen.has(u)) continue;
      // Prefer same attribute in alts, but allow neutrals
      const lower = r.title.toLowerCase();
      if (otherAttrInFile(lower, b.attribute).length && !lower.includes(ATTR_LABEL[b.attribute].toLowerCase())) continue;
      seen.add(u);
      alts.push(u);
      if (alts.length >= 8) break;
    }
    b.altImages = alts;
    if (alts.length) altsAdded += 1;

    console.log(`ok open=${hasAttr(b.imageOpen, b.attribute) ? "attr" : "gen"} alts=${alts.length}`);
    if (i % 20 === 0) saveCache(cache);
  }

  saveCache(cache);
  fs.writeFileSync(
    DATA_PATH,
    "/* Bakugan fan katalog — attribute varyantları dahil */\nwindow.BAKU_DATA = " + JSON.stringify(data, null, 2) + ";\n"
  );

  let multi = 0;
  let stillShared = 0;
  let mismatch = 0;
  for (const siblings of byGroup.values()) {
    if (siblings.length < 2) continue;
    multi += 1;
    if (new Set(siblings.map((s) => s.imageOpen)).size === 1) stillShared += 1;
  }
  for (const b of bakugan) {
    if (otherAttrInFile(String(b.imageOpen).toLowerCase(), b.attribute).length && !hasAttr(b.imageOpen, b.attribute)) mismatch += 1;
  }
  console.log(JSON.stringify({ updatedOpen, updatedClosed, altsAdded, multi, stillShared, mismatch }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
