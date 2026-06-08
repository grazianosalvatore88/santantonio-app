import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  fetchAllData,
  EMPTY_DATA,
  adminLogin,
  getSessionUser,
  dbAddCeraiolo,
  dbDeleteCeraiolo,
  dbUpsertPezzo,
  dbDeletePezzo,
  dbAddManicchia,
  dbDeleteManicchia,
  dbDeleteMutaRows,
  dbSaveMuta,
  dbImportRows,
} from "./dataApi";

const ASSET = "/assets/";

const assets = {
  logoMenuHome: `${ASSET}logo-menu-home.png`,
  palazzoBg: `${ASSET}palazzo-bg.png`,
  paperTexture: `${ASSET}paper-texture.png`,
  loginBg: `${ASSET}login-bg.png`,
  barella: `${ASSET}icon-barella.png`,
  user: `${ASSET}icon-user.png`,
  ceraiolo: `${ASSET}icon-ceraiolo.png`,
  calendar: `${ASSET}icon-calendar.png`,
  lock: `${ASSET}icon-lock.png`,
  admin: `${ASSET}icon-admin.png`,
  manicchie: `${ASSET}icon-manicchie.png`,
  importa: `${ASSET}icon-importa.png`,
  arrow: `${ASSET}icon-arrow.png`,
  pezzi: `${ASSET}icon-pezzi.png`,
};

const POSIZIONI_BASE = [
  "Punta avanti SX",
  "Ceppo avanti SX",
  "Ceppo dietro SX",
  "Punta dietro SX",
  "Punta avanti DX",
  "Ceppo avanti DX",
  "Ceppo dietro DX",
  "Punta dietro DX",
];

const POSIZIONI_LEFT = POSIZIONI_BASE.slice(0, 4);
const POSIZIONI_RIGHT = POSIZIONI_BASE.slice(4, 8);
const POSIZIONI_EXTRA = ["Capo 10", "Capo 5"];

const MANICCHIA_BASE = {
  id: "torre-calzolari",
  nome: "Torre dei Calzolari",
};

const TIPI_CERO = ["grande", "mezzano"];

const TIPO_CERO_LABEL = {
  grande: "Cero Grande",
  mezzano: "Cero Mezzano",
};

// Struttura mute ufficiale per ogni tipo di cero.
// Ogni "pezzo" raggruppa una o più mute.
const PEZZI_GRANDE = [
  { nome: "Alzatella", mute: ["Alzatella"] },
  { nome: "Bargello", mute: ["Bargello"] },
  { nome: "Buchetto", mute: ["Buchetto 1", "Buchetto 2", "Buchetto 3"] },
  { nome: "Monte", mute: ["Monte Lapide", "Monte Curva"] },
];

const PEZZI_MEZZANO = [
  { nome: "Bargello", mute: ["Bargello 1", "Bargello 2"] },
  { nome: "Buchetto", mute: ["Buchetto 1", "Buchetto 2"] },
  { nome: "Monte", mute: ["Monte Lapide", "Monte Curva", "Monte 3"] },
];

const PEZZI_TEMPLATE = { grande: PEZZI_GRANDE, mezzano: PEZZI_MEZZANO };

function buildBasePezzi(manicchiaId = "torre-calzolari") {
  const pezzi = [];
  TIPI_CERO.forEach((tipoCero) => {
    PEZZI_TEMPLATE[tipoCero].forEach((p) => {
      pezzi.push({
        id: `${tipoCero[0]}-${slugify(p.nome)}`,
        manicchiaId,
        tipoCero,
        nome: p.nome,
        mute: [...p.mute],
      });
    });
  });
  return pezzi;
}

const PEZZI_BASE = buildBasePezzi();

const CERAIOLI_BASE = [
  // 1-6 → attivi nel Grande (Argento). 1-3 fanno anche il Mezzano.
  { id: 1, manicchiaId: "torre-calzolari", nome: "Marco", cognome: "Rossi", soprannome: "Rosso" },
  { id: 2, manicchiaId: "torre-calzolari", nome: "Luca", cognome: "Brugnoni", soprannome: "Brugo" },
  { id: 3, manicchiaId: "torre-calzolari", nome: "Giorgio", cognome: "Martini", soprannome: "Gio" },
  { id: 4, manicchiaId: "torre-calzolari", nome: "Paolo", cognome: "Torelli", soprannome: "" },
  { id: 5, manicchiaId: "torre-calzolari", nome: "Andrea", cognome: "Bianchi", soprannome: "Bolo" },
  { id: 6, manicchiaId: "torre-calzolari", nome: "Simone", cognome: "Rinaldi", soprannome: "" },
  // 7-9 → ex Grande (Oro): presenti fino al 2023, non più nel 2024.
  { id: 7, manicchiaId: "torre-calzolari", nome: "Matteo", cognome: "Fabbri", soprannome: "" },
  { id: 8, manicchiaId: "torre-calzolari", nome: "Davide", cognome: "Mancini", soprannome: "Manci" },
  { id: 9, manicchiaId: "torre-calzolari", nome: "Roberto", cognome: "Galli", soprannome: "" },
  // 10-12 → solo Mezzano (Bronzo).
  { id: 10, manicchiaId: "torre-calzolari", nome: "Filippo", cognome: "Conti", soprannome: "Pippo" },
  { id: 11, manicchiaId: "torre-calzolari", nome: "Tommaso", cognome: "Vitali", soprannome: "" },
  { id: 12, manicchiaId: "torre-calzolari", nome: "Edoardo", cognome: "Sereni", soprannome: "Edo" },
];

const ADMIN_BASE = [
  {
    id: "super-admin",
    username: "admin",
    password: "manicchia",
    ruolo: "super_admin",
    manicchiaId: "all",
  },
  {
    id: "admin-torre",
    username: "torre",
    password: "torre2026",
    ruolo: "admin_manicchia",
    manicchiaId: "torre-calzolari",
  },
];

function fillMuta(partecipazioni, { anno, tipoCero, pezzoNome, muta, pool, offset = 0 }) {
  POSIZIONI_BASE.forEach((posizione, i) => {
    const ceraioloId = pool[(i + offset) % pool.length];
    partecipazioni.push({
      id: crypto.randomUUID(),
      manicchiaId: "torre-calzolari",
      tipoCero,
      anno,
      pezzo: pezzoNome,
      muta,
      posizione,
      ceraioloId,
    });
  });
}

function createInitialData() {
  const partecipazioni = [];

  // Pool di ceraioli per generare le varianti di status.
  const poolGrandeStorico = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // anni passati
  const poolGrandeAttuale = [1, 2, 3, 4, 5, 6]; // ultimo anno → 7,8,9 diventano ex Grande
  const poolMezzano = [1, 2, 3, 10, 11, 12]; // 1-3 fanno anche Grande, 10-12 solo Mezzano

  // CERO GRANDE — storico 2022/2023 (tutti) e 2024 (solo attivi)
  [2022, 2023].forEach((anno) => {
    PEZZI_GRANDE.forEach((p, pi) => {
      p.mute.forEach((muta, mi) => {
        fillMuta(partecipazioni, {
          anno,
          tipoCero: "grande",
          pezzoNome: p.nome,
          muta,
          pool: poolGrandeStorico,
          offset: pi + mi,
        });
      });
    });
  });

  [2024].forEach((anno) => {
    PEZZI_GRANDE.forEach((p, pi) => {
      p.mute.forEach((muta, mi) => {
        fillMuta(partecipazioni, {
          anno,
          tipoCero: "grande",
          pezzoNome: p.nome,
          muta,
          pool: poolGrandeAttuale,
          offset: pi + mi,
        });
      });
    });
  });

  // CERO MEZZANO — 2023/2024
  [2023, 2024].forEach((anno) => {
    PEZZI_MEZZANO.forEach((p, pi) => {
      p.mute.forEach((muta, mi) => {
        fillMuta(partecipazioni, {
          anno,
          tipoCero: "mezzano",
          pezzoNome: p.nome,
          muta,
          pool: poolMezzano,
          offset: pi + mi,
        });
      });
    });
  });

  return {
    manicchie: [MANICCHIA_BASE],
    admins: ADMIN_BASE,
    ceraioli: CERAIOLI_BASE,
    pezzi: PEZZI_BASE,
    partecipazioni,
  };
}

function ensureBasePezziForTipi(pezzi) {
  // Garantisce che esistano i pezzi base sia Grande che Mezzano
  // per la manicchia principale, senza toccare quelli già presenti.
  const result = [...pezzi];
  TIPI_CERO.forEach((tipoCero) => {
    const hasTipo = result.some(
      (p) =>
        p.manicchiaId === "torre-calzolari" &&
        (p.tipoCero || "grande") === tipoCero
    );
    if (!hasTipo) {
      PEZZI_TEMPLATE[tipoCero].forEach((p) => {
        result.push({
          id: `${tipoCero[0]}-${slugify(p.nome)}`,
          manicchiaId: "torre-calzolari",
          tipoCero,
          nome: p.nome,
          mute: [...p.mute],
        });
      });
    }
  });
  return result;
}

function normalizeData(data) {
  const base = createInitialData();

  const pezzi = (data.pezzi?.length ? data.pezzi : base.pezzi).map((p) => ({
    ...p,
    manicchiaId: p.manicchiaId || "torre-calzolari",
    tipoCero: p.tipoCero || "grande",
  }));

  return {
    manicchie: data.manicchie?.length ? data.manicchie : base.manicchie,
    admins: data.admins?.length ? data.admins : base.admins,
    ceraioli: (data.ceraioli?.length ? data.ceraioli : base.ceraioli).map(
      (c) => ({
        ...c,
        manicchiaId: c.manicchiaId || "torre-calzolari",
      })
    ),
    pezzi: ensureBasePezziForTipi(pezzi),
    partecipazioni: (
      data.partecipazioni?.length ? data.partecipazioni : base.partecipazioni
    ).map((p) => ({
      ...p,
      manicchiaId: p.manicchiaId || "torre-calzolari",
      tipoCero: p.tipoCero || "grande",
    })),
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem("santonio-data");
    return saved ? normalizeData(JSON.parse(saved)) : createInitialData();
  } catch {
    return createInitialData();
  }
}

function saveData(data) {
  localStorage.setItem("santonio-data", JSON.stringify(data));
}

function Img({ src, alt, className = "", fallback = "" }) {
  return (
    <>
      <img
        src={src}
        alt={alt}
        className={className}
        draggable="false"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          const next = e.currentTarget.nextSibling;
          if (next) next.style.display = "inline-flex";
        }}
      />
      <span className="asset-fallback" style={{ display: "none" }}>
        {fallback}
      </span>
    </>
  );
}

function fullName(c) {
  if (!c) return "Non assegnato";
  return `${c.cognome} ${c.nome}`.trim();
}

function normalizeText(v) {
  return String(v || "").trim().toLowerCase();
}

function cloneData(data) {
  if (typeof structuredClone === "function") return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
}

function slugify(v) {
  return normalizeText(v)
    .replaceAll("à", "a")
    .replaceAll("è", "e")
    .replaceAll("é", "e")
    .replaceAll("ì", "i")
    .replaceAll("ò", "o")
    .replaceAll("ù", "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortCeraioli(ceraioli) {
  return [...ceraioli].sort((a, b) => {
    const byCognome = a.cognome.localeCompare(b.cognome, "it", {
      sensitivity: "base",
    });
    if (byCognome !== 0) return byCognome;
    return a.nome.localeCompare(b.nome, "it", { sensitivity: "base" });
  });
}

function getManicchiaName(data, manicchiaId) {
  return (
    data.manicchie.find((m) => m.id === manicchiaId)?.nome ||
    "Torre dei Calzolari"
  );
}


function getUserManicchiaId(currentUser, activeManicchiaId) {
  if (!currentUser || currentUser.ruolo === "super_admin") {
    return activeManicchiaId;
  }

  return currentUser.manicchiaId;
}

function getVisibleData(data, manicchiaId) {
  return {
    ...data,
    ceraioli: data.ceraioli.filter((c) => c.manicchiaId === manicchiaId),
    pezzi: data.pezzi.filter((p) => p.manicchiaId === manicchiaId),
    partecipazioni: data.partecipazioni.filter(
      (p) => p.manicchiaId === manicchiaId
    ),
  };
}

function tipoOf(item) {
  return item?.tipoCero || "grande";
}

// Filtra pezzi e partecipazioni per tipo di cero (grande/mezzano).
function filterByTipo(data, tipoCero) {
  return {
    ...data,
    pezzi: data.pezzi.filter((p) => tipoOf(p) === tipoCero),
    partecipazioni: data.partecipazioni.filter(
      (p) => tipoOf(p) === tipoCero
    ),
  };
}

function findOrCreateCeraiolo(data, manicchiaId, nome, cognome, soprannome = "") {
  const existing = data.ceraioli.find(
    (c) =>
      c.manicchiaId === manicchiaId &&
      normalizeText(c.nome) === normalizeText(nome) &&
      normalizeText(c.cognome) === normalizeText(cognome) &&
      normalizeText(c.soprannome) === normalizeText(soprannome)
  );

  if (existing) return { ceraiolo: existing, created: false };

  const nuovo = {
    id: Date.now() + Math.floor(Math.random() * 100000),
    manicchiaId,
    nome: String(nome || "").trim(),
    cognome: String(cognome || "").trim(),
    soprannome: String(soprannome || "").trim(),
  };

  data.ceraioli.push(nuovo);
  return { ceraiolo: nuovo, created: true };
}

function ensurePezzoMuta(data, manicchiaId, tipoCero, pezzoNome, mutaNome) {
  const tipo = tipoCero || "grande";
  const pezzo = data.pezzi.find(
    (p) =>
      p.manicchiaId === manicchiaId &&
      tipoOf(p) === tipo &&
      normalizeText(p.nome) === normalizeText(pezzoNome)
  );

  if (pezzo) {
    if (!pezzo.mute.some((m) => normalizeText(m) === normalizeText(mutaNome))) {
      pezzo.mute.push(mutaNome);
    }
    return;
  }

  data.pezzi.push({
    id: `${tipo[0]}-` + slugify(pezzoNome) + "-" + Date.now(),
    manicchiaId,
    tipoCero: tipo,
    nome: pezzoNome,
    mute: [mutaNome],
  });
}

function getYears(data) {
  const years = [...new Set(data.partecipazioni.map((p) => Number(p.anno)))];
  return years.length
    ? years.sort((a, b) => b - a)
    : [new Date().getFullYear()];
}

function getMuteCaricate(data, manicchiaId, tipoCero = null) {
  const map = new Map();

  data.partecipazioni
    .filter(
      (p) =>
        (!manicchiaId || p.manicchiaId === manicchiaId) &&
        (!tipoCero || tipoOf(p) === tipoCero)
    )
    .forEach((p) => {
      const key = `${p.anno}__${tipoOf(p)}__${p.manicchiaId}__${p.pezzo}__${p.muta}`;
      const pezzo = data.pezzi.find(
        (x) =>
          x.nome === p.pezzo &&
          x.manicchiaId === p.manicchiaId &&
          tipoOf(x) === tipoOf(p)
      );

      if (!map.has(key)) {
        map.set(key, {
          key,
          tipoCero: tipoOf(p),
          manicchiaId: p.manicchiaId,
          manicchiaNome: getManicchiaName(data, p.manicchiaId),
          anno: Number(p.anno),
          pezzo: p.pezzo,
          pezzoId: pezzo?.id || "",
          muta: p.muta,
          count: 0,
        });
      }

      if (p.ceraioloId) map.get(key).count += 1;
    });

  const order = ["Alzatella", "Bargello", "Buchetto", "Monte"];
  return Array.from(map.values()).sort((a, b) => {
    if (b.anno !== a.anno) return b.anno - a.anno;
    const byManicchia = a.manicchiaNome.localeCompare(b.manicchiaNome, "it", {
      sensitivity: "base",
    });
    if (byManicchia !== 0) return byManicchia;
    const oa = order.indexOf(a.pezzo);
    const ob = order.indexOf(b.pezzo);
    if (oa !== ob) return oa - ob;
    return a.muta.localeCompare(b.muta, "it");
  });
}

// Anni disponibili per un tipo di cero, su tutte le manicchie.
function getYearsByTipo(data, tipoCero) {
  const anni = [
    ...new Set(
      data.partecipazioni
        .filter((p) => tipoOf(p) === tipoCero)
        .map((p) => Number(p.anno))
    ),
  ].sort((a, b) => b - a);
  return anni.length ? anni : [new Date().getFullYear()];
}

const PEZZO_ORDER = ["Alzatella", "Bargello", "Buchetto", "Monte"];

// Tutte le mute caricate in un anno, su TUTTE le manicchie, per un tipo di cero.
// Chiave univoca: anno + tipoCero + manicchiaId + pezzo + muta.
function getMuteByYearAllManicchie(data, anno, tipoCero) {
  const map = new Map();

  data.partecipazioni
    .filter(
      (p) => Number(p.anno) === Number(anno) && tipoOf(p) === tipoCero
    )
    .forEach((p) => {
      const pezzo = data.pezzi.find(
        (x) =>
          normalizeText(x.nome) === normalizeText(p.pezzo) &&
          x.manicchiaId === p.manicchiaId &&
          tipoOf(x) === tipoOf(p)
      );
      // Nome ufficiale del pezzo e della muta (se riconosciuti), così
      // grafie diverse (maiuscole/spazi) finiscono nello stesso gruppo.
      const pezzoNome = pezzo ? pezzo.nome : p.pezzo;
      const mutaNome = pezzo
        ? pezzo.mute.find((m) => normalizeText(m) === normalizeText(p.muta)) ||
          p.muta
        : p.muta;
      const key = `${p.anno}__${tipoOf(p)}__${p.manicchiaId}__${normalizeText(
        pezzoNome
      )}__${normalizeText(mutaNome)}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          anno: Number(p.anno),
          tipoCero: tipoOf(p),
          manicchiaId: p.manicchiaId,
          manicchiaNome: getManicchiaName(data, p.manicchiaId),
          pezzo: pezzoNome,
          pezzoId: pezzo?.id || "",
          muta: mutaNome,
          count: 0,
        });
      }

      if (p.ceraioloId) map.get(key).count += 1;
    });

  return Array.from(map.values()).sort((a, b) => {
    // ordina per manicchia, poi pezzo, poi muta
    const byManicchia = a.manicchiaNome.localeCompare(b.manicchiaNome, "it", {
      sensitivity: "base",
    });
    if (byManicchia !== 0) return byManicchia;

    const oa = PEZZO_ORDER.indexOf(a.pezzo);
    const ob = PEZZO_ORDER.indexOf(b.pezzo);
    const oaa = oa === -1 ? 999 : oa;
    const obb = ob === -1 ? 999 : ob;
    if (oaa !== obb) return oaa - obb;

    return a.muta.localeCompare(b.muta, "it");
  });
}

function getCeraioloStats(data, ceraioloId, tipoCero = null) {
  const rows = data.partecipazioni.filter(
    (p) =>
      p.ceraioloId === ceraioloId &&
      (!tipoCero || tipoOf(p) === tipoCero)
  );

  const anni = [...new Set(rows.map((r) => Number(r.anno)))].sort(
    (a, b) => a - b
  );

  const pezzi = [...new Set(rows.map((r) => r.pezzo))];

  const primoAnno = anni[0] || "—";
  const ultimoAnnoPresente = anni[anni.length - 1] || "—";
  const anniArchivio = data.partecipazioni
    .filter((p) => !tipoCero || tipoOf(p) === tipoCero)
    .map((p) => Number(p.anno));
  const ultimoAnnoArchivio = anniArchivio.length
    ? Math.max(...anniArchivio)
    : "—";

  const lasciato =
    ultimoAnnoPresente === "—"
      ? "—"
      : ultimoAnnoPresente === ultimoAnnoArchivio
        ? "—"
        : ultimoAnnoPresente;

  return {
    rows,
    anni,
    pezzi,
    entrato: primoAnno,
    lasciato,
    anniTotali: anni.length,
  };
}

function getCeraioloHistoryWithInfortuni(data, ceraioloId, tipoCero = null) {
  const stats = getCeraioloStats(data, ceraioloId, tipoCero);
  const rows = [...stats.rows].sort((a, b) => Number(b.anno) - Number(a.anno));

  if (stats.anni.length <= 1) return rows;

  const min = Math.min(...stats.anni);
  const max = Math.max(...stats.anni);
  const result = [];

  for (let year = max; year >= min; year--) {
    const yearRows = rows.filter((r) => Number(r.anno) === year);

    if (yearRows.length > 0) {
      result.push(...yearRows);
    } else {
      result.push({
        id: `infortunato-${ceraioloId}-${year}`,
        anno: year,
        pezzo: "Infortunato",
        muta: "—",
        posizione: "INFORTUNATO",
        ceraioloId,
        isInfortunato: true,
      });
    }
  }

  return result;
}


function useToast() {
  const [toast, setToast] = useState(null);

  function showToast(type, message) {
    setToast({ type, message });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 2800);
  }

  return { toast, showToast };
}

function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div className={`toast-box ${toast.type === "error" ? "toast-error" : "toast-success"}`}>
      {toast.message}
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="splash-shell">
      <div className="splash-card">
        <Img
          src={assets.logoMenuHome}
          alt="S.Antonio"
          className="splash-logo"
          fallback="S"
        />
        <h1>S.Antonio</h1>
        <div className="gold-divider splash-divider">
          <span />
        </div>
        <p>Archivio storico</p>
      </div>
    </div>
  );
}

function AppFrame({ page, setPage, children }) {
  const loginVariant = page === "login" || page.startsWith("admin");

  return (
    <div className="app-shell">
      <div className="app-phone">
        <div
          className="paper-layer"
          style={{ backgroundImage: `url(${assets.paperTexture})` }}
        />
        <div
          className={`background-layer ${loginVariant ? "login-background" : ""}`}
          style={{
            backgroundImage: `url(${loginVariant ? assets.loginBg : assets.palazzoBg})`,
          }}
        />
        <main className="app-main">{children}</main>
        <BottomNav page={page} setPage={setPage} />
      </div>
    </div>
  );
}

function BottomNav({ page, setPage }) {
  return (
    <nav className="bottom-nav">
      <button type="button" className="nav-item" onClick={() => setPage("archive")}>
        <Img
          src={assets.barella}
          alt="Mute"
          className="nav-icon nav-barella"
          fallback="M"
        />
        <span className={page === "archive" || page === "muta" ? "active" : ""}>
          Mute
        </span>
      </button>

      <button type="button" className="home-nav" onClick={() => setPage("home")}>
        <Img
          src={assets.logoMenuHome}
          alt="Home"
          className="home-logo"
          fallback="S"
        />
      </button>

      <button
        type="button"
        className="nav-item"
        onClick={() => setPage("ceraioli")}
      >
        <Img src={assets.user} alt="Ceraioli" className="nav-icon" fallback="C" />
        <span className={page === "ceraioli" || page === "scheda" ? "active" : ""}>
          Ceraioli
        </span>
      </button>
    </nav>
  );
}

function Header({ title, onBack }) {
  return (
    <div className="page-header">
      <button type="button" className="back-button" onClick={onBack}>
        ‹
      </button>
      <h2>{title}</h2>
    </div>
  );
}

// Linguette premium stile iOS per scegliere il tipo di cero.
function CeroTabs({ value, onChange }) {
  return (
    <div className="cero-tabs" role="tablist">
      {TIPI_CERO.map((tipo) => (
        <button
          key={tipo}
          type="button"
          role="tab"
          aria-selected={value === tipo}
          className={`cero-tab ${value === tipo ? "active" : ""}`}
          onClick={() => onChange(tipo)}
        >
          {TIPO_CERO_LABEL[tipo]}
        </button>
      ))}
    </div>
  );
}

// Avatar ceraiolo con bordo colorato in base allo status (bronzo/argento/oro).
function StatusAvatar({ size = "sm" }) {
  return (
    <span className={`avatar-circle avatar-${size}`}>
      <Img src={assets.ceraiolo} alt="" className="avatar-icon" />
    </span>
  );
}

// Bottoni azione compatti a icona (penna = modifica, cestino = elimina, frecce = sposta).
function IconButton({ kind, onClick, label, disabled = false }) {
  const icons = {
    edit: "M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0L4 16v4z M13.5 6.5l4 4",
    delete:
      "M4 7h16 M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13 M10 11v6 M14 11v6",
    up: "M6 14l6-6 6 6",
    down: "M6 10l6 6 6-6",
  };

  return (
    <button
      type="button"
      className={`icon-button icon-${kind}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d={icons[kind] || icons.edit}
        />
      </svg>
    </button>
  );
}

function Home({ data, setPage }) {
  return (
    <section className="home-screen">
      <div className="home-hero">
        <h1>S.Antonio</h1>
        <div className="gold-divider">
          <span />
        </div>
        <p>Tradizione. Devozione. Identità.</p>
        <div className="tiny-gold" />
        <strong>ARCHIVIO STORICO</strong>
      </div>

      <button
        type="button"
        className="archive-card"
        onClick={() => setPage("archive")}
      >
        <div className="archive-icon-wrap">
          <Img
            src={assets.ceraiolo}
            alt="Archivio"
            className="archive-barella"
            fallback="C"
          />
        </div>
        <div className="archive-separator" />
        <div className="archive-text">
          <h2>
            CONSULTA
            <br />
            ARCHIVIO
          </h2>
          <p>
            Esplora la storia delle mute
            <br />e dei ceraioli.
          </p>
        </div>
        <Img src={assets.arrow} alt="Apri" className="arrow-icon" fallback="›" />
      </button>

      <div className="stats-card">
        <StatBox
          icon={assets.barella}
          value={getMuteCaricate(data, "torre-calzolari", "grande").length}
          label="Mute"
        />
        <span className="stat-separator" />
        <StatBox icon={assets.user} value={data.ceraioli.length} label="Ceraioli" />
        <span className="stat-separator" />
        <StatBox icon={assets.calendar} value={getYears(data).length} label="Anni" />
      </div>

      <button
        type="button"
        className="reserved-link"
        onClick={() => setPage("login")}
      >
        <Img src={assets.lock} alt="Accesso riservato" className="lock-icon" />
        <span>Accesso riservato</span>
      </button>
      <div className="reserved-line" />
    </section>
  );
}

function StatBox({ icon, value, label }) {
  return (
    <div className="stat-box">
      <Img src={icon} alt="" className="stat-icon" />
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function ArchivePage({ data, setPage, selection, setSelection }) {
  const tipoCero = selection.tipoCero || "grande";
  const years = getYearsByTipo(data, tipoCero);
  const anno = years.includes(Number(selection.anno)) ? Number(selection.anno) : years[0];
  const mute = getMuteByYearAllManicchie(data, anno, tipoCero);

  function changeTipo(nuovoTipo) {
    const ys = getYearsByTipo(data, nuovoTipo);
    setSelection((prev) => ({
      ...prev,
      tipoCero: nuovoTipo,
      anno: ys[0] ?? prev.anno,
    }));
  }

  return (
    <section>
      <Header title="Consulta Archivio" onBack={() => setPage("home")} />

      <CeroTabs value={tipoCero} onChange={changeTipo} />

      <div className="panel">
        <label>
          Anno
          <select
            value={anno}
            onChange={(e) =>
              setSelection((p) => ({ ...p, anno: Number(e.target.value) }))
            }
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h3 className="section-subtitle">Mute caricate nel {anno}</h3>

      <div className="list-card">
        {mute.length === 0 ? (
          <div className="list-empty">
            Nessuna muta caricata nel {anno} per il {TIPO_CERO_LABEL[tipoCero]}.
          </div>
        ) : (
          mute.map((item) => (
            <button
              type="button"
              className="list-row"
              key={item.key}
              onClick={() => {
                setSelection((prev) => ({
                  ...prev,
                  tipoCero,
                  anno: item.anno,
                  manicchiaId: item.manicchiaId,
                  pezzoId: item.pezzoId,
                  pezzoNome: item.pezzo,
                  muta: item.muta,
                }));
                setPage("muta");
              }}
            >
              <Img src={assets.barella} alt="" className="row-icon" />
              <div className="row-text">
                <strong>{item.muta}</strong>
                <span>
                  {item.manicchiaNome} · {item.count} ceraioli
                </span>
              </div>
              <Img src={assets.arrow} alt="Apri" className="row-arrow" fallback="›" />
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function MutaPage({ data, setPage, selection }) {
  const tipoCero = selection.tipoCero || "grande";
  const manicchiaId = selection.manicchiaId || "torre-calzolari";
  const manicchiaNome = getManicchiaName(data, manicchiaId);
  const scope = filterByTipo(getVisibleData(data, manicchiaId), tipoCero);

  const pezzoName =
    scope.pezzi.find((p) => p.id === selection.pezzoId)?.nome ||
    selection.pezzoNome ||
    scope.pezzi[0]?.nome ||
    "";

  const rows = scope.partecipazioni.filter(
    (p) =>
      Number(p.anno) === Number(selection.anno) &&
      normalizeText(p.pezzo) === normalizeText(pezzoName) &&
      normalizeText(p.muta) === normalizeText(selection.muta)
  );

  const byPos = Object.fromEntries(
    rows.map((r) => [
      r.posizione,
      data.ceraioli.find((c) => Number(c.id) === Number(r.ceraioloId)),
    ])
  );

  const extraRows = POSIZIONI_EXTRA.filter((p) => byPos[p]);

  return (
    <section>
      <Header
        title={`${selection.anno} · ${pezzoName}`}
        onBack={() => setPage("archive")}
      />
      <span className="cero-pill">
        {manicchiaNome} · {TIPO_CERO_LABEL[tipoCero]}
      </span>
      <h3 className="muta-title">{selection.muta}</h3>
      <p className="muta-subtitle">Composizione della muta</p>

      <div className="muta-stage">
        <div className="muta-barella-wrap">
          <Img src={assets.barella} alt="Barella" className="muta-barella" />
        </div>

        {POSIZIONI_LEFT.map((pos, index) => (
          <PositionBox
            key={pos}
            side="left"
            index={index}
            posizione={pos}
            ceraiolo={byPos[pos]}
          />
        ))}

        {POSIZIONI_RIGHT.map((pos, index) => (
          <PositionBox
            key={pos}
            side="right"
            index={index}
            posizione={pos}
            ceraiolo={byPos[pos]}
          />
        ))}
      </div>

      {extraRows.length > 0 && (
        <div className="panel capo-extra-row">
          {extraRows.map((pos) => (
            <div key={pos} className="capo-extra-item">
              <small>{pos}:</small>
              <strong>{fullName(byPos[pos])}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PositionBox({ side, index, posizione, ceraiolo }) {
  return (
    <div className={`position-box ${side} pos-${index}`}>
      <small>{posizione.toUpperCase()}</small>
      <strong>{fullName(ceraiolo)}</strong>
    </div>
  );
}

function CeraioliPage({ data, allData, setPage, setSelectedCeraiolo }) {
  const [query, setQuery] = useState("");

  const filtered = sortCeraioli(data.ceraioli).filter((c) =>
    `${c.cognome} ${c.nome} ${c.soprannome}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <section>
      <Header title="Archivio Ceraioli" onBack={() => setPage("home")} />

      <input
        className="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca ceraiolo..."
      />

      <div className="list-card">
        {filtered.map((c) => {
          return (
            <button
              type="button"
              className="list-row"
              key={c.id}
              onClick={() => {
                setSelectedCeraiolo(c);
                setPage("scheda");
              }}
            >
              <StatusAvatar />

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <strong>{fullName(c)}</strong>

                  {c.soprannome && (
                    <span
                      style={{
                        color: "#980000",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {c.soprannome}
                    </span>
                  )}
                </div>

                <span style={{ fontSize: 12, color: "#777" }}>
                  Manicchia: {getManicchiaName(allData || data, c.manicchiaId)}
                </span>
              </div>

              <Img src={assets.arrow} alt="Apri" className="row-arrow" fallback="›" />
            </button>
          );
        })}
      </div>
    </section>
  );
}



function SchedaCeraioloPage({ data, setPage, ceraiolo }) {
  const c = ceraiolo || data.ceraioli[0];
  const [tipoCero, setTipoCero] = useState("grande");

  if (!c) {
    return (
      <section>
        <Header title="Dettaglio Ceraiolo" onBack={() => setPage("ceraioli")} />
        <div className="panel">Nessun ceraiolo selezionato.</div>
      </section>
    );
  }

  const stats = getCeraioloStats(data, c.id, tipoCero);
  const history = getCeraioloHistoryWithInfortuni(data, c.id, tipoCero);

  return (
    <section>
      <Header title="Dettaglio Ceraiolo" onBack={() => setPage("ceraioli")} />

      <div className="profile-head">
        <div className="profile-avatar">
          <Img src={assets.ceraiolo} alt="" className="profile-icon" />
        </div>
        <h3>{fullName(c)}</h3>
        <p>{c.soprannome}</p>
      </div>

      <CeroTabs value={tipoCero} onChange={setTipoCero} />

      <div className="detail-stats detail-stats-four">
        <MiniStat label="Entrato" value={stats.entrato} />
        <MiniStat label="Lasciato" value={stats.lasciato} />
        <MiniStat label="Anni totali" value={stats.anniTotali} />
        <MiniStat label="Pezzi fatti" value={stats.pezzi.length} />
      </div>

      {history.length === 0 ? (
        <div className="panel">
          Nessuna partecipazione nel {TIPO_CERO_LABEL[tipoCero]}.
        </div>
      ) : (
        <div className="panel history-panel">
          {history.map((row) => (
            <div className="history-row" key={row.id}>
              {row.isInfortunato ? (
                <>
                  <span>
                    <b>{row.anno}</b> · INFORTUNATO
                  </span>
                  <span>
                    Assenza temporanea
                    <br />
                    rientro successivo
                  </span>
                </>
              ) : (
                <>
                  <span>
                    <b>{row.anno}</b> · {row.muta}
                  </span>
                  <span>
                    {row.pezzo}
                    <br />
                    {row.posizione}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}



function MiniStat({ label, value }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function LoginPage({ setPage, setCurrentUser, showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setError("");
    setLoading(true);
    try {
      const user = await adminLogin(email, password);
      setCurrentUser(user);
      showToast?.("success", "Accesso effettuato correttamente.");
      setPage("admin");
    } catch (e) {
      const msg =
        e?.message === "Invalid login credentials"
          ? "Email o password non corrette."
          : e?.message || "Accesso non riuscito.";
      setError(msg);
      showToast?.("error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-screen">
      <Header title="Area Riservata" onBack={() => setPage("home")} />

      <div className="login-card">
        <Img src={assets.lock} alt="" className="login-lock" />

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Inserisci email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Inserisci password"
          />
        </label>

        {error && <p style={{ color: "#980000", fontSize: 13 }}>{error}</p>}

        <button
          type="button"
          className="primary-button"
          onClick={login}
          disabled={loading}
        >
          {loading ? "Accesso in corso…" : "Accedi"}
        </button>
      </div>
    </section>
  );
}



function AdminPage({ setPage, currentUser }) {
  const cards = [
    {
      title: "Manicchie",
      icon: assets.manicchie,
      page: "admin-manicchie",
      superOnly: true,
    },
    { title: "Pezzi", icon: assets.pezzi, page: "admin-pezzi" },
    { title: "Ceraioli", icon: assets.ceraiolo, page: "admin-ceraioli" },
    { title: "MUTE", icon: assets.barella, page: "admin-mute" },
    { title: "Importa", icon: assets.importa, page: "admin-import" },
    {
      title: "Gestione Admin",
      icon: assets.admin,
      page: "admin-users",
      superOnly: true,
    },
  ].filter((card) => !card.superOnly || currentUser?.ruolo === "super_admin");

  return (
    <section>
      <Header title="Dashboard Admin" onBack={() => setPage("home")} />

      <div className="admin-grid">
        {cards.map((card) => (
          <button
            type="button"
            className="admin-card"
            key={card.title}
            onClick={() => setPage(card.page)}
          >
            <Img src={card.icon} alt="" className="admin-card-icon" />
            <strong>{card.title}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}



function CeraioloSearchSelect({
  posizione,
  value,
  onChange,
  ceraioli,
  getAvailableCeraioli,
}) {
  const selected = ceraioli.find((c) => c.id === Number(value));

  const [query, setQuery] = useState(
    selected ? `${selected.cognome} ${selected.nome}` : ""
  );

  const available = getAvailableCeraioli(posizione).filter((c) =>
    `${c.cognome} ${c.nome} ${c.soprannome}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <div>
      <input
        value={query}
        placeholder="Cerca ceraiolo..."
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
        }}
      />

      {query && !value && (
        <div className="list-card" style={{ marginTop: 8 }}>
          {available.map((c) => (
            <button
              type="button"
              className="list-row"
              key={c.id}
              onClick={() => {
                onChange(c.id);
                setQuery(`${c.cognome} ${c.nome}`);
              }}
            >
              <StatusAvatar />

              <div>
                <strong>{fullName(c)}</strong>
                <span>{c.soprannome || "—"}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}



function AdminMuteHubPage({
  data,
  setData,
  reloadData,
  setPage,
  currentUser,
  activeManicchiaId,
  showToast,
  openMutaEditor,
}) {
  const userManicchiaId = getUserManicchiaId(currentUser, activeManicchiaId);
  const isSuper = currentUser?.ruolo === "super_admin";
  const [tipoCero, setTipoCero] = useState("grande");
  const mute = getMuteCaricate(
    data,
    isSuper ? null : userManicchiaId,
    tipoCero
  );

  async function eliminaMuta(item) {
    try {
      await dbDeleteMutaRows(
        item.manicchiaId,
        item.tipoCero,
        item.anno,
        item.pezzo,
        item.muta
      );
      await reloadData();
      showToast?.("success", "Muta eliminata correttamente.");
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante l'eliminazione.");
    }
  }

  return (
    <section>
      <Header title="MUTE" onBack={() => setPage("admin")} />

      <CeroTabs value={tipoCero} onChange={setTipoCero} />

      <button
        type="button"
        className="primary-button"
        onClick={() => openMutaEditor({ tipoCero })}
      >
        Aggiungi
      </button>

      <h3 className="section-subtitle">
        Mute caricate · {TIPO_CERO_LABEL[tipoCero]}
      </h3>

      {mute.length === 0 ? (
        <div className="panel">Nessuna muta caricata.</div>
      ) : (
        <div className="list-card">
          {mute.map((item) => (
            <div className="list-row" key={item.key}>
              <Img src={assets.barella} alt="" className="row-icon" />
              <div className="row-text">
                <strong>
                  {item.muta} — {item.anno}
                </strong>
                <span>
                  {isSuper ? `${item.manicchiaNome} · ` : ""}
                  {item.pezzo} · {item.count} ceraioli
                </span>
              </div>

              <div className="row-actions">
                <IconButton
                  kind="edit"
                  label="Modifica muta"
                  onClick={() => openMutaEditor(item)}
                />
                <IconButton
                  kind="delete"
                  label="Elimina muta"
                  onClick={() => eliminaMuta(item)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}



function AdminMutaPage({
  data,
  setData,
  reloadData,
  setPage,
  currentUser,
  activeManicchiaId,
  showToast,
  editTarget = null,
}) {
  const userManicchiaId = getUserManicchiaId(currentUser, activeManicchiaId);
  const isSuper = currentUser?.ruolo === "super_admin";
  const isEdit = Boolean(editTarget && editTarget.muta);
  const tipoCero = editTarget?.tipoCero || "grande";
  const editManicchiaId = editTarget?.manicchiaId || userManicchiaId;

  const [selManicchiaId, setSelManicchiaId] = useState(
    isEdit ? editManicchiaId : userManicchiaId
  );
  // In modifica la manicchia è quella della muta; in inserimento il super admin può sceglierla.
  const manicchiaId = isEdit
    ? editManicchiaId
    : isSuper
      ? selManicchiaId
      : userManicchiaId;

  const manicchiaData = getVisibleData(data, manicchiaId);
  const visibleData = filterByTipo(manicchiaData, tipoCero);

  const initialEdit = useMemo(() => {
    if (!isEdit) return null;

    const pezzoObj = visibleData.pezzi.find(
      (p) => normalizeText(p.nome) === normalizeText(editTarget.pezzo)
    );

    const rows = data.partecipazioni.filter(
      (r) =>
        r.manicchiaId === manicchiaId &&
        tipoOf(r) === tipoCero &&
        Number(r.anno) === Number(editTarget.anno) &&
        r.pezzo === editTarget.pezzo &&
        r.muta === editTarget.muta
    );

    const scelteInit = {};
    rows.forEach((r) => {
      scelteInit[r.posizione] = Number(r.ceraioloId);
    });

    return {
      anno: Number(editTarget.anno),
      pezzoId: pezzoObj?.id || visibleData.pezzi[0]?.id || "",
      muta: editTarget.muta,
      scelte: scelteInit,
      extra: {
        "Capo 10": Boolean(scelteInit["Capo 10"]),
        "Capo 5": Boolean(scelteInit["Capo 5"]),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [anno, setAnno] = useState(
    initialEdit?.anno ?? new Date().getFullYear()
  );
  const [pezzoId, setPezzoId] = useState(
    initialEdit?.pezzoId ?? (visibleData.pezzi[0]?.id || "")
  );
  const pezzo =
    visibleData.pezzi.find((p) => p.id === pezzoId) || visibleData.pezzi[0];
  const [muta, setMuta] = useState(
    initialEdit?.muta ?? (pezzo?.mute?.[0] || "")
  );

  const [scelte, setScelte] = useState(initialEdit?.scelte ?? {});
  const [extraAttive, setExtraAttive] = useState(
    initialEdit?.extra ?? {
      "Capo 10": false,
      "Capo 5": false,
    }
  );

  function getAvailableCeraioli(posizioneCorrente) {
    const alreadySelected = Object.entries(scelte)
      .filter(([pos]) => pos !== posizioneCorrente)
      .map(([, id]) => Number(id))
      .filter(Boolean);

    return sortCeraioli(visibleData.ceraioli).filter(
      (c) => !alreadySelected.includes(c.id)
    );
  }

  function setCeraiolo(posizione, ceraioloId) {
    setScelte((prev) => ({
      ...prev,
      [posizione]: ceraioloId ? Number(ceraioloId) : "",
    }));
  }

  function cambiaPezzo(id) {
    const nuovoPezzo = visibleData.pezzi.find((p) => p.id === id);

    setPezzoId(id);
    setMuta(nuovoPezzo?.mute?.[0] || "");
    setScelte({});
    setExtraAttive({
      "Capo 10": false,
      "Capo 5": false,
    });
  }

  async function salva() {
    if (!pezzo || !muta) {
      showToast?.("error", "Seleziona prima pezzo e muta.");
      return;
    }

    const posizioniDaSalvare = [
      ...POSIZIONI_BASE,
      ...POSIZIONI_EXTRA.filter((p) => extraAttive[p]),
    ];

    if (!posizioniDaSalvare.some((posizione) => scelte[posizione])) {
      showToast?.("error", "Inserisci almeno un ceraiolo nella muta.");
      return;
    }

    const righe = posizioniDaSalvare
      .filter((posizione) => scelte[posizione])
      .map((posizione) => ({
        manicchiaId,
        tipoCero,
        anno: Number(anno),
        pezzo: pezzo.nome,
        muta,
        posizione,
        ceraioloId: Number(scelte[posizione]),
      }));

    try {
      await dbSaveMuta({
        manicchiaId,
        tipoCero,
        anno: Number(anno),
        pezzo: pezzo.nome,
        muta,
        righe,
        originale: isEdit
          ? {
              anno: editTarget.anno,
              pezzo: editTarget.pezzo,
              muta: editTarget.muta,
            }
          : null,
      });
      await reloadData();
      showToast?.(
        "success",
        isEdit
          ? "Muta modificata correttamente."
          : "Muta salvata correttamente."
      );
      setPage("admin-mute");
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante il salvataggio.");
    }
  }

  return (
    <section>
      <Header
        title={isEdit ? "Modifica Muta" : "Carica nuova muta"}
        onBack={() => setPage("admin-mute")}
      />

      <span className="cero-pill">
        {getManicchiaName(data, manicchiaId)} · {TIPO_CERO_LABEL[tipoCero]}
      </span>

      <div className="panel filters-panel">
        {isSuper && !isEdit && (
          <label>
            Manicchia
            <select
              value={selManicchiaId}
              onChange={(e) => {
                const id = e.target.value;
                setSelManicchiaId(id);
                const pezzi = data.pezzi.filter(
                  (p) => p.manicchiaId === id && tipoOf(p) === tipoCero
                );
                setPezzoId(pezzi[0]?.id || "");
                setMuta(pezzi[0]?.mute?.[0] || "");
                setScelte({});
              }}
            >
              {data.manicchie.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Anno
          <input
            type="number"
            value={anno}
            onChange={(e) => setAnno(e.target.value)}
          />
        </label>

        <label>
          Pezzo
          <select value={pezzoId} onChange={(e) => cambiaPezzo(e.target.value)}>
            {visibleData.pezzi.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          Muta
          <select
            value={muta}
            onChange={(e) => {
              setMuta(e.target.value);
              setScelte({});
            }}
          >
            {(pezzo?.mute || []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      {POSIZIONI_BASE.map((pos) => (
        <div key={pos} className="panel">
          <label>{pos}</label>

          <CeraioloSearchSelect
            posizione={pos}
            value={scelte[pos] || ""}
            onChange={(id) => setCeraiolo(pos, id)}
            ceraioli={visibleData.ceraioli}
            getAvailableCeraioli={getAvailableCeraioli}
          />
        </div>
      ))}

      {POSIZIONI_EXTRA.map((pos) => (
        <div key={pos} className="panel">
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              style={{ width: "auto", margin: 0 }}
              checked={extraAttive[pos]}
              onChange={(e) =>
                setExtraAttive((p) => ({
                  ...p,
                  [pos]: e.target.checked,
                }))
              }
            />
            Attiva {pos}
          </label>

          {extraAttive[pos] && (
            <>
              <label style={{ marginTop: 12 }}>Ceraiolo {pos}</label>

              <CeraioloSearchSelect
                posizione={pos}
                value={scelte[pos] || ""}
                onChange={(id) => setCeraiolo(pos, id)}
                ceraioli={visibleData.ceraioli}
                getAvailableCeraioli={getAvailableCeraioli}
              />
            </>
          )}
        </div>
      ))}

      <button type="button" className="primary-button" onClick={salva}>
        {isEdit ? "Salva modifiche" : "Aggiungi"}
      </button>
    </section>
  );
}



function AdminCeraioliPage({
  data,
  setData,
  reloadData,
  setPage,
  currentUser,
  activeManicchiaId,
  showToast,
}) {
  const userManicchiaId = getUserManicchiaId(currentUser, activeManicchiaId);
  const isSuper = currentUser?.ruolo === "super_admin";
  const visibleData = getVisibleData(data, userManicchiaId);
  const ceraioliDaMostrare = isSuper ? data.ceraioli : visibleData.ceraioli;

  const [form, setForm] = useState({
    nome: "",
    cognome: "",
    soprannome: "",
    manicchiaId: userManicchiaId,
  });

  async function aggiungi() {
    if (!form.nome.trim() || !form.cognome.trim()) {
      showToast?.("error", "Inserisci nome e cognome.");
      return;
    }

    const manicchiaId = isSuper ? form.manicchiaId : userManicchiaId;

    try {
      await dbAddCeraiolo(manicchiaId, {
        nome: form.nome,
        cognome: form.cognome,
        soprannome: form.soprannome,
      });
      await reloadData();
      setForm({ nome: "", cognome: "", soprannome: "", manicchiaId });
      showToast?.("success", "Ceraiolo aggiunto correttamente.");
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante il salvataggio.");
    }
  }

  async function eliminaCeraiolo(c) {
    if (!isSuper && c.manicchiaId !== userManicchiaId) {
      showToast?.(
        "error",
        "Non puoi eliminare ceraioli di un'altra manicchia."
      );
      return;
    }

    const usato = data.partecipazioni.some((p) => p.ceraioloId === c.id);
    if (usato) {
      showToast?.(
        "error",
        "Impossibile eliminare: ceraiolo presente nello storico."
      );
      return;
    }

    try {
      await dbDeleteCeraiolo(c.id);
      await reloadData();
      showToast?.("success", "Ceraiolo eliminato correttamente.");
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante l'eliminazione.");
    }
  }

  return (
    <section>
      <Header title="Gestione Ceraioli" onBack={() => setPage("admin")} />

      <div className="panel admin-form">
        {isSuper && (
          <label>
            Manicchia
            <select
              value={form.manicchiaId}
              onChange={(e) =>
                setForm((p) => ({ ...p, manicchiaId: e.target.value }))
              }
            >
              {data.manicchie.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Nome
          <input
            value={form.nome}
            onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
          />
        </label>

        <label>
          Cognome
          <input
            value={form.cognome}
            onChange={(e) => setForm((p) => ({ ...p, cognome: e.target.value }))}
          />
        </label>

        <label>
          Soprannome
          <input
            value={form.soprannome}
            onChange={(e) =>
              setForm((p) => ({ ...p, soprannome: e.target.value }))
            }
          />
        </label>

        <button type="button" className="primary-button" onClick={aggiungi}>
          Aggiungi
        </button>
      </div>

      <div className="list-card">
        {sortCeraioli(ceraioliDaMostrare).map((c) => {
          return (
            <div className="list-row" key={c.id}>
              <StatusAvatar />
              <div className="row-text">
                <div className="row-name-line">
                  <strong>{fullName(c)}</strong>
                  {c.soprannome && (
                    <span className="nick-red">{c.soprannome}</span>
                  )}
                </div>
                <span>Manicchia: {getManicchiaName(data, c.manicchiaId)}</span>
              </div>

              <IconButton
                kind="delete"
                label="Elimina ceraiolo"
                onClick={() => eliminaCeraiolo(c)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}



function AdminPezziPage({
  data,
  setData,
  reloadData,
  setPage,
  currentUser,
  activeManicchiaId,
  showToast,
}) {
  const userManicchiaId = getUserManicchiaId(currentUser, activeManicchiaId);
  const isSuper = currentUser?.ruolo === "super_admin";
  const [tipoCero, setTipoCero] = useState("grande");
  const [selManicchiaId, setSelManicchiaId] = useState(userManicchiaId);
  const manicchiaId = isSuper ? selManicchiaId : userManicchiaId;
  const visibleData = filterByTipo(getVisibleData(data, manicchiaId), tipoCero);

  const [pezzoNome, setPezzoNome] = useState("");
  const [mutaNome, setMutaNome] = useState("");
  const [editId, setEditId] = useState(null);

  async function aggiungi() {
    if (!pezzoNome.trim() || !mutaNome.trim()) {
      showToast?.("error", "Inserisci sia il pezzo che la muta.");
      return;
    }
    const nome = pezzoNome.trim();
    const muta = mutaNome.trim();

    const esistente = data.pezzi.find(
      (p) =>
        p.manicchiaId === manicchiaId &&
        tipoOf(p) === tipoCero &&
        normalizeText(p.nome) === normalizeText(nome)
    );

    try {
      if (esistente) {
        if (
          !esistente.mute.some((m) => normalizeText(m) === normalizeText(muta))
        ) {
          await dbUpsertPezzo({
            ...esistente,
            mute: [...esistente.mute, muta],
          });
        }
      } else {
        const scope = data.pezzi.filter(
          (p) => p.manicchiaId === manicchiaId && tipoOf(p) === tipoCero
        );
        const ordine =
          scope.reduce((m, p) => Math.max(m, p.ordine ?? 0), -1) + 1;
        await dbUpsertPezzo({
          id: `${tipoCero[0]}-${slugify(nome)}-${Date.now()}`,
          manicchiaId,
          tipoCero,
          nome,
          mute: [muta],
          ordine,
        });
      }
      await reloadData();
      setPezzoNome("");
      setMutaNome("");
      showToast?.("success", "Pezzo e muta aggiunti correttamente.");
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante il salvataggio.");
    }
  }

  async function eliminaPezzo(pezzo) {
    const usato = data.partecipazioni.some(
      (p) =>
        p.manicchiaId === manicchiaId &&
        tipoOf(p) === tipoOf(pezzo) &&
        normalizeText(p.pezzo) === normalizeText(pezzo.nome)
    );
    if (usato) {
      showToast?.(
        "error",
        "Impossibile eliminare: pezzo presente nello storico."
      );
      return;
    }
    try {
      await dbDeletePezzo(pezzo.id);
      await reloadData();
      showToast?.("success", "Pezzo eliminato correttamente.");
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante l'eliminazione.");
    }
  }

  async function eliminaMuta(pezzo, muta) {
    const usato = data.partecipazioni.some(
      (p) =>
        p.manicchiaId === manicchiaId &&
        tipoOf(p) === tipoOf(pezzo) &&
        normalizeText(p.pezzo) === normalizeText(pezzo.nome) &&
        normalizeText(p.muta) === normalizeText(muta)
    );
    if (usato) {
      showToast?.(
        "error",
        "Impossibile eliminare: muta presente nello storico."
      );
      return;
    }

    const restanti = pezzo.mute.filter((m) => m !== muta);
    try {
      if (restanti.length === 0) {
        await dbDeletePezzo(pezzo.id);
        setEditId(null);
        await reloadData();
        showToast?.("success", "Muta eliminata: pezzo rimosso perché vuoto.");
      } else {
        await dbUpsertPezzo({ ...pezzo, mute: restanti });
        await reloadData();
        showToast?.("success", "Muta eliminata correttamente.");
      }
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante l'eliminazione.");
    }
  }

  async function spostaPezzo(pezzo, dir) {
    const scope = data.pezzi.filter(
      (p) => p.manicchiaId === manicchiaId && tipoOf(p) === tipoCero
    );
    const i = scope.findIndex((p) => p.id === pezzo.id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= scope.length) return;

    const reordered = scope.slice();
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];

    try {
      await Promise.all(
        reordered.map((p, idx) => dbUpsertPezzo({ ...p, ordine: idx }))
      );
      await reloadData();
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante lo spostamento.");
    }
  }

  return (
    <section>
      <Header title="Gestione Pezzi" onBack={() => setPage("admin")} />

      <CeroTabs value={tipoCero} onChange={setTipoCero} />

      <div className="panel">
        {isSuper && (
          <label>
            Manicchia
            <select
              value={selManicchiaId}
              onChange={(e) => setSelManicchiaId(e.target.value)}
            >
              {data.manicchie.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Pezzo
          <input
            value={pezzoNome}
            onChange={(e) => setPezzoNome(e.target.value)}
            placeholder="Nome del pezzo"
          />
        </label>

        <label>
          Muta
          <input
            value={mutaNome}
            onChange={(e) => setMutaNome(e.target.value)}
            placeholder="Nome della muta"
          />
        </label>

        <button type="button" className="primary-button" onClick={aggiungi}>
          Aggiungi
        </button>
      </div>

      <div className="list-card">
        {visibleData.pezzi.length === 0 ? (
          <div className="list-empty">
            Nessun pezzo per il {TIPO_CERO_LABEL[tipoCero]}.
          </div>
        ) : (
          visibleData.pezzi.map((p, idx) => {
            const aperto = editId === p.id;
            return (
              <div className="pezzo-block" key={p.id}>
                <div className="list-row">
                  <Img src={assets.pezzi} alt="" className="row-icon" />
                  <div className="row-text">
                    <strong>{p.nome}</strong>
                    <span>{p.mute.join(" · ")}</span>
                  </div>

                  <div className="row-actions">
                    <IconButton
                      kind="edit"
                      label="Modifica pezzo"
                      onClick={() => setEditId(aperto ? null : p.id)}
                    />
                    <IconButton
                      kind="delete"
                      label="Elimina pezzo"
                      onClick={() => eliminaPezzo(p)}
                    />
                  </div>
                </div>

                {aperto && (
                  <div className="pezzo-edit">
                    <div className="pezzo-edit-tools">
                      <span className="pezzo-edit-label">Posizione pezzo</span>
                      <div className="row-actions">
                        <IconButton
                          kind="up"
                          label="Sposta su"
                          disabled={idx === 0}
                          onClick={() => spostaPezzo(p, "up")}
                        />
                        <IconButton
                          kind="down"
                          label="Sposta giù"
                          disabled={idx === visibleData.pezzi.length - 1}
                          onClick={() => spostaPezzo(p, "down")}
                        />
                      </div>
                    </div>

                    <span className="pezzo-edit-label">Mute</span>
                    {p.mute.map((m) => (
                      <div className="muta-edit-row" key={m}>
                        <span>{m}</span>
                        <IconButton
                          kind="delete"
                          label={`Elimina ${m}`}
                          onClick={() => eliminaMuta(p, m)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}



function AdminImportPage({
  data,
  setData,
  reloadData,
  setPage,
  currentUser,
  activeManicchiaId,
  showToast,
}) {
  const manicchiaId = getUserManicchiaId(currentUser, activeManicchiaId);
  const manicchia = data.manicchie.find((m) => m.id === manicchiaId);
  const manicchiaNome = manicchia?.nome || "Torre dei Calzolari";

  const isSuper = currentUser?.ruolo === "super_admin";
  const [tipoCero, setTipoCero] = useState("grande");
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);

  const IMPORT_HEADER = [
    "anno",
    "tipoCero",
    "manicchia",
    "pezzo",
    "muta",
    "posizione",
    "cognome",
    "nome",
    "soprannome",
  ];

  // Admin normale: una riga per ogni posizione di ogni muta della SUA manicchia (per il tipo cero attivo).
  function buildModelRowsManicchia(tipo) {
    const pezziManicchia = data.pezzi.filter(
      (p) => p.manicchiaId === manicchiaId && tipoOf(p) === tipo
    );
    const source = pezziManicchia.length
      ? pezziManicchia.map((p) => ({ nome: p.nome, mute: p.mute }))
      : PEZZI_TEMPLATE[tipo];

    const righe = [];
    source.forEach((pezzo) => {
      pezzo.mute.forEach((muta) => {
        POSIZIONI_BASE.forEach((posizione) => {
          righe.push(
            `2026;${tipo};${manicchiaNome};${pezzo.nome};${muta};${posizione};;;`
          );
        });
      });
    });
    return righe;
  }

  // Super admin: una sola muta generica (solo le posizioni), manicchia/pezzo/muta da compilare a mano.
  function buildModelRowsGenerico(tipo) {
    return POSIZIONI_BASE.map((posizione) => `2026;${tipo};;;;${posizione};;;`);
  }

  function downloadCsv(filename, content) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function scaricaModello() {
    const righe = isSuper
      ? buildModelRowsGenerico(tipoCero)
      : buildModelRowsManicchia(tipoCero);
    const content = [IMPORT_HEADER.join(";"), ...righe].join("\n");
    downloadCsv(`modello_import_${tipoCero}_santonio.csv`, content);
    showToast?.(
      "success",
      `Modello ${TIPO_CERO_LABEL[tipoCero]} scaricato correttamente.`
    );
  }

  function parseFile(file) {
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length);

      if (lines.length === 0) {
        setPreview([]);
        setErrors(["File vuoto."]);
        showToast?.("error", "Il file è vuoto.");
        return;
      }

      // Mappa le colonne in base ai nomi dell'intestazione (robusto su Grande/Mezzano e ordine).
      const sep = lines[0].includes(";") ? ";" : ",";
      const headerCells = lines[0]
        .split(sep)
        .map((h) => normalizeText(h).replace(/\s+/g, ""));
      const idx = (name) => headerCells.indexOf(normalizeText(name));

      const iAnno = idx("anno");
      const iTipo = idx("tipocero");
      const iPezzo = idx("pezzo");
      const iMuta = idx("muta");
      const iPos = idx("posizione");
      const iCognome = idx("cognome");
      const iNome = idx("nome");
      const iSoprannome = idx("soprannome");
      const iMan = idx("manicchia");

      const resolveManicchia = (raw) => {
        // Admin normale: sempre la sua manicchia. Super admin: quella scritta nel file.
        if (!isSuper) {
          return { id: manicchiaId, nome: manicchiaNome, ok: true };
        }
        const nome = (raw || "").trim();
        if (!nome) return { id: "", nome: "", ok: false };
        const m = data.manicchie.find(
          (x) => normalizeText(x.nome) === normalizeText(nome)
        );
        return m
          ? { id: m.id, nome: m.nome, ok: true }
          : { id: "", nome, ok: false };
      };

      const parsed = [];
      const newErrors = [];

      lines.slice(1).forEach((line, index) => {
        const cells = line.split(sep);
        const at = (i) => (i >= 0 ? (cells[i] || "").trim() : "");

        const tipoCella = normalizeText(at(iTipo));
        const tipo = tipoCella === "mezzano" ? "mezzano" : "grande";
        const man = resolveManicchia(at(iMan));

        const row = {
          anno: Number(at(iAnno)),
          tipoCero: tipo,
          manicchiaId: man.id,
          manicchiaNome: man.nome,
          pezzo: at(iPezzo),
          muta: at(iMuta),
          posizione: at(iPos),
          cognome: at(iCognome),
          nome: at(iNome),
          soprannome: at(iSoprannome),
        };

        // Righe senza ceraiolo (modello vuoto) vengono semplicemente ignorate, non sono errori.
        if (!row.cognome && !row.nome) return;

        if (
          !row.anno ||
          !row.pezzo ||
          !row.muta ||
          !row.posizione ||
          !row.cognome ||
          !row.nome
        ) {
          newErrors.push(`Riga ${index + 2}: dati incompleti`);
        } else if (!man.ok) {
          newErrors.push(
            `Riga ${index + 2}: manicchia ${
              man.nome ? `"${man.nome}" non trovata` : "mancante"
            }`
          );
        } else {
          parsed.push(row);
        }
      });

      setPreview(parsed);
      setErrors(newErrors);

      if (parsed.length === 0 && newErrors.length === 0) {
        showToast?.("error", "Nessuna riga compilata trovata.");
      } else if (newErrors.length > 0) {
        showToast?.("error", "File letto con alcuni errori.");
      } else {
        showToast?.("success", "File letto correttamente.");
      }
    };

    reader.readAsText(file);
  }

  async function confermaImport() {
    if (preview.length === 0) {
      showToast?.("error", "Nessun dato da importare.");
      return;
    }

    const rows = preview.map((row) => ({
      ...row,
      manicchiaId: row.manicchiaId || manicchiaId,
    }));

    try {
      const res = await dbImportRows(rows, data);
      await reloadData();
      showToast?.(
        "success",
        `Import completato. Righe importate: ${res.importate}` +
          (res.ceraioliCreati
            ? ` · nuovi ceraioli: ${res.ceraioliCreati}.`
            : ".")
      );
      setPreview([]);
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante l'import.");
    }
  }

  return (
    <section>
      <Header title="Importa Excel" onBack={() => setPage("admin")} />

      <CeroTabs value={tipoCero} onChange={setTipoCero} />

      <div className="panel">
        <button type="button" className="primary-button" onClick={scaricaModello}>
          Scarica modello {TIPO_CERO_LABEL[tipoCero]}
        </button>

        <label style={{ marginTop: 18 }}>
          Carica file compilato
          <input
            type="file"
            accept=".csv,.txt,.xls"
            onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
          />
        </label>

        <p className="import-hint">
          {isSuper
            ? "Il modello contiene una muta generica con tutte le posizioni: compila manicchia, pezzo, muta e i ceraioli."
            : "Il modello contiene già tutte le mute della tua manicchia con le relative posizioni: basta compilare cognome, nome ed eventuale soprannome."}
        </p>
      </div>

      {errors.length > 0 && (
        <div className="panel">
          <strong style={{ color: "#980000" }}>Errori</strong>
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      {preview.length > 0 && (
        <div className="panel">
          <strong>Anteprima righe importate: {preview.length}</strong>

          {preview.slice(0, 8).map((r, i) => (
            <div className="history-row" key={i}>
              <span>
                {r.anno} · {TIPO_CERO_LABEL[r.tipoCero]} · {r.pezzo}
              </span>
              <span>
                {isSuper ? `${r.manicchiaNome} · ` : ""}
                {r.muta} · {r.posizione}
                <br />
                {r.cognome} {r.nome}
              </span>
            </div>
          ))}

          <button type="button" className="primary-button" onClick={confermaImport}>
            Conferma importazione
          </button>
        </div>
      )}
    </section>
  );
}



function AdminUsersPage({ setPage }) {
  return (
    <section>
      <Header title="Gestione Admin" onBack={() => setPage("admin")} />
      <div className="panel">
        <p style={{ margin: 0, color: "#6a625d", lineHeight: 1.5 }}>
          Gli account amministratore si gestiscono direttamente da Supabase, per
          motivi di sicurezza (non è possibile crearli in modo sicuro dal
          browser):
        </p>
        <ol style={{ color: "#6a625d", lineHeight: 1.6, paddingLeft: 18, marginBottom: 0 }}>
          <li>
            <b>Authentication → Users → Add user</b>: crea l'utente con email e
            password.
          </li>
          <li>
            <b>SQL Editor</b>: aggiungi una riga nella tabella <code>profili</code>{" "}
            con il suo UID, scegliendo il ruolo (<code>super_admin</code> oppure{" "}
            <code>admin_manicchia</code>) e l'eventuale manicchia.
          </li>
        </ol>
      </div>
    </section>
  );
}



function AdminManicchiePage({ data, setData, reloadData, setPage, showToast }) {
  const [nome, setNome] = useState("");

  async function aggiungiManicchia() {
    if (!nome.trim()) {
      showToast?.("error", "Inserisci il nome della manicchia.");
      return;
    }

    const exists = data.manicchie.some(
      (m) => normalizeText(m.nome) === normalizeText(nome)
    );
    if (exists) {
      showToast?.("error", "Manicchia già presente.");
      return;
    }

    try {
      await dbAddManicchia(`${slugify(nome)}-${Date.now()}`, nome.trim());
      await reloadData();
      setNome("");
      showToast?.("success", "Manicchia aggiunta correttamente.");
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante il salvataggio.");
    }
  }

  async function eliminaManicchia(id) {
    if (id === "torre-calzolari") {
      showToast?.("error", "Non puoi eliminare la manicchia principale.");
      return;
    }

    const usata =
      data.ceraioli.some((c) => c.manicchiaId === id) ||
      data.pezzi.some((p) => p.manicchiaId === id) ||
      data.partecipazioni.some((p) => p.manicchiaId === id);

    if (usata) {
      showToast?.(
        "error",
        "Impossibile eliminare: manicchia collegata a dati esistenti."
      );
      return;
    }

    try {
      await dbDeleteManicchia(id);
      await reloadData();
      showToast?.("success", "Manicchia eliminata correttamente.");
    } catch (e) {
      showToast?.("error", e?.message || "Errore durante l'eliminazione.");
    }
  }

  return (
    <section>
      <Header title="Manicchie" onBack={() => setPage("admin")} />

      <div className="panel">
        <label>
          Nome manicchia
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome della manicchia"
          />
        </label>

        <button type="button" className="primary-button" onClick={aggiungiManicchia}>
          Aggiungi
        </button>
      </div>

      <div className="list-card">
        {data.manicchie.map((m) => (
          <div className="list-row" key={m.id}>
            <Img src={assets.manicchie} alt="" className="row-icon" />
            <div className="row-text">
              <strong>{m.nome}</strong>
              <span>S.Antonio</span>
            </div>

            <IconButton
              kind="delete"
              label="Elimina manicchia"
              onClick={() => eliminaManicchia(m.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState("home");
  const [currentUser, setCurrentUser] = useState(null);
  const [muteEditTarget, setMuteEditTarget] = useState(null);
  const [activeManicchiaId] = useState("torre-calzolari");
  const [showSplash, setShowSplash] = useState(true);
  const { toast, showToast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 2400);
    return () => window.clearTimeout(timer);
  }, []);

  // Carica l'archivio condiviso da Supabase (lettura pubblica).
  useEffect(() => {
    let alive = true;
    fetchAllData()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setLoadingData(false);
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(e?.message || "Errore di caricamento dei dati.");
        setLoadingData(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Ricarica l'archivio da Supabase dopo una scrittura.
  const reloadData = async () => {
    const d = await fetchAllData();
    setData(d);
    return d;
  };

  // Se c'è già una sessione admin attiva (es. dopo un refresh), la ripristina.
  useEffect(() => {
    let alive = true;
    getSessionUser()
      .then((u) => {
        if (alive && u) setCurrentUser(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const visibleData = getVisibleData(data, activeManicchiaId);

  const [selectedCeraiolo, setSelectedCeraiolo] = useState(
    visibleData.ceraioli[0]
  );

  const grandeData = filterByTipo(visibleData, "grande");
  const grandeYears = getYearsByTipo(visibleData, "grande");
  const firstGrandePezzo = grandeData.pezzi[0];

  const [selection, setSelection] = useState({
    tipoCero: "grande",
    manicchiaId: activeManicchiaId,
    anno: grandeYears[0] || new Date().getFullYear(),
    pezzoId: firstGrandePezzo?.id || "",
    muta: firstGrandePezzo?.mute?.[0] || "",
  });

  const content = useMemo(() => {
    const publicData = getVisibleData(data, activeManicchiaId);

    if (page === "home") return <Home data={publicData} setPage={setPage} />;
    if (page === "archive") {
      return (
        <ArchivePage
          data={data}
          setPage={setPage}
          selection={selection}
          setSelection={setSelection}
        />
      );
    }
    if (page === "muta") {
      return <MutaPage data={data} setPage={setPage} selection={selection} />;
    }
    if (page === "ceraioli") {
      return (
        <CeraioliPage
          data={publicData}
          allData={data}
          setPage={setPage}
          setSelectedCeraiolo={setSelectedCeraiolo}
        />
      );
    }
    if (page === "scheda") {
      return (
        <SchedaCeraioloPage
          data={publicData}
          setPage={setPage}
          ceraiolo={selectedCeraiolo}
        />
      );
    }
    if (page === "login") {
      return (
        <LoginPage
          data={data}
          setPage={setPage}
          setCurrentUser={setCurrentUser}
          showToast={showToast}
        />
      );
    }

    if (!currentUser && page.startsWith("admin")) {
      return (
        <LoginPage
          data={data}
          setPage={setPage}
          setCurrentUser={setCurrentUser}
          showToast={showToast}
        />
      );
    }

    if (page === "admin") {
      return <AdminPage setPage={setPage} currentUser={currentUser} />;
    }
    if (page === "admin-manicchie") {
      return (
        <AdminManicchiePage
          data={data}
          setData={setData}
          reloadData={reloadData}
          setPage={setPage}
          showToast={showToast}
        />
      );
    }
    if (page === "admin-mute") {
      return (
        <AdminMuteHubPage
          data={data}
          setData={setData}
          reloadData={reloadData}
          setPage={setPage}
          currentUser={currentUser}
          activeManicchiaId={activeManicchiaId}
          showToast={showToast}
          openMutaEditor={(item) => {
            setMuteEditTarget(item);
            setPage("admin-muta");
          }}
        />
      );
    }
    if (page === "admin-muta") {
      return (
        <AdminMutaPage
          key={
            muteEditTarget && muteEditTarget.muta
              ? `edit-${muteEditTarget.manicchiaId || ""}-${muteEditTarget.tipoCero || "grande"}-${muteEditTarget.anno}-${muteEditTarget.pezzo}-${muteEditTarget.muta}`
              : `new-${muteEditTarget?.tipoCero || "grande"}`
          }
          data={data}
          setData={setData}
          reloadData={reloadData}
          setPage={setPage}
          currentUser={currentUser}
          activeManicchiaId={activeManicchiaId}
          showToast={showToast}
          editTarget={muteEditTarget}
        />
      );
    }
    if (page === "admin-ceraioli") {
      return (
        <AdminCeraioliPage
          data={data}
          setData={setData}
          reloadData={reloadData}
          setPage={setPage}
          currentUser={currentUser}
          activeManicchiaId={activeManicchiaId}
          showToast={showToast}
        />
      );
    }
    if (page === "admin-pezzi") {
      return (
        <AdminPezziPage
          data={data}
          setData={setData}
          reloadData={reloadData}
          setPage={setPage}
          currentUser={currentUser}
          activeManicchiaId={activeManicchiaId}
          showToast={showToast}
        />
      );
    }
    if (page === "admin-import") {
      return (
        <AdminImportPage
          data={data}
          setData={setData}
          reloadData={reloadData}
          setPage={setPage}
          currentUser={currentUser}
          activeManicchiaId={activeManicchiaId}
          showToast={showToast}
        />
      );
    }
    if (page === "admin-users") {
      return (
        <AdminUsersPage
          data={data}
          setData={setData}
          reloadData={reloadData}
          setPage={setPage}
          showToast={showToast}
          currentUser={currentUser}
        />
      );
    }

    return <Home data={publicData} setPage={setPage} />;
  }, [
    page,
    data,
    selection,
    selectedCeraiolo,
    currentUser,
    activeManicchiaId,
    muteEditTarget,
    showToast,
  ]);

  if (showSplash || loadingData) {
    return <SplashScreen />;
  }

  if (loadError) {
    return (
      <div className="load-error">
        <h3>Impossibile caricare l'archivio</h3>
        <p>{loadError}</p>
        <button
          type="button"
          className="primary-button"
          onClick={() => window.location.reload()}
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <AppFrame page={page} setPage={setPage}>
      <Toast toast={toast} />
      {content}
    </AppFrame>
  );
}
