// Strato dati: legge/scrive l'archivio condiviso su Supabase e gestisce il login admin.
import { supabase } from "./supabaseClient";

export const EMPTY_DATA = {
  manicchie: [],
  admins: [],
  ceraioli: [],
  pezzi: [],
  partecipazioni: [],
};

const norm = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

// Formatta un nome: iniziale maiuscola di ogni parola, resto minuscolo.
// Es: "MARIO rossi" -> "Mario Rossi", "d'angelo" -> "D'Angelo".
const titleCase = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'’\-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());


// Normalizzazione robusta per confronto ceraioli in import:
// ignora maiuscole/minuscole, accenti, apostrofi, trattini e spazi multipli.
const personNorm = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const personTokens = (...parts) =>
  parts
    .map(personNorm)
    .join(" ")
    .split(" ")
    .filter(Boolean)
    .sort()
    .join("|");

// ---------------- LETTURA ----------------

export async function fetchAllData() {
  const [manicchie, ceraioli, pezzi, partecipazioni] = await Promise.all([
    supabase.from("manicchie").select("*"),
    supabase.from("ceraioli").select("*"),
    supabase.from("pezzi").select("*"),
    supabase.from("partecipazioni").select("*"),
  ]);

  const error =
    manicchie.error || ceraioli.error || pezzi.error || partecipazioni.error;
  if (error) throw error;

  return {
    manicchie: (manicchie.data || []).map((m) => ({ id: m.id, nome: m.nome })),
    admins: [],
    ceraioli: (ceraioli.data || []).map((c) => ({
      id: Number(c.id),
      manicchiaId: c.manicchia_id,
      nome: c.nome,
      cognome: c.cognome,
      soprannome: c.soprannome || "",
    })),
    pezzi: (pezzi.data || [])
      .slice()
      .sort(
        (a, b) =>
          String(a.manicchia_id).localeCompare(String(b.manicchia_id)) ||
          String(a.tipo_cero).localeCompare(String(b.tipo_cero)) ||
          (a.ordine ?? 0) - (b.ordine ?? 0)
      )
      .map((p) => ({
        id: p.id,
        manicchiaId: p.manicchia_id,
        tipoCero: p.tipo_cero,
        nome: p.nome,
        mute: p.mute || [],
        ordine: p.ordine ?? 0,
      })),
    partecipazioni: (partecipazioni.data || []).map((p) => ({
      id: p.id,
      manicchiaId: p.manicchia_id,
      tipoCero: p.tipo_cero,
      anno: p.anno,
      pezzo: p.pezzo,
      muta: p.muta,
      posizione: p.posizione,
      ceraioloId: p.ceraiolo_id == null ? null : Number(p.ceraiolo_id),
    })),
  };
}

// ---------------- AUTENTICAZIONE ----------------

async function buildCurrentUser(authUser) {
  const { data: prof, error } = await supabase
    .from("profili")
    .select("ruolo, manicchia_id")
    .eq("user_id", authUser.id)
    .single();
  if (error || !prof) {
    throw new Error(
      "Accesso riuscito ma manca il profilo (ruolo). Contatta l'amministratore."
    );
  }
  return {
    id: authUser.id,
    email: authUser.email,
    ruolo: prof.ruolo,
    manicchiaId: prof.manicchia_id,
  };
}

export async function adminLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password,
  });
  if (error) throw error;
  return buildCurrentUser(data.user);
}

export async function adminLogout() {
  await supabase.auth.signOut();
}

export async function getSessionUser() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) return null;
  try {
    return await buildCurrentUser(session.user);
  } catch {
    return null;
  }
}

// ---------------- SCRITTURA ----------------

// CERAIOLI
export async function dbAddCeraiolo(manicchiaId, { nome, cognome, soprannome }) {
  const { data, error } = await supabase
    .from("ceraioli")
    .insert({
      manicchia_id: manicchiaId,
      nome: titleCase(nome),
      cognome: titleCase(cognome),
      soprannome: titleCase(soprannome),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function dbDeleteCeraiolo(id) {
  const { error } = await supabase.from("ceraioli").delete().eq("id", id);
  if (error) throw error;
}

// PEZZI
export async function dbUpsertPezzo(pezzo) {
  const { error } = await supabase.from("pezzi").upsert({
    id: pezzo.id,
    manicchia_id: pezzo.manicchiaId,
    tipo_cero: pezzo.tipoCero,
    nome: pezzo.nome,
    mute: pezzo.mute,
    ordine: pezzo.ordine ?? 0,
  });
  if (error) throw error;
}

export async function dbDeletePezzo(id) {
  const { error } = await supabase.from("pezzi").delete().eq("id", id);
  if (error) throw error;
}

// MANICCHIE
export async function dbAddManicchia(id, nome) {
  const { error } = await supabase.from("manicchie").insert({ id, nome });
  if (error) throw error;
}

export async function dbDeleteManicchia(id) {
  const { error } = await supabase.from("manicchie").delete().eq("id", id);
  if (error) throw error;
}

// PARTECIPAZIONI
export async function dbInsertPartecipazioni(rows) {
  if (!rows || !rows.length) return;
  const payload = rows.map((r) => ({
    manicchia_id: r.manicchiaId,
    tipo_cero: r.tipoCero,
    anno: Number(r.anno),
    pezzo: r.pezzo,
    muta: r.muta,
    posizione: r.posizione,
    ceraiolo_id: r.ceraioloId,
  }));
  const { error } = await supabase.from("partecipazioni").insert(payload);
  if (error) throw error;
}

export async function dbDeleteMutaRows(manicchiaId, tipoCero, anno, pezzo, muta) {
  const { error } = await supabase
    .from("partecipazioni")
    .delete()
    .eq("manicchia_id", manicchiaId)
    .eq("tipo_cero", tipoCero)
    .eq("anno", Number(anno))
    .eq("pezzo", pezzo)
    .eq("muta", muta);
  if (error) throw error;
}

// Salva una muta: cancella le righe esistenti (e quelle originali se in modifica)
// e inserisce quelle nuove.
export async function dbSaveMuta({ manicchiaId, tipoCero, anno, pezzo, muta, righe, originale }) {
  await dbDeleteMutaRows(manicchiaId, tipoCero, anno, pezzo, muta);
  if (
    originale &&
    (Number(originale.anno) !== Number(anno) ||
      originale.pezzo !== pezzo ||
      originale.muta !== muta)
  ) {
    await dbDeleteMutaRows(
      manicchiaId,
      tipoCero,
      originale.anno,
      originale.pezzo,
      originale.muta
    );
  }
  await dbInsertPartecipazioni(righe);
}

// IMPORT: garantisce pezzi/mute, crea i ceraioli mancanti e inserisce le partecipazioni.
// "data" è lo stato attuale dell'app (per riconoscere ciò che già esiste).
export async function dbImportRows(rows, data) {
  // 1) Garantisci pezzi e mute
  const pezziByKey = new Map();
  data.pezzi.forEach((p) =>
    pezziByKey.set(`${p.manicchiaId}|${norm(p.tipoCero)}|${norm(p.nome)}`, {
      ...p,
      mute: [...p.mute],
    })
  );

  let maxOrdine = new Map(); // per manicchia|tipo
  data.pezzi.forEach((p) => {
    const k = `${p.manicchiaId}|${norm(p.tipoCero)}`;
    maxOrdine.set(k, Math.max(maxOrdine.get(k) ?? -1, p.ordine ?? 0));
  });

  const pezziDaSalvare = new Map();
  rows.forEach((r) => {
    const key = `${r.manicchiaId}|${norm(r.tipoCero)}|${norm(r.pezzo)}`;
    let pezzo = pezziByKey.get(key);
    if (!pezzo) {
      const k = `${r.manicchiaId}|${norm(r.tipoCero)}`;
      const ordine = (maxOrdine.get(k) ?? -1) + 1;
      maxOrdine.set(k, ordine);
      pezzo = {
        id: `${String(r.tipoCero)[0]}-${norm(r.pezzo).replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        manicchiaId: r.manicchiaId,
        tipoCero: r.tipoCero,
        nome: r.pezzo,
        mute: [],
        ordine,
      };
      pezziByKey.set(key, pezzo);
    }
    if (!pezzo.mute.some((m) => norm(m) === norm(r.muta))) {
      pezzo.mute.push(r.muta);
      pezziDaSalvare.set(pezzo.id, pezzo);
    }
  });
  for (const pezzo of pezziDaSalvare.values()) {
    await dbUpsertPezzo(pezzo);
  }

  // 2) Risolvi/crea i ceraioli mancanti.
  // L'import deve essere tollerante: "MARIO ROSSI", "Mario Rossi", "Rossi Mario"
  // e piccole differenze di spazi/apostrofi devono riconoscere lo stesso ceraiolo.
  const ceraioloKey = (manicchiaId, nome, cognome, soprannome) =>
    `${manicchiaId}|${personNorm(nome)}|${personNorm(cognome)}|${personNorm(soprannome)}`;

  const ceraioliByExact = new Map();
  const ceraioliByNoNick = new Map();
  const ceraioliBySwapped = new Map();
  const ceraioliByTokenBag = new Map();

  function addToMultiMap(map, key, id) {
    if (!key) return;
    const list = map.get(key) || [];
    if (!list.includes(id)) list.push(id);
    map.set(key, list);
  }

  data.ceraioli.forEach((c) => {
    const id = Number(c.id);
    ceraioliByExact.set(
      ceraioloKey(c.manicchiaId, c.nome, c.cognome, c.soprannome),
      id
    );

    addToMultiMap(
      ceraioliByNoNick,
      `${c.manicchiaId}|${personNorm(c.nome)}|${personNorm(c.cognome)}`,
      id
    );
    addToMultiMap(
      ceraioliBySwapped,
      `${c.manicchiaId}|${personNorm(c.cognome)}|${personNorm(c.nome)}`,
      id
    );
    addToMultiMap(
      ceraioliByTokenBag,
      `${c.manicchiaId}|${personTokens(c.nome, c.cognome)}`,
      id
    );
  });

  function uniqueIdFrom(map, key) {
    const list = map.get(key) || [];
    return list.length === 1 ? list[0] : null;
  }

  function resolveCeraioloId(r) {
    if (r.ceraioloId) return Number(r.ceraioloId);

    const exact = ceraioliByExact.get(
      ceraioloKey(r.manicchiaId, r.nome, r.cognome, r.soprannome)
    );
    if (exact) return Number(exact);

    // stesso nome+cognome, ignorando soprannome
    const noNick = uniqueIdFrom(
      ceraioliByNoNick,
      `${r.manicchiaId}|${personNorm(r.nome)}|${personNorm(r.cognome)}`
    );
    if (noNick) return Number(noNick);

    // nome e cognome invertiti nel file Excel/CSV
    const swapped = uniqueIdFrom(
      ceraioliBySwapped,
      `${r.manicchiaId}|${personNorm(r.nome)}|${personNorm(r.cognome)}`
    );
    if (swapped) return Number(swapped);

    // confronto per parole: utile per casi come doppi nomi/spazi differenti
    const token = uniqueIdFrom(
      ceraioliByTokenBag,
      `${r.manicchiaId}|${personTokens(r.nome, r.cognome)}`
    );
    if (token) return Number(token);

    return null;
  }

  const daCreare = new Map();
  rows.forEach((r) => {
    if (resolveCeraioloId(r)) return;

    // Se nel file nome/cognome sono invertiti ma non esiste una corrispondenza,
    // qui vengono comunque creati nel formato indicato dal file.
    const k = ceraioloKey(r.manicchiaId, r.nome, r.cognome, r.soprannome);
    if (!daCreare.has(k)) {
      daCreare.set(k, {
        manicchia_id: r.manicchiaId,
        nome: titleCase(r.nome),
        cognome: titleCase(r.cognome),
        soprannome: titleCase(r.soprannome),
      });
    }
  });

  let creati = 0;
  if (daCreare.size) {
    const { data: inseriti, error } = await supabase
      .from("ceraioli")
      .insert(Array.from(daCreare.values()))
      .select();
    if (error) throw error;
    creati = inseriti.length;
    inseriti.forEach((c) => {
      const id = Number(c.id);
      ceraioliByExact.set(
        ceraioloKey(c.manicchia_id, c.nome, c.cognome, c.soprannome),
        id
      );
      addToMultiMap(
        ceraioliByNoNick,
        `${c.manicchia_id}|${personNorm(c.nome)}|${personNorm(c.cognome)}`,
        id
      );
      addToMultiMap(
        ceraioliBySwapped,
        `${c.manicchia_id}|${personNorm(c.cognome)}|${personNorm(c.nome)}`,
        id
      );
      addToMultiMap(
        ceraioliByTokenBag,
        `${c.manicchia_id}|${personTokens(c.nome, c.cognome)}`,
        id
      );
    });
  }

  // 3) Inserisci le partecipazioni (saltando i duplicati già presenti)
  const esistenti = new Set(
    data.partecipazioni.map(
      (p) =>
        `${p.manicchiaId}|${norm(p.tipoCero)}|${p.anno}|${norm(p.pezzo)}|${norm(p.muta)}|${norm(p.posizione)}|${p.ceraioloId}`
    )
  );

  const daInserire = [];
  rows.forEach((r) => {
    const ceraioloId = resolveCeraioloId(r);
    if (!ceraioloId) return;

    // Usa la grafia UFFICIALE del pezzo e della muta (non quella del file).
    const pezzo = pezziByKey.get(
      `${r.manicchiaId}|${norm(r.tipoCero)}|${norm(r.pezzo)}`
    );
    const pezzoNome = pezzo ? pezzo.nome : r.pezzo;
    const mutaNome = pezzo
      ? pezzo.mute.find((m) => norm(m) === norm(r.muta)) || r.muta
      : r.muta;

    const sig = `${r.manicchiaId}|${norm(r.tipoCero)}|${Number(r.anno)}|${norm(pezzoNome)}|${norm(mutaNome)}|${norm(r.posizione)}|${ceraioloId}`;
    if (esistenti.has(sig)) return;
    esistenti.add(sig);
    daInserire.push({
      manicchiaId: r.manicchiaId,
      tipoCero: r.tipoCero,
      anno: r.anno,
      pezzo: pezzoNome,
      muta: mutaNome,
      posizione: r.posizione,
      ceraioloId,
    });
  });

  await dbInsertPartecipazioni(daInserire);

  return { importate: daInserire.length, ceraioliCreati: creati };
}

// --- GESTIONE ADMIN (tramite Edge Function sicura "admin-management") ---

async function callAdminFn(action, payload) {
  const { data, error } = await supabase.functions.invoke("admin-management", {
    body: { action, payload },
  });
  if (error) {
    let msg = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) msg = body.error;
    } catch (_) {
      // ignora: usa il messaggio generico
    }
    throw new Error(msg || "Errore della funzione admin.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listAdmins() {
  const data = await callAdminFn("list");
  return data.admins || [];
}

export async function createAdmin({ email, password, ruolo, manicchiaId }) {
  return callAdminFn("create", { email, password, ruolo, manicchiaId });
}

export async function deleteAdmin(userId) {
  return callAdminFn("delete", { userId });
}
