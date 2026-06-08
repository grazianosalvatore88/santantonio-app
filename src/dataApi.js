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
      nome: nome.trim(),
      cognome: cognome.trim(),
      soprannome: (soprannome || "").trim(),
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

  // 2) Crea i ceraioli mancanti
  const ceraioloKey = (manicchiaId, nome, cognome, soprannome) =>
    `${manicchiaId}|${norm(nome)}|${norm(cognome)}|${norm(soprannome)}`;
  const ceraioliById = new Map();
  data.ceraioli.forEach((c) =>
    ceraioliById.set(
      ceraioloKey(c.manicchiaId, c.nome, c.cognome, c.soprannome),
      c.id
    )
  );

  const daCreare = new Map();
  rows.forEach((r) => {
    const k = ceraioloKey(r.manicchiaId, r.nome, r.cognome, r.soprannome);
    if (!ceraioliById.has(k) && !daCreare.has(k)) {
      daCreare.set(k, {
        manicchia_id: r.manicchiaId,
        nome: r.nome.trim(),
        cognome: r.cognome.trim(),
        soprannome: (r.soprannome || "").trim(),
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
    inseriti.forEach((c) =>
      ceraioliById.set(
        ceraioloKey(c.manicchia_id, c.nome, c.cognome, c.soprannome),
        c.id
      )
    );
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
    const ceraioloId = ceraioliById.get(
      ceraioloKey(r.manicchiaId, r.nome, r.cognome, r.soprannome)
    );
    if (!ceraioloId) return;
    const sig = `${r.manicchiaId}|${norm(r.tipoCero)}|${Number(r.anno)}|${norm(r.pezzo)}|${norm(r.muta)}|${norm(r.posizione)}|${ceraioloId}`;
    if (esistenti.has(sig)) return;
    esistenti.add(sig);
    daInserire.push({
      manicchiaId: r.manicchiaId,
      tipoCero: r.tipoCero,
      anno: r.anno,
      pezzo: r.pezzo,
      muta: r.muta,
      posizione: r.posizione,
      ceraioloId,
    });
  });

  await dbInsertPartecipazioni(daInserire);

  return { importate: daInserire.length, ceraioliCreati: creati };
}