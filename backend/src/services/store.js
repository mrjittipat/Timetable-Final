import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, OUTPUT_DIR, SEED_DIR } from './paths.js';
import { ENTITIES, OUTPUT_FIELDS, normalizeRow, rowKey } from './schema.js';
import { parseCsv, toCsv } from './csv.js';
import { loadCompetitionSeed } from './seed-adapter.js';

let data = {};
let timetable = null;

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function normalizeOutputRow(r = {}) {
  const out = {};
  for (const f of OUTPUT_FIELDS) {
    out[f] = r[f] == null ? '' : String(r[f]).trim();
  }
  return out;
}

function dedupeRows(entity, rawRows) {
  const seen = new Set();
  const out = [];
  for (const r of rawRows) {
    const norm = normalizeRow(entity, r);
    const k = rowKey(entity, norm);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(norm);
  }
  return out;
}

function writeEntityCsv(entity, rows) {
  const def = ENTITIES[entity];
  const fp = path.join(DATA_DIR, def.file);
  fs.writeFileSync(fp, toCsv(rows, def.fields), 'utf8');
}

function ensureSeedFiles(force = false) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const missingAny = Object.values(ENTITIES).some(
    (def) => !fs.existsSync(path.join(DATA_DIR, def.file))
  );
  if (!force && !missingAny) return;

  // Check if standard 7 CSV files exist directly in SEED_DIR
  const hasStandard7 = Object.values(ENTITIES).every((def) =>
    fs.existsSync(path.join(SEED_DIR, def.file))
  );
  if (hasStandard7) {
    for (const def of Object.values(ENTITIES)) {
      const dst = path.join(DATA_DIR, def.file);
      if (force || !fs.existsSync(dst)) {
        fs.copyFileSync(path.join(SEED_DIR, def.file), dst);
      }
    }
    return;
  }

  // Otherwise adapt from competition 4-year CSVs (ชั้นปีที่1..4.csv)
  const adapted = loadCompetitionSeed(SEED_DIR);
  if (adapted) {
    for (const [entity, def] of Object.entries(ENTITIES)) {
      const dst = path.join(DATA_DIR, def.file);
      if (force || !fs.existsSync(dst)) {
        writeEntityCsv(entity, adapted[entity] || []);
      }
    }
  }
}

export function init() {
  ensureSeedFiles(false);
  data = {};
  for (const [entity, def] of Object.entries(ENTITIES)) {
    const fp = path.join(DATA_DIR, def.file);
    if (fs.existsSync(fp)) {
      const raw = parseCsv(fs.readFileSync(fp, 'utf8'));
      data[entity] = dedupeRows(entity, raw);
    } else {
      data[entity] = [];
    }
  }

  const outCsv = path.join(OUTPUT_DIR, 'output.csv');
  const outMeta = path.join(OUTPUT_DIR, 'meta.json');
  if (fs.existsSync(outCsv)) {
    const rows = parseCsv(fs.readFileSync(outCsv, 'utf8')).map(normalizeOutputRow);
    let meta = {};
    if (fs.existsSync(outMeta)) {
      try {
        meta = JSON.parse(fs.readFileSync(outMeta, 'utf8'));
      } catch {
        meta = {};
      }
    }
    timetable = { rows, meta };
  } else {
    timetable = null;
  }
}

export function resetData() {
  ensureSeedFiles(true);
  init();
  return data;
}

export function getData() {
  return data;
}

export function getEntity(entity) {
  if (!ENTITIES[entity]) throw httpError(404, `ไม่พบตาราง ${entity}`);
  return data[entity] || [];
}

export function replaceEntity(entity, rawRows) {
  if (!ENTITIES[entity]) throw httpError(404, `ไม่พบตาราง ${entity}`);
  const rows = dedupeRows(entity, rawRows);
  data[entity] = rows;
  writeEntityCsv(entity, rows);
  return rows;
}

export function addRow(entity, raw) {
  const def = ENTITIES[entity];
  if (!def) throw httpError(404, `ไม่พบตาราง ${entity}`);
  const norm = normalizeRow(entity, raw);
  const missing = def.key.filter((k) => !String(norm[k] ?? '').trim());
  if (missing.length) throw httpError(400, `ต้องระบุ ${missing.join(', ')}`);
  const k = rowKey(entity, norm);
  if ((data[entity] || []).some((r) => rowKey(entity, r) === k)) {
    throw httpError(409, `มีข้อมูลรหัส ${k} อยู่แล้ว`);
  }
  data[entity] = [...(data[entity] || []), norm];
  writeEntityCsv(entity, data[entity]);
  return norm;
}

export function updateRow(entity, key, raw) {
  const def = ENTITIES[entity];
  if (!def) throw httpError(404, `ไม่พบตาราง ${entity}`);
  const list = data[entity] || [];
  const idx = list.findIndex((r) => rowKey(entity, r) === key);
  if (idx === -1) throw httpError(404, `ไม่พบข้อมูลรหัส ${key}`);
  const merged = normalizeRow(entity, { ...list[idx], ...raw });
  const newKey = rowKey(entity, merged);
  if (newKey !== key && list.some((r, i) => i !== idx && rowKey(entity, r) === newKey)) {
    throw httpError(409, `มีข้อมูลรหัส ${newKey} อยู่แล้ว`);
  }
  const next = list.slice();
  next[idx] = merged;
  data[entity] = next;
  writeEntityCsv(entity, next);
  return merged;
}

export function deleteRow(entity, key) {
  const def = ENTITIES[entity];
  if (!def) throw httpError(404, `ไม่พบตาราง ${entity}`);
  const list = data[entity] || [];
  const idx = list.findIndex((r) => rowKey(entity, r) === key);
  if (idx === -1) throw httpError(404, `ไม่พบข้อมูลรหัส ${key}`);
  const next = list.filter((_, i) => i !== idx);
  data[entity] = next;
  writeEntityCsv(entity, next);
  return { deleted: key };
}

export function getTimetable() {
  return timetable;
}

export function setTimetable(rows, meta = {}) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const norm = (rows || []).map(normalizeOutputRow).sort((a, b) => {
    const gc = a.group_id.localeCompare(b.group_id, undefined, { numeric: true });
    if (gc !== 0) return gc;
    const tc = a.timeslot_id.localeCompare(b.timeslot_id, undefined, { numeric: true });
    if (tc !== 0) return tc;
    return a.subject_id.localeCompare(b.subject_id, undefined, { numeric: true });
  });
  const nextMeta = { ...meta, updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'output.csv'), toCsv(norm, OUTPUT_FIELDS), 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'meta.json'), JSON.stringify(nextMeta, null, 2), 'utf8');
  timetable = { rows: norm, meta: nextMeta };
  return timetable;
}
