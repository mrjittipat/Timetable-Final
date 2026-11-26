import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths.js';
import { buildContext } from './context.js';

const SNAP_PATH = path.join(DATA_DIR, 'seed-snapshots.json');

function loadAll() {
  try {
    if (fs.existsSync(SNAP_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(SNAP_PATH, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupt file
  }
  return [];
}

function saveAll(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SNAP_PATH, JSON.stringify(list.slice(-200), null, 2), 'utf8');
}

export function computeSoftCost(rows, data, config) {
  const ctx = buildContext(data, config);
  const lp = ctx.params.latestPreferredPeriod || 9;
  const occ = new Set();
  for (const r of rows || []) {
    const affected = ctx.electiveSets.has(r.group_id)
      ? ctx.electiveSets.get(r.group_id).groups
      : [r.group_id];
    for (const g of affected) occ.add(`${g}|${r.timeslot_id}`);
  }
  let total = 0;
  for (const g of ctx.activeGroups) {
    const loads = [];
    for (let d = 0; d < ctx.days.length; d++) {
      const slots = ctx.daySlots[d];
      let first = -1;
      let last = -1;
      let n = 0;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (occ.has(`${g.group_id}|${s}`)) {
          if (first === -1) first = i;
          last = i;
          n++;
          if (ctx.slotsById.get(s).period > lp) total += 3;
        }
      }
      if (n > 0) total += (last - first + 1 - n) * 2;
      loads.push(n);
    }
    const avg = loads.reduce((a, b) => a + b, 0) / Math.max(1, loads.length);
    for (const l of loads) total += (l - avg) * (l - avg) * 0.3;
  }
  return Number(total.toFixed(2));
}

export function computeSnapshotSeed(rows, constraints) {
  const canonical = (rows || [])
    .map((r) => `${r.group_id}|${r.timeslot_id}|${r.subject_id}|${r.teacher_id}|${r.room_id}`)
    .sort()
    .join('\n');
  const h = crypto
    .createHash('sha256')
    .update(JSON.stringify(constraints || {}) + '\n' + canonical)
    .digest();
  const num = h.readUInt32BE(0) % 900000;
  return 100000 + num;
}

export function saveSnapshot({ rows, data, config, baseSeed = null }) {
  const seed = computeSnapshotSeed(rows, config.constraints);
  const softCost = computeSoftCost(rows, data, config);
  const list = loadAll().filter((x) => x.seed !== seed);
  const entry = {
    seed,
    baseSeed: baseSeed ?? config.params?.seed ?? seed,
    softCost,
    constraints: { ...config.constraints },
    params: { ...config.params, seed },
    rows,
    createdAt: new Date().toISOString(),
  };
  list.push(entry);
  saveAll(list);
  return entry;
}

export function getSnapshot(seed) {
  const s = Number(seed);
  if (!Number.isFinite(s)) return null;
  return loadAll().find((x) => x.seed === s) || null;
}

export function listSnapshots() {
  return loadAll();
}

export function importSnapshots(entries = []) {
  const existing = loadAll();
  const map = new Map(existing.map((e) => [e.seed, e]));
  for (const e of entries) {
    if (e && Number.isFinite(Number(e.seed)) && Array.isArray(e.rows)) {
      map.set(Number(e.seed), e);
    }
  }
  saveAll([...map.values()]);
}
