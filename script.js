// ============================================================
// Aplicación de notas de corte - JavaScript vanilla
// - Carga datos desde JSON con fetch
// - Normaliza notas y textos
// - Filtra por universidad, rama, titulación y rango de nota
// - Ordena por las 4 columnas
// ============================================================

const DATA_FILE = "./data/notas-de-corte-universidades-madrid-25-26.json";
const NOTE_MIN_LIMIT = 5;
const NOTE_MAX_LIMIT = 14;

// ---------- Estado global ----------
const state = {
  rawData: [],
  filteredData: [],
  universityOptions: [],
  branchOptions: [],
  selectedUniversities: new Set(),
  selectedBranches: new Set(),
  degreeQuery: "",
  minNote: NOTE_MIN_LIMIT,
  maxNote: NOTE_MAX_LIMIT,
  sort: {
    key: "default", // default = Universidad, Rama, Titulación ascendente
    direction: "asc"
  }
};

// ---------- Referencias al DOM ----------
const dom = {
  universityFilterBtn: document.getElementById("universityFilterBtn"),
  universityFilterText: document.getElementById("universityFilterText"),
  universityPanel: document.getElementById("universityPanel"),
  universityOptions: document.getElementById("universityOptions"),
  selectAllUniversitiesBtn: document.getElementById("selectAllUniversitiesBtn"),
  deselectAllUniversitiesBtn: document.getElementById("deselectAllUniversitiesBtn"),

  branchFilterBtn: document.getElementById("branchFilterBtn"),
  branchFilterText: document.getElementById("branchFilterText"),
  branchPanel: document.getElementById("branchPanel"),
  branchOptions: document.getElementById("branchOptions"),
  selectAllBranchesBtn: document.getElementById("selectAllBranchesBtn"),
  deselectAllBranchesBtn: document.getElementById("deselectAllBranchesBtn"),

  degreeInput: document.getElementById("degreeInput"),

  minNoteInput: document.getElementById("minNoteInput"),
  maxNoteInput: document.getElementById("maxNoteInput"),

  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  resultsCount: document.getElementById("resultsCount"),
  statusMessage: document.getElementById("statusMessage"),
  resultsBody: document.getElementById("resultsBody"),
  emptyState: document.getElementById("emptyState"),
  sortButtons: Array.from(document.querySelectorAll(".sort-btn"))
};

// ---------- Inicialización ----------
document.addEventListener("DOMContentLoaded", () => {
  setupStaticEvents();
  loadData();
});

// ---------- Carga y preparación de datos ----------
async function loadData() {
  showStatus("Cargando datos...", "info");

  try {
    const response = await fetch(DATA_FILE);

    if (!response.ok) {
      throw new Error(`No se pudo cargar el fichero JSON (${response.status}).`);
    }

    const json = await response.json();

    if (!Array.isArray(json)) {
      throw new Error("El fichero JSON no contiene un array de registros.");
    }

    state.rawData = json
      .map(normalizeRecord)
      .filter((record) => record !== null);

    if (state.rawData.length === 0) {
      throw new Error("No se han encontrado registros válidos en el JSON.");
    }

    state.universityOptions = getSortedUniqueValues(state.rawData.map((item) => item.university));
    state.branchOptions = getSortedUniqueValues(state.rawData.map((item) => item.branch));

    // Estado inicial: todas las opciones seleccionadas
    state.selectedUniversities = new Set(state.universityOptions);
    state.selectedBranches = new Set(state.branchOptions);

    renderCheckboxList(
      dom.universityOptions,
      state.universityOptions,
      state.selectedUniversities,
      "university"
    );

    renderCheckboxList(
      dom.branchOptions,
      state.branchOptions,
      state.selectedBranches,
      "branch"
    );

    updateFilterSummaries();
    updateNoteControls();
    applyFiltersAndRender();
    hideStatus();
  } catch (error) {
    console.error(error);
    showStatus(
      `Error al cargar los datos: ${error.message} ` +
      `Asegúrate de que "${DATA_FILE}" está en la misma carpeta y de abrir la aplicación desde un servidor local.`,
      "error"
    );
    dom.resultsCount.textContent = "No se pudieron cargar los datos.";
    dom.resultsBody.innerHTML = "";
    dom.emptyState.classList.add("hidden");
  }
}

// Convierte el registro original del JSON a una estructura normalizada
function normalizeRecord(item) {
  const university = safeString(item["Nombre de la Universidad"]);
  const branch = safeString(item["Rama de estudios"]);
  const degree = safeString(item["Nombre de la titulación"]);
  const noteRaw = safeString(item["Nota de corte ordinaria del grupo 1"]);
  const note = parseSpanishDecimal(noteRaw);

  if (!university || !branch || !degree || Number.isNaN(note)) {
    return null;
  }

  return {
    university,
    branch,
    degree,
    note,
    noteRaw,
    normalizedUniversity: normalizeText(university),
    normalizedBranch: normalizeText(branch),
    normalizedDegree: normalizeText(degree)
  };
}

// ---------- Eventos ----------
function setupStaticEvents() {
  // Apertura/cierre de paneles flotantes
  document.querySelectorAll("[data-filter-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const panelName = button.dataset.filterToggle;
      togglePanel(panelName);
    });
  });

  // Botones "Aplicar y cerrar"
  document.querySelectorAll("[data-close-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      closeAllPanels();
    });
  });

  // Evitar cierre al hacer clic dentro del panel
  [dom.universityPanel, dom.branchPanel].forEach((panel) => {
    panel.addEventListener("click", (event) => event.stopPropagation());
  });

  // Cierre al hacer clic fuera
  document.addEventListener("click", () => {
    closeAllPanels();
  });

  // Cierre con Escape
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllPanels();
    }
  });

  // Selectores múltiples
  dom.selectAllUniversitiesBtn.addEventListener("click", () => {
    state.selectedUniversities = new Set(state.universityOptions);
    renderCheckboxList(
      dom.universityOptions,
      state.universityOptions,
      state.selectedUniversities,
      "university"
    );
    updateFilterSummaries();
    applyFiltersAndRender();
  });

  dom.deselectAllUniversitiesBtn.addEventListener("click", () => {
    state.selectedUniversities = new Set();
    renderCheckboxList(
      dom.universityOptions,
      state.universityOptions,
      state.selectedUniversities,
      "university"
    );
    updateFilterSummaries();
    applyFiltersAndRender();
  });

  dom.selectAllBranchesBtn.addEventListener("click", () => {
    state.selectedBranches = new Set(state.branchOptions);
    renderCheckboxList(
      dom.branchOptions,
      state.branchOptions,
      state.selectedBranches,
      "branch"
    );
    updateFilterSummaries();
    applyFiltersAndRender();
  });

  dom.deselectAllBranchesBtn.addEventListener("click", () => {
    state.selectedBranches = new Set();
    renderCheckboxList(
      dom.branchOptions,
      state.branchOptions,
      state.selectedBranches,
      "branch"
    );
    updateFilterSummaries();
    applyFiltersAndRender();
  });

  // Búsqueda de titulación
  dom.degreeInput.addEventListener("input", (event) => {
    state.degreeQuery = normalizeText(event.target.value);
    applyFiltersAndRender();
  });

  // Controles de nota - inputs numéricos
  dom.minNoteInput.addEventListener("input", () => {
    let value = clampNumber(Number(dom.minNoteInput.value), NOTE_MIN_LIMIT, NOTE_MAX_LIMIT);
    if (Number.isNaN(value)) return;

    if (value > state.maxNote) value = state.maxNote;
    state.minNote = value;
    updateNoteControls();
    applyFiltersAndRender();
  });

  dom.maxNoteInput.addEventListener("input", () => {
    let value = clampNumber(Number(dom.maxNoteInput.value), NOTE_MIN_LIMIT, NOTE_MAX_LIMIT);
    if (Number.isNaN(value)) return;

    if (value < state.minNote) value = state.minNote;
    state.maxNote = value;
    updateNoteControls();
    applyFiltersAndRender();
  });

  // Ordenación
  dom.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.sort = {
        key: button.dataset.sortKey,
        direction: button.dataset.sortDirection
      };

      updateActiveSortButtons();
      applyFiltersAndRender();
    });
  });

  // Limpiar filtros
  dom.clearFiltersBtn.addEventListener("click", () => {
    resetFilters();
  });
}

// ---------- Paneles ----------
function togglePanel(panelName) {
  const isUniversity = panelName === "university";
  const button = isUniversity ? dom.universityFilterBtn : dom.branchFilterBtn;
  const panel = isUniversity ? dom.universityPanel : dom.branchPanel;
  const willOpen = panel.classList.contains("hidden");

  closeAllPanels();

  if (willOpen) {
    panel.classList.remove("hidden");
    button.setAttribute("aria-expanded", "true");
  }
}

function closeAllPanels() {
  dom.universityPanel.classList.add("hidden");
  dom.branchPanel.classList.add("hidden");
  dom.universityFilterBtn.setAttribute("aria-expanded", "false");
  dom.branchFilterBtn.setAttribute("aria-expanded", "false");
}

// ---------- Render de opciones múltiples ----------
function renderCheckboxList(container, options, selectedSet, type) {
  container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  options.forEach((optionValue) => {
    const label = document.createElement("label");
    label.className = "checkbox-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedSet.has(optionValue);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        if (type === "university") {
          state.selectedUniversities.add(optionValue);
        } else {
          state.selectedBranches.add(optionValue);
        }
      } else {
        if (type === "university") {
          state.selectedUniversities.delete(optionValue);
        } else {
          state.selectedBranches.delete(optionValue);
        }
      }

      updateFilterSummaries();
      applyFiltersAndRender();
    });

    const text = document.createElement("span");
    text.textContent = optionValue;

    label.appendChild(checkbox);
    label.appendChild(text);
    fragment.appendChild(label);
  });

  container.appendChild(fragment);
}

function updateFilterSummaries() {
  dom.universityFilterText.textContent = buildSelectionSummary(
    state.selectedUniversities,
    state.universityOptions,
    "universidad",
    "universidades"
  );

  dom.branchFilterText.textContent = buildSelectionSummary(
    state.selectedBranches,
    state.branchOptions,
    "rama",
    "ramas"
  );
}

function buildSelectionSummary(selectedSet, allOptions, singular, plural) {
  const total = allOptions.length;
  const selectedCount = selectedSet.size;

  if (total === 0) return "Sin opciones";
  if (selectedCount === total) return `Todas las ${plural}`;
  if (selectedCount === 0) return `Ninguna ${singular}`;

  if (selectedCount === 1) {
    return Array.from(selectedSet)[0];
  }

  return `${selectedCount} ${plural} seleccionadas`;
}

// ---------- Filtros y ordenación ----------
function applyFiltersAndRender() {
  const filtered = state.rawData.filter((record) => {
    const matchesUniversity = state.selectedUniversities.has(record.university);
    const matchesBranch = state.selectedBranches.has(record.branch);
    const matchesDegree =
      state.degreeQuery === "" || record.normalizedDegree.includes(state.degreeQuery);
    const matchesNote =
      record.note >= state.minNote && record.note <= state.maxNote;

    return matchesUniversity && matchesBranch && matchesDegree && matchesNote;
  });

  state.filteredData = sortRecords(filtered);
  renderTable();
  updateResultsCount();
}

function sortRecords(records) {
  const result = [...records];

  if (state.sort.key === "default") {
    return result.sort(compareDefault);
  }

  return result.sort((a, b) => {
    let primaryComparison = 0;

    switch (state.sort.key) {
      case "university":
        primaryComparison = compareTextEs(a.university, b.university);
        break;
      case "branch":
        primaryComparison = compareTextEs(a.branch, b.branch);
        break;
      case "degree":
        primaryComparison = compareTextEs(a.degree, b.degree);
        break;
      case "note":
        primaryComparison = a.note - b.note;
        break;
      default:
        primaryComparison = compareDefault(a, b);
        break;
    }

    if (primaryComparison !== 0) {
      return state.sort.direction === "asc"
        ? primaryComparison
        : -primaryComparison;
    }

    return compareDefault(a, b);
  });
}

function compareDefault(a, b) {
  return (
    compareTextEs(a.university, b.university) ||
    compareTextEs(a.branch, b.branch) ||
    compareTextEs(a.degree, b.degree)
  );
}

function updateActiveSortButtons() {
  dom.sortButtons.forEach((button) => {
    const isActive =
      state.sort.key !== "default" &&
      button.dataset.sortKey === state.sort.key &&
      button.dataset.sortDirection === state.sort.direction;

    button.classList.toggle("active", isActive);
  });
}

// ---------- Render de tabla ----------
function renderTable() {
  dom.resultsBody.innerHTML = "";

  if (state.filteredData.length === 0) {
    dom.emptyState.classList.remove("hidden");
    return;
  }

  dom.emptyState.classList.add("hidden");

  const fragment = document.createDocumentFragment();

  state.filteredData.forEach((record) => {
    const row = document.createElement("tr");

    row.appendChild(createCell(record.university));
    row.appendChild(createCell(record.branch));
    row.appendChild(createCell(record.degree));
    row.appendChild(createCell(formatNote(record.note), "note-cell"));

    fragment.appendChild(row);
  });

  dom.resultsBody.appendChild(fragment);
}

function createCell(text, extraClass = "") {
  const cell = document.createElement("td");
  if (extraClass) cell.className = extraClass;
  cell.textContent = text;
  return cell;
}

function updateResultsCount() {
  const visible = state.filteredData.length;
  const total = state.rawData.length;

  dom.resultsCount.textContent = `Mostrando ${visible} de ${total} resultados`;
}

// ---------- Nota: sincronización de UI ----------
function updateNoteControls() {
  dom.minNoteInput.value = state.minNote.toFixed(1);
  dom.maxNoteInput.value = state.maxNote.toFixed(1);
}

// ---------- Reset ----------
function resetFilters() {
  state.selectedUniversities = new Set(state.universityOptions);
  state.selectedBranches = new Set(state.branchOptions);
  state.degreeQuery = "";
  state.minNote = NOTE_MIN_LIMIT;
  state.maxNote = NOTE_MAX_LIMIT;
  state.sort = { key: "default", direction: "asc" };

  dom.degreeInput.value = "";

  renderCheckboxList(
    dom.universityOptions,
    state.universityOptions,
    state.selectedUniversities,
    "university"
  );

  renderCheckboxList(
    dom.branchOptions,
    state.branchOptions,
    state.selectedBranches,
    "branch"
  );

  updateFilterSummaries();
  updateNoteControls();
  updateActiveSortButtons();
  closeAllPanels();
  applyFiltersAndRender();
}

// ---------- Estados y mensajes ----------
function showStatus(message, type = "info") {
  dom.statusMessage.textContent = message;
  dom.statusMessage.classList.remove("hidden", "error");

  if (type === "error") {
    dom.statusMessage.classList.add("error");
  }
}

function hideStatus() {
  dom.statusMessage.classList.add("hidden");
  dom.statusMessage.textContent = "";
  dom.statusMessage.classList.remove("error");
}

// ---------- Utilidades ----------
function safeString(value) {
  return String(value ?? "").trim();
}

function parseSpanishDecimal(value) {
  const normalized = safeString(value).replace(",", ".");
  return Number.parseFloat(normalized);
}

function normalizeText(value) {
  return safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getSortedUniqueValues(values) {
  return [...new Set(values)].sort(compareTextEs);
}

function compareTextEs(a, b) {
  return a.localeCompare(b, "es", {
    sensitivity: "base",
    numeric: true
  });
}

function clampNumber(value, min, max) {
  if (Number.isNaN(value)) return NaN;
  return Math.min(Math.max(value, min), max);
}

function formatNote(value) {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
}
