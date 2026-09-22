// ---------------------------------------------------------------------
// PokéDex Unit — talks to PokeAPI (https://pokeapi.co), no key required.
// ---------------------------------------------------------------------

const API_ROOT = "https://pokeapi.co/api/v2";
const PAGE_SIZE = 24;

const el = {
  status: document.getElementById("status"),
  grid: document.getElementById("grid"),
  loadMoreBtn: document.getElementById("load-more"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  typeSelect: document.getElementById("type-select"),
  resetBtn: document.getElementById("reset-btn"),
  countLabel: document.getElementById("count-label"),
  modalOverlay: document.getElementById("modal-overlay"),
  modalBody: document.getElementById("modal-body"),
  modalClose: document.getElementById("modal-close"),
};

// Browsing state. `mode` is "all" (default list), "type" (filtered by
// type), or "search" (single result). `names` holds the full ordered
// list of pokémon names for the current mode; `offset` tracks how far
// into that list we've rendered.
const state = {
  mode: "all",
  names: [],
  offset: 0,
  loading: false,
};

init();

async function init() {
  await populateTypeDropdown();
  await loadAllPokemonIndex();
  await renderNextPage();

  el.searchForm.addEventListener("submit", onSearchSubmit);
  el.typeSelect.addEventListener("change", onTypeChange);
  el.resetBtn.addEventListener("click", onReset);
  el.loadMoreBtn.addEventListener("click", renderNextPage);
  el.modalClose.addEventListener("click", closeModal);
  el.modalOverlay.addEventListener("click", (e) => {
    if (e.target === el.modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

// -------------------- data loading --------------------

// Pull the full name index once (lightweight: ~1300 name+url pairs).
async function loadAllPokemonIndex() {
  const res = await fetchJSON(`${API_ROOT}/pokemon?limit=100000&offset=0`);
  state.names = res.results.map((p) => p.name);
}

async function populateTypeDropdown() {
  try {
    const res = await fetchJSON(`${API_ROOT}/type`);
    const usable = res.results.filter(
      (t) => t.name !== "unknown" && t.name !== "shadow"
    );
    for (const t of usable) {
      const opt = document.createElement("option");
      opt.value = t.name;
      opt.textContent = capitalize(t.name);
      el.typeSelect.appendChild(opt);
    }
  } catch (err) {
    console.error("Could not load type list", err);
  }
}

// Render the next PAGE_SIZE names from state.names, starting at state.offset.
async function renderNextPage() {
  if (state.loading) return;
  if (state.offset >= state.names.length) {
    el.loadMoreBtn.hidden = true;
    return;
  }
  state.loading = true;
  setStatus(state.offset === 0 ? "Scanning region…" : "Scanning next batch…");
  el.loadMoreBtn.disabled = true;

  const batch = state.names.slice(state.offset, state.offset + PAGE_SIZE);
  try {
    const details = await Promise.all(batch.map(fetchPokemonSummary));
    details.forEach((p) => p && renderCard(p));
    state.offset += batch.length;
    setStatus("");
    updateCountLabel();
    el.loadMoreBtn.hidden = state.offset >= state.names.length;
  } catch (err) {
    console.error(err);
    setStatus("Signal lost — couldn't reach PokéAPI. Try again.", true);
  } finally {
    state.loading = false;
    el.loadMoreBtn.disabled = false;
  }
}

async function fetchPokemonSummary(nameOrId) {
  try {
    const p = await fetchJSON(`${API_ROOT}/pokemon/${nameOrId}`);
    return {
      id: p.id,
      name: p.name,
      sprite:
        p.sprites?.other?.["official-artwork"]?.front_default ||
        p.sprites?.front_default,
      types: p.types.map((t) => t.type.name),
    };
  } catch {
    return null;
  }
}

// -------------------- rendering --------------------

function renderCard(p) {
  const card = document.createElement("div");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Flip card for ${p.name}`);

  card.innerHTML = `
    <div class="card__inner">
      <div class="card__face card__face--front">
        <span class="card__id">#${String(p.id).padStart(3, "0")}</span>
        <span class="card__sprite">
          ${p.sprite ? `<img src="${p.sprite}" alt="" loading="lazy" />` : "?"}
        </span>
        <span class="card__name">${p.name}</span>
        <span class="card__types">
          ${p.types
            .map((t) => `<span class="badge t-${t}">${t}</span>`)
            .join("")}
        </span>
        <span class="card__flip-hint">tap to flip ↻</span>
      </div>
      <div class="card__face card__face--back">
        <p class="screen__status card__back-status">Loading…</p>
      </div>
    </div>
  `;

  card.addEventListener("click", () => toggleFlip(card, p.name));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleFlip(card, p.name);
    }
  });

  el.grid.appendChild(card);
}

const STAT_ABBR = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
  "special-attack": "SPA",
  "special-defense": "SPD",
  speed: "SPE",
};

const detailCache = new Map();

async function toggleFlip(card, name) {
  card.classList.toggle("is-flipped");
  if (!card.classList.contains("is-flipped") || card.dataset.loaded) return;

  const back = card.querySelector(".card__face--back");
  try {
    const detail = detailCache.get(name) || (await fetchPokemonStatBlock(name));
    detailCache.set(name, detail);
    back.innerHTML = buildBackFace(detail);
    card.dataset.loaded = "true";
    back.querySelector(".card__more-link")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(name);
    });
  } catch (err) {
    console.error(err);
    back.innerHTML = `<p class="screen__status error card__back-status">Couldn't load stats.</p>`;
  }
}

async function fetchPokemonStatBlock(name) {
  const p = await fetchJSON(`${API_ROOT}/pokemon/${name}`);
  return {
    id: p.id,
    name: p.name,
    stats: p.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
    abilities: p.abilities.map((a) => a.ability.name.replace(/-/g, " ")),
  };
}

function buildBackFace(detail) {
  return `
    <span class="card__id">#${String(detail.id).padStart(3, "0")}</span>
    <span class="card__name">${detail.name}</span>
    <div class="mini-stats">
      ${detail.stats
        .map(
          (s) => `
        <div class="mini-stat-row">
          <span class="mini-stat-row__label">${
            STAT_ABBR[s.name] || s.name
          }</span>
          <span class="mini-stat-row__track"><span class="mini-stat-row__fill" style="width:${Math.min(
            100,
            s.value
          )}%"></span></span>
          <span class="mini-stat-row__value">${s.value}</span>
        </div>`
        )
        .join("")}
    </div>
    <p class="card__abilities">${detail.abilities.join(", ")}</p>
    <button type="button" class="card__more-link">Full entry →</button>
  `;
}

function clearGrid() {
  el.grid.innerHTML = "";
}

function setStatus(text, isError = false) {
  el.status.textContent = text;
  el.status.classList.toggle("error", isError);
  el.status.hidden = !text;
}

function updateCountLabel() {
  const shown = el.grid.children.length;
  const total = state.names.length;
  el.countLabel.textContent =
    state.mode === "search" ? "" : `Showing ${shown} of ${total}`;
}

// -------------------- interactions --------------------

async function onSearchSubmit(e) {
  e.preventDefault();
  const query = el.searchInput.value.trim().toLowerCase();
  if (!query) return;

  el.typeSelect.value = "";
  state.mode = "search";
  clearGrid();
  el.loadMoreBtn.hidden = true;
  setStatus(`Looking up "${query}"…`);

  const result = await fetchPokemonSummary(query);
  if (!result) {
    setStatus(`No entry found for "${query}". Check the spelling or ID.`, true);
    el.countLabel.textContent = "";
    return;
  }
  setStatus("");
  renderCard(result);
  el.countLabel.textContent = "1 result";
}

async function onTypeChange() {
  const type = el.typeSelect.value;
  el.searchInput.value = "";

  if (!type) {
    onReset();
    return;
  }

  state.mode = "type";
  state.offset = 0;
  clearGrid();
  setStatus(`Filtering by ${type} type…`);

  try {
    const res = await fetchJSON(`${API_ROOT}/type/${type}`);
    state.names = res.pokemon.map((entry) => entry.pokemon.name);
    setStatus(state.names.length ? "" : "No Pokémon found for that type.");
    await renderNextPage();
  } catch (err) {
    console.error(err);
    setStatus("Couldn't load that type. Try again.", true);
  }
}

async function onReset() {
  state.mode = "all";
  state.offset = 0;
  el.searchInput.value = "";
  el.typeSelect.value = "";
  clearGrid();
  await loadAllPokemonIndex();
  await renderNextPage();
}

// -------------------- modal --------------------

async function openModal(name) {
  el.modalOverlay.hidden = false;
  el.modalBody.innerHTML = `<p class="screen__status">Loading entry…</p>`;

  try {
    const p = await fetchJSON(`${API_ROOT}/pokemon/${name}`);
    const species = await fetchJSON(p.species.url).catch(() => null);
    const flavor =
      species?.flavor_text_entries?.find((f) => f.language.name === "en")
        ?.flavor_text?.replace(/\f|\n/g, " ") || "";

    const sprite =
      p.sprites?.other?.["official-artwork"]?.front_default ||
      p.sprites?.front_default;

    el.modalBody.innerHTML = `
      <div class="modal__head">
        <div class="modal__sprite">
          ${sprite ? `<img src="${sprite}" alt="" />` : "?"}
        </div>
        <div>
          <p class="modal__id">#${String(p.id).padStart(3, "0")}</p>
          <h2 class="modal__name" id="modal-name">${p.name}</h2>
          <div class="modal__types">
            ${p.types
              .map(
                (t) =>
                  `<span class="badge t-${t.type.name}">${t.type.name}</span>`
              )
              .join("")}
          </div>
        </div>
      </div>

      ${flavor ? `<p class="meta-line">${escapeHtml(flavor)}</p>` : ""}

      <p class="meta-line"><strong>Height:</strong> ${(p.height / 10).toFixed(
        1
      )} m &nbsp; <strong>Weight:</strong> ${(p.weight / 10).toFixed(1)} kg</p>
      <p class="meta-line"><strong>Abilities:</strong> ${p.abilities
        .map((a) => a.ability.name.replace(/-/g, " "))
        .join(", ")}</p>

      <p class="modal__section-title">Base stats</p>
      ${p.stats.map((s) => statRow(s.stat.name, s.base_stat)).join("")}

      <p class="modal__section-title">Sample moves</p>
      <p class="moves-list">${p.moves
        .slice(0, 10)
        .map((m) => m.move.name.replace(/-/g, " "))
        .join(", ") || "—"}</p>
    `;
  } catch (err) {
    console.error(err);
    el.modalBody.innerHTML = `<p class="screen__status error">Couldn't load that entry. Try again.</p>`;
  }
}

function statRow(label, value) {
  const pct = Math.min(100, Math.round((value / 180) * 100));
  return `
    <div class="stat-row">
      <span class="stat-row__label">${label.replace(/-/g, " ")}</span>
      <span class="stat-row__track"><span class="stat-row__fill" style="width:${pct}%"></span></span>
      <span class="stat-row__value">${value}</span>
    </div>
  `;
}

function closeModal() {
  el.modalOverlay.hidden = true;
  el.modalBody.innerHTML = "";
}

// -------------------- helpers --------------------

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${url}`);
  return res.json();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
