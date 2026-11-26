import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import express from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import * as store from '../services/store.js';
import { ENTITIES, entityFromFilename } from '../services/schema.js';
import { parseCsv, parseXlsx, toCsv } from '../services/csv.js';
import { buildZip } from '../services/zip.js';
import { convertYearRowsToTables } from '../services/seed-adapter.js';
import { DEFAULT_CONFIG, loadConfig, mergeConfig, saveConfig } from '../services/config.js';
import { buildContext, splitIds } from '../services/context.js';
import { validate } from '../services/validator.js';
import { solve } from '../services/solver.js';
import { buildGrid, entitiesFor, subjectSummary } from '../services/grid.js';
import { editSpan, moveSpan, validMoveTargets } from '../services/editor.js';
import { timetableStats } from '../services/stats.js';
import { exportCsv, exportPdf, exportQrPdf, exportXlsx } from '../services/exporter.js';
import * as snapshots from '../services/snapshots.js';
import * as auth from '../services/auth.js';
import * as hub from '../services/teacher-hub.js';
import { reply as chatReply } from '../services/chatbot/bot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.resolve(__dirname, '../services/solve-worker.js');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 20, fileSize: 10 * 1024 * 1024 } });
const seedGridCache = new Map();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function context() {
  return buildContext(store.getData(), loadConfig());
}

function runWorker(data, config, mode, options = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, { workerData: { mode, data, config, options } });
    const log = [];
    let settled = false;
    worker.on('message', (msg) => {
      if (msg.type === 'progress') log.push(msg.message);
      else if (msg.type === 'result') {
        settled = true;
        resolve({ result: msg.result, log });
      }
    });
    worker.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    worker.on('exit', (code) => {
      if (!settled && code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

async function runSolve(overrides = {}) {
  const cur = loadConfig();
  const nextCfg = saveConfig({
    ...cur,
    constraints: overrides.constraints ? { ...cur.constraints, ...overrides.constraints } : cur.constraints,
    params: overrides.params ? { ...cur.params, ...overrides.params } : cur.params,
    document: overrides.document ? { ...cur.document, ...overrides.document } : cur.document,
  });
  const data = store.getData();

  // Check if requested seed matches a saved snapshot
  const snap = snapshots.getSnapshot(nextCfg.params.seed);
  if (snap && JSON.stringify(snap.constraints) === JSON.stringify(nextCfg.constraints)) {
    const validation = validate(snap.rows, data, nextCfg);
    const stats = {
      ...(snap.params ? { params: snap.params } : {}),
      seed: snap.seed,
      baseSeed: snap.baseSeed,
      isSnapshot: true,
      softCostBefore: snap.softCost,
      softCostAfter: snap.softCost,
      seconds: 0,
      constraints: { ...snap.constraints },
    };
    store.setTimetable(snap.rows, { stats, validationPassed: validation.passed, source: 'snapshot' });
    return { status: 'success', message: `คืนค่าตารางจาก Snapshot Seed ${snap.seed}`, rows: snap.rows, warnings: [], stats, validation, log: ['คืนค่าจาก Snapshot Seed'] };
  }

  const { result, log } = await runWorker(data, nextCfg, 'solve');
  if (result.status === 'success') {
    const validation = validate(result.rows, data, nextCfg);
    store.setTimetable(result.rows, { stats: result.stats, validationPassed: validation.passed, source: 'solver' });
    return { ...result, validation, log };
  }
  return { ...result, validation: null, log };
}

async function runBest(count = 20) {
  const clamped = Math.max(2, Math.min(60, Number(count) || 20));
  const cfg = loadConfig();
  const data = store.getData();
  const { result, log } = await runWorker(data, cfg, 'best', { count: clamped });
  if (result.best) {
    const nextCfg = saveConfig({ ...cfg, params: { ...cfg.params, seed: result.best.seed } });
    const validation = validate(result.best.rows, data, nextCfg);
    store.setTimetable(result.best.rows, {
      stats: { ...result.best.stats, bestOf: clamped },
      validationPassed: validation.passed,
      source: 'solver',
    });
    return {
      status: 'success',
      message: `seed ที่ดีที่สุดคือ ${result.best.seed}`,
      best: { seed: result.best.seed, softCost: result.best.softCost },
      results: result.results,
      seconds: result.seconds,
      validation,
      log,
    };
  }
  return { status: 'failed', message: 'ไม่พบ seed ที่จัดตารางได้สำเร็จ', results: result.results, seconds: result.seconds, log };
}

function addSavedSeed(body, username = 'admin') {
  const cfg = loadConfig();
  const tt = store.getTimetable();
  const seedNum = Number(body.seed ?? tt?.meta?.stats?.seed ?? cfg.params.seed);
  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(),
    name: String(body.name || `Seed ${seedNum}`).trim(),
    note: String(body.note || '').trim(),
    tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    pinned: Boolean(body.pinned),
    seed: seedNum,
    baseSeed: body.baseSeed ?? tt?.meta?.stats?.baseSeed ?? seedNum,
    source: tt?.meta?.source || 'solver',
    isSnapshot: Boolean(tt?.meta?.stats?.isSnapshot || snapshots.getSnapshot(seedNum)),
    constraints: { ...cfg.constraints },
    params: { ...cfg.params, seed: seedNum },
    softCost: tt?.meta?.stats?.softCostAfter ?? null,
    validationPassed: tt?.meta?.validationPassed ?? null,
    rowsCount: tt?.rows?.length ?? 0,
    savedBy: username,
    savedAt: now,
    updatedAt: now,
  };
  const next = saveConfig({ ...cfg, savedSeeds: [item, ...(cfg.savedSeeds || [])] });
  return { item, savedSeeds: next.savedSeeds };
}

function resolveBaseUrl(req, cfg) {
  const custom = String(cfg.document?.publicBaseUrl || '').trim().replace(/\/+$/, '');
  if (custom) return custom;
  return `${req.protocol}://${req.get('host')}`;
}

function requireTimetable() {
  const tt = store.getTimetable();
  if (!tt || !tt.rows || tt.rows.length === 0) {
    throw store.httpError(404, 'ยังไม่มีตารางเรียน กรุณากดจัดตารางก่อน');
  }
  return tt;
}

function requirePublicEnabled() {
  const cfg = loadConfig();
  if (!cfg.document?.publicEnabled) {
    throw store.httpError(403, 'ผู้ดูแลระบบปิดการเผยแพร่ตารางสาธารณะ');
  }
  return cfg;
}

function saveManualTimetable(nextRows, cfg, data, prevMeta = {}) {
  const validation = validate(nextRows, data, cfg);
  const snap = snapshots.saveSnapshot({
    rows: nextRows,
    data,
    config: cfg,
    baseSeed: prevMeta?.stats?.baseSeed ?? prevMeta?.stats?.seed ?? cfg.params.seed,
  });
  const saved = store.setTimetable(nextRows, {
    ...prevMeta,
    source: 'manual',
    validationPassed: validation.passed,
    stats: {
      ...(prevMeta?.stats || {}),
      seed: snap.seed,
      baseSeed: snap.baseSeed,
      isSnapshot: true,
      softCostAfter: snap.softCost,
    },
  });
  return { ...saved, validation };
}

// --- Auth ---
router.get('/auth/me', (req, res) => {
  const defActive = auth.isDefaultAdminActive();
  res.json({
    user: auth.publicUser(req.user),
    defaultPassword: defActive,
    defaultAdmin: defActive ? auth.DEFAULT_ADMIN : null,
  });
});

router.post('/auth/login', wrap((req, res) => {
  const { username, password } = req.body || {};
  const user = auth.login(username, password, res);
  res.json({ user });
}));

router.post('/auth/logout', (req, res) => {
  auth.logout(req, res);
  res.json({ ok: true });
});

router.get('/auth/register-options', (_req, res) => {
  const data = store.getData();
  res.json({ teachers: data.teacher || [] });
});

router.post('/auth/register', wrap((req, res) => {
  const user = auth.registerTeacher(req.body || {});
  res.status(201).json({ user });
}));

router.post('/auth/password', wrap((req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = auth.changeOwnPassword(req.user.username, currentPassword, newPassword);
  res.json({ user });
}));

router.put('/auth/profile', wrap((req, res) => {
  const user = auth.updateProfile(req.user.username, req.body || {});
  res.json({ user });
}));

// --- Users (Admin only) ---
router.get('/users', auth.requireAdmin, (_req, res) => {
  res.json({ users: auth.listUsers() });
});

router.post('/users', auth.requireAdmin, wrap((req, res) => {
  const user = auth.createUser(req.body || {});
  res.status(201).json({ user });
}));

router.put('/users/:username', auth.requireAdmin, wrap((req, res) => {
  const user = auth.updateUser(req.params.username, req.body || {}, req.user.username);
  res.json({ user });
}));

router.delete('/users/:username', auth.requireAdmin, wrap((req, res) => {
  res.json(auth.deleteUser(req.params.username, req.user.username));
}));

router.post('/users/:username/approve', auth.requireAdmin, wrap((req, res) => {
  const user = auth.approveUser(req.params.username, req.body?.teacher_id);
  res.json({ user });
}));

router.post('/users/:username/reject', auth.requireAdmin, wrap((req, res) => {
  const user = auth.rejectUser(req.params.username);
  res.json({ user });
}));

router.get('/admin/badges', auth.requireAdmin, (_req, res) => {
  const pendingUsers = auth.listUsers().filter((u) => u.status === 'pending').length;
  res.json({ pendingUsers, ...hub.pendingCounts() });
});

// --- Data ---
router.get('/data', (_req, res) => {
  const data = store.getData();
  const ctx = context();
  const totalPeriods = ctx.registrations.reduce((s, r) => s + ctx.hours(r.subject_id), 0);
  res.json({
    data,
    schema: ENTITIES,
    warnings: ctx.warnings,
    summary: {
      teachers: data.teacher.length,
      leaders: data.teacher.filter((t) => t.role === 'Leader').length,
      rooms: ctx.rooms.size,
      groups: data.student_group.length,
      activeGroups: ctx.activeGroups.length,
      subjects: data.subject.length,
      registrations: data.register.length,
      timeslots: data.timeslot.length,
      totalPeriods,
    },
  });
});

router.get('/data/:entity', wrap((req, res) => {
  res.json({ rows: store.getEntity(req.params.entity) });
}));

router.post('/data/reset', wrap((_req, res) => {
  store.resetData();
  res.json({ ok: true, warnings: context().warnings });
}));

router.post('/data/auto-advisors', wrap((_req, res) => {
  const data = store.getData();
  const cfg = loadConfig();
  const ctx = buildContext(data, cfg);

  // Compute each teacher's weekly teaching load from registrations
  const loadMap = new Map();
  for (const t of data.teacher) loadMap.set(t.teacher_id, 0);
  const seenCombined = new Set();
  for (const reg of ctx.registrations) {
    const sub = ctx.subjects.get(reg.subject_id);
    if (!sub || sub.special_mode === 'practicum_y4') continue;
    if (sub.special_mode === 'combined_year') {
      if (seenCombined.has(sub.subject_id)) continue;
      seenCombined.add(sub.subject_id);
    }
    const h = ctx.hours(sub.subject_id);
    for (const tid of ctx.teachersBySubject.get(sub.subject_id) || []) {
      loadMap.set(tid, (loadMap.get(tid) || 0) + h);
    }
  }

  // Find teachers who teach each year (normal + combined + electives of that year)
  const teachersByYear = new Map();
  for (const reg of ctx.registrations) {
    const sub = ctx.subjects.get(reg.subject_id);
    if (!sub) continue;
    const yr = sub.year;
    if (!teachersByYear.has(yr)) teachersByYear.set(yr, new Set());
    for (const tid of ctx.teachersBySubject.get(sub.subject_id) || []) {
      teachersByYear.get(yr).add(tid);
    }
  }

  const usedTeachers = new Set();
  const assigned = [];
  const updatedGroups = data.student_group.map((g) => ({ ...g }));

  const sortByLoad = (ids) =>
    [...ids].sort((a, b) => {
      const la = loadMap.get(a) ?? 0;
      const lb = loadMap.get(b) ?? 0;
      if (la !== lb) return la - lb;
      const ra = ctx.teachers.get(a)?.role === 'Leader' ? 1 : 0;
      const rb = ctx.teachers.get(b)?.role === 'Leader' ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b, undefined, { numeric: true });
    });

  for (const g of updatedGroups) {
    if (g.year === 4) {
      g.advisor = '';
      continue;
    }
    const yearPool = [...(teachersByYear.get(g.year) || [])].filter((tid) => !usedTeachers.has(tid));
    const fallbackPool = data.teacher.map((t) => t.teacher_id).filter((tid) => !usedTeachers.has(tid));
    const pool = yearPool.length > 0 ? yearPool : fallbackPool;
    const pickedId = sortByLoad(pool)[0];
    if (pickedId) {
      usedTeachers.add(pickedId);
      const t = ctx.teachers.get(pickedId);
      g.advisor = t ? t.teacher_name : pickedId;
      assigned.push({
        group_id: g.group_id,
        group_name: g.group_name,
        teacher_id: pickedId,
        teacher_name: g.advisor,
        teachingLoad: loadMap.get(pickedId) ?? 0,
      });
    }
  }

  store.replaceEntity('student_group', updatedGroups);

  // Sync ADVISOR and ACTIVITY rows in existing timetable if one is present
  const tt = store.getTimetable();
  if (tt && tt.rows && tt.rows.length > 0) {
    const advisorIdByGroup = new Map(assigned.map((a) => [a.group_id, a.teacher_id]));
    const nextRows = tt.rows.map((r) =>
      (r.subject_id === 'ADVISOR' || r.subject_id === 'ACTIVITY') && advisorIdByGroup.has(r.group_id)
        ? { ...r, teacher_id: advisorIdByGroup.get(r.group_id) }
        : r
    );
    const nextData = store.getData();
    const validation = validate(nextRows, nextData, cfg);
    store.setTimetable(nextRows, { ...tt.meta, validationPassed: validation.passed });
  }

  res.json({ ok: true, assigned, groups: updatedGroups });
}));

const EXPORT_FOLDERS = [
  ['teacher', '01_teacher'],
  ['room', '02_room'],
  ['student_group', '03_student_group'],
  ['subject', '04_subject'],
  ['teach', '05_teach'],
  ['timeslot', '06_timeslot'],
  ['register', '07_register'],
];

router.get('/data/export-all', (_req, res) => {
  const data = store.getData();
  const entries = EXPORT_FOLDERS.map(([entity, folder]) => {
    const def = ENTITIES[entity];
    const csvText = '\uFEFF' + toCsv(data[entity] || [], def.fields);
    return {
      name: `timetable-data/${folder}/${def.file}`,
      data: Buffer.from(csvText, 'utf8'),
    };
  });
  const zipBuf = buildZip(entries);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="timetable-data.zip"');
  res.send(zipBuf);
});

router.post('/data/clear-all', auth.requireAdmin, wrap((_req, res) => {
  store.clearAllData();
  res.json({ ok: true });
}));

router.get('/data/:entity/export', wrap((req, res) => {
  const entity = req.params.entity;
  const def = ENTITIES[entity];
  if (!def) throw store.httpError(404, `ไม่พบตาราง ${entity}`);
  const rows = store.getEntity(entity);
  const csvText = '\uFEFF' + toCsv(rows, def.fields);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${def.file}"`);
  res.send(csvText);
}));

router.delete('/data/:entity', auth.requireAdmin, wrap((req, res) => {
  res.json(store.clearEntity(req.params.entity));
}));

router.post('/data/:entity', wrap((req, res) => {
  const row = store.addRow(req.params.entity, req.body || {});
  res.status(201).json({ row });
}));

router.put('/data/:entity/:key', wrap((req, res) => {
  const row = store.updateRow(req.params.entity, decodeURIComponent(req.params.key), req.body || {});
  res.json({ row });
}));

router.delete('/data/:entity/:key', wrap((req, res) => {
  res.json(store.deleteRow(req.params.entity, decodeURIComponent(req.params.key)));
}));

router.post('/import', upload.array('files', 20), wrap(async (req, res) => {
  const files = req.files || [];
  const imported = [];
  const skipped = [];
  const yearUploads = [];

  for (const f of files) {
    const fname = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const lower = fname.toLowerCase();

    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const sheets = await parseXlsx(f.buffer);
      const sheetNames = Object.keys(sheets);
      const yearSheets = sheetNames
        .map((sn) => ({ sn, m: sn.match(/ชั้นปี(?:ที่)?\s*(\d)/) }))
        .filter((x) => x.m);
      if (yearSheets.length > 0) {
        for (const ys of yearSheets) {
          yearUploads.push({ year: Number(ys.m[1]), rows: sheets[ys.sn] });
        }
        continue;
      }
      for (const sn of sheetNames) {
        const entity = entityFromFilename(sn) || (sheetNames.length === 1 ? entityFromFilename(fname) : null);
        if (!entity) {
          skipped.push(`${fname} (${sn})`);
          continue;
        }
        const rows = store.replaceEntity(entity, sheets[sn]);
        imported.push({ file: `${fname}:${sn}`, entity, rows: rows.length });
      }
    } else if (lower.endsWith('.csv')) {
      const ym = fname.match(/ชั้นปี(?:ที่)?\s*(\d)/);
      if (ym) {
        yearUploads.push({ year: Number(ym[1]), rows: parseCsv(f.buffer.toString('utf8')) });
        continue;
      }
      const entity = entityFromFilename(fname);
      if (!entity) {
        skipped.push(fname);
        continue;
      }
      const parsed = parseCsv(f.buffer.toString('utf8'));
      const keyFields = ENTITIES[entity].key;
      if (parsed.length > 0 && keyFields.some((k) => !(k in parsed[0]))) {
        throw store.httpError(400, `ไฟล์ ${fname} ไม่มีคอลัมน์หลัก ${keyFields.join(', ')}`);
      }
      const rows = store.replaceEntity(entity, parsed);
      imported.push({ file: fname, entity, rows: rows.length });
    } else {
      skipped.push(fname);
    }
  }

  if (yearUploads.length > 0) {
    const tables = convertYearRowsToTables(yearUploads);
    for (const [entity, tRows] of Object.entries(tables)) {
      const rows = store.replaceEntity(entity, tRows);
      imported.push({ file: 'ชั้นปีที่ 1–4', entity, rows: rows.length });
    }
  }

  res.json({ imported, skipped, warnings: context().warnings });
}));

// --- Config, Profiles, Seeds, Appearance ---
router.get('/config', (_req, res) => {
  res.json({ config: loadConfig(), defaults: DEFAULT_CONFIG });
});

router.put('/config', wrap((req, res) => {
  const cur = loadConfig();
  const body = req.body || {};
  const saved = saveConfig({
    ...cur,
    constraints: body.constraints ? { ...cur.constraints, ...body.constraints } : cur.constraints,
    params: body.params ? { ...cur.params, ...body.params } : cur.params,
    document: body.document ? { ...cur.document, ...body.document } : cur.document,
    savedSeeds: cur.savedSeeds,
    savedProfiles: cur.savedProfiles,
    appearance: cur.appearance,
  });
  res.json({ config: saved });
}));

router.post('/config/reset', wrap((_req, res) => {
  const cur = loadConfig();
  const saved = saveConfig({ ...DEFAULT_CONFIG, savedSeeds: cur.savedSeeds, appearance: cur.appearance });
  res.json({ config: saved });
}));

router.get('/config/profiles', (_req, res) => {
  res.json({ profiles: loadConfig().savedProfiles || [] });
});

router.post('/config/profiles', wrap((req, res) => {
  const cfg = loadConfig();
  const p = {
    id: crypto.randomUUID(),
    name: String(req.body?.name || 'โปรไฟล์ใหม่').trim(),
    note: String(req.body?.note || '').trim(),
    constraints: { ...cfg.constraints },
    params: { ...cfg.params },
    document: { ...cfg.document },
    savedAt: new Date().toISOString(),
  };
  const next = saveConfig({ ...cfg, savedProfiles: [p, ...(cfg.savedProfiles || [])] });
  res.status(201).json({ profile: p, profiles: next.savedProfiles });
}));

router.post('/config/profiles/:id/load', wrap((req, res) => {
  const cfg = loadConfig();
  const p = (cfg.savedProfiles || []).find((x) => x.id === req.params.id);
  if (!p) throw store.httpError(404, 'ไม่พบโปรไฟล์');
  const saved = saveConfig({ ...cfg, constraints: p.constraints, params: p.params, document: p.document });
  res.json({ config: saved });
}));

router.delete('/config/profiles/:id', wrap((req, res) => {
  const cfg = loadConfig();
  const next = saveConfig({ ...cfg, savedProfiles: (cfg.savedProfiles || []).filter((x) => x.id !== req.params.id) });
  res.json({ profiles: next.savedProfiles });
}));

router.get('/config/export', (_req, res) => {
  res.json({
    config: loadConfig(),
    snapshots: snapshots.listSnapshots(),
    exportedAt: new Date().toISOString(),
  });
});

router.post('/config/import', wrap((req, res) => {
  const body = req.body || {};
  if (Array.isArray(body.snapshots)) snapshots.importSnapshots(body.snapshots);
  const saved = saveConfig(body.config || body);
  res.json({ config: saved });
}));

router.get('/seeds', (_req, res) => {
  const list = [...(loadConfig().savedSeeds || [])].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  res.json({ seeds: list });
});

router.post('/seeds', wrap((req, res) => {
  const { item, savedSeeds } = addSavedSeed(req.body || {}, req.user?.username);
  res.status(201).json({ seed: item, seeds: savedSeeds });
}));

router.put('/seeds/:id', wrap((req, res) => {
  const cfg = loadConfig();
  const list = (cfg.savedSeeds || []).map((s) =>
    s.id === req.params.id
      ? {
          ...s,
          name: req.body?.name !== undefined ? String(req.body.name).trim() : s.name,
          note: req.body?.note !== undefined ? String(req.body.note).trim() : s.note,
          tags: Array.isArray(req.body?.tags) ? req.body.tags : s.tags,
          pinned: req.body?.pinned !== undefined ? Boolean(req.body.pinned) : s.pinned,
          updatedAt: new Date().toISOString(),
        }
      : s
  );
  const next = saveConfig({ ...cfg, savedSeeds: list });
  res.json({ seeds: next.savedSeeds });
}));

router.delete('/seeds/:id', wrap((req, res) => {
  const cfg = loadConfig();
  const next = saveConfig({ ...cfg, savedSeeds: (cfg.savedSeeds || []).filter((s) => s.id !== req.params.id) });
  res.json({ seeds: next.savedSeeds });
}));

router.post('/seeds/:id/apply', wrap(async (req, res) => {
  const cfg = loadConfig();
  const item = (cfg.savedSeeds || []).find((s) => s.id === req.params.id);
  if (!item) throw store.httpError(404, 'ไม่พบ Seed ที่บันทึกไว้');
  const result = await runSolve({ constraints: item.constraints, params: { ...item.params, seed: item.seed } });
  res.json(result);
}));

router.get('/seeds/:id/export', wrap((req, res) => {
  const cfg = loadConfig();
  const item = (cfg.savedSeeds || []).find((s) => s.id === req.params.id);
  if (!item) throw store.httpError(404, 'ไม่พบ Seed');
  const snap = snapshots.getSnapshot(item.seed);
  res.json({ seed: item, snapshot: snap || null });
}));

router.post('/seeds/import', wrap((req, res) => {
  const body = req.body || {};
  if (body.snapshot) snapshots.importSnapshots([body.snapshot]);
  const s = body.seed || body;
  const { item, savedSeeds } = addSavedSeed(s, req.user?.username);
  res.status(201).json({ seed: item, seeds: savedSeeds });
}));

router.get('/document', (_req, res) => {
  res.json(loadConfig().document);
});

router.get('/public/appearance', (_req, res) => {
  res.json({ appearance: loadConfig().appearance, defaults: DEFAULT_CONFIG.appearance });
});

router.put('/appearance', wrap((req, res) => {
  const cur = loadConfig();
  const body = req.body || {};
  const ap = body.appearance || body;
  const DATA_URL_RE = /^data:image\/(png|jpeg|webp|svg\+xml|gif);base64,[A-Za-z0-9+/=]+$/;
  const checkImg = (val, maxBytes, label) => {
    if (!val) return;
    if (!DATA_URL_RE.test(val)) throw store.httpError(400, `${label}: รูปแบบภาพไม่ถูกต้อง`);
    const b64 = val.split(',')[1] || '';
    if (Math.ceil((b64.length * 3) / 4) > maxBytes) {
      throw store.httpError(400, `${label}: ขนาดไฟล์เกินกำหนด`);
    }
  };
  checkImg(ap.logoDataUrl, 600 * 1024, 'โลโก้เว็บ');
  checkImg(ap.pdf?.logoDataUrl, 600 * 1024, 'โลโก้ PDF');
  checkImg(ap.loginBgDataUrl, 1500 * 1024, 'ภาพพื้นหลัง Login');
  checkImg(ap.public?.heroBgDataUrl, 1500 * 1024, 'ภาพพื้นหลังหน้าสาธารณะ');
  if (Array.isArray(ap.public?.carouselSlides)) {
    if (ap.public.carouselSlides.length > 8) throw store.httpError(400, 'Carousel รองรับสูงสุด 8 รูป');
    for (const sl of ap.public.carouselSlides) {
      checkImg(sl?.imageDataUrl, 1500 * 1024, 'รูปสไลด์ Carousel');
    }
  }
  if (ap.customCss && String(ap.customCss).length > 20000) {
    throw store.httpError(400, 'Custom CSS ต้องไม่เกิน 20,000 ตัวอักษร');
  }

  const nextAppearance = {
    ...cur.appearance,
    ...ap,
    pdf: { ...cur.appearance.pdf, ...(ap.pdf || {}) },
    public: { ...cur.appearance.public, ...(ap.public || {}) },
  };
  const nextDoc = body.syncCollege && nextAppearance.siteName
    ? { ...cur.document, college: String(nextAppearance.siteName).trim() }
    : cur.document;
  const saved = saveConfig({ ...cur, appearance: nextAppearance, document: nextDoc });
  res.json({ appearance: saved.appearance, document: saved.document });
}));

router.post('/appearance/reset', wrap((_req, res) => {
  const cur = loadConfig();
  const saved = saveConfig({ ...cur, appearance: DEFAULT_CONFIG.appearance });
  res.json({ appearance: saved.appearance });
}));

// --- Solve, Diagnose, Best Seed, Stats ---
router.post('/solve', wrap(async (req, res) => {
  res.json(await runSolve(req.body || {}));
}));

router.post('/diagnose', wrap(async (_req, res) => {
  const { result, log } = await runWorker(store.getData(), loadConfig(), 'diagnose', { probeSeconds: 4 });
  res.json({ ...result, log });
}));

router.post('/solve/best', wrap(async (req, res) => {
  res.json(await runBest(req.body?.count));
}));

router.get('/stats', (_req, res) => {
  const tt = store.getTimetable();
  res.json(timetableStats(tt?.rows || [], context()));
});

// --- Timetable & Editing ---
router.get('/timetable', (_req, res) => {
  const tt = store.getTimetable();
  if (!tt) return res.json({ rows: [], meta: null, validation: null });
  const validation = validate(tt.rows, store.getData(), loadConfig());
  res.json({ rows: tt.rows, meta: tt.meta, validation });
});

router.put('/timetable', wrap((req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const cfg = loadConfig();
  const tt = store.getTimetable();
  const saved = saveManualTimetable(rows, cfg, store.getData(), tt?.meta || {});
  res.json(saved);
}));

router.post('/timetable/validate', wrap((req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : (store.getTimetable()?.rows || []);
  res.json(validate(rows, store.getData(), loadConfig()));
}));

router.post('/timetable/move-options', wrap((req, res) => {
  const tt = requireTimetable();
  const cfg = loadConfig();
  const ctx = buildContext(store.getData(), cfg);
  const targets = validMoveTargets(tt.rows, store.getData(), cfg, ctx, req.body || {});
  res.json({ targets });
}));

router.post('/timetable/move', wrap((req, res) => {
  const tt = requireTimetable();
  const cfg = loadConfig();
  const data = store.getData();
  const ctx = buildContext(data, cfg);
  const nextRows = moveSpan(tt.rows, ctx, req.body || {});
  res.json(saveManualTimetable(nextRows, cfg, data, tt.meta));
}));

router.post('/timetable/edit', wrap((req, res) => {
  const tt = requireTimetable();
  const cfg = loadConfig();
  const data = store.getData();
  const ctx = buildContext(data, cfg);
  const nextRows = editSpan(tt.rows, ctx, req.body || {});
  res.json(saveManualTimetable(nextRows, cfg, data, tt.meta));
}));

router.get('/timetable/entities', (_req, res) => {
  const ctx = context();
  res.json({
    group: entitiesFor('group', ctx),
    teacher: entitiesFor('teacher', ctx),
    room: entitiesFor('room', ctx),
  });
});

router.get('/timetable/grid', (req, res) => {
  const view = String(req.query.view || 'group');
  const ctx = context();
  const list = entitiesFor(view, ctx);
  const entity = list.find((e) => e.id === req.query.id) || list[0] || null;
  const rows = store.getTimetable()?.rows || [];
  if (!entity) return res.json({ entity: null, days: [], periods: [], cells: [], total: 0, subjects: { list: [], total: { n: 0, t: 0, p: 0, s: 0, h: 0 } } });
  res.json({ entity, ...buildGrid(view, entity.id, rows, ctx), subjects: subjectSummary(view, entity.id, rows, ctx) });
});

router.get('/timetable/grids', (req, res) => {
  const view = String(req.query.view || 'group');
  const ctx = context();
  const rows = store.getTimetable()?.rows || [];
  const grids = entitiesFor(view, ctx).map((entity) => ({
    entity,
    ...buildGrid(view, entity.id, rows, ctx),
  }));
  res.json({ grids });
});

function resolveRowsForSeed(seedParam) {
  if (!seedParam || seedParam === 'current') {
    const tt = store.getTimetable();
    return { rows: tt?.rows || [], softCost: tt?.meta?.stats?.softCostAfter ?? null, seed: tt?.meta?.stats?.seed ?? null };
  }
  const sNum = Number(String(seedParam).replace(/^seed:/, ''));
  const snap = snapshots.getSnapshot(sNum);
  if (snap) return { rows: snap.rows, softCost: snap.softCost, seed: snap.seed };

  const cfg = loadConfig();
  const cacheKey = `${sNum}|${JSON.stringify(cfg.constraints)}`;
  if (seedGridCache.has(cacheKey)) return seedGridCache.get(cacheKey);
  const res = solve(store.getData(), mergeConfig({ ...cfg, params: { ...cfg.params, seed: sNum } }));
  const entry = { rows: res.rows || [], softCost: res.stats?.softCostAfter ?? null, seed: sNum };
  if (seedGridCache.size > 20) seedGridCache.delete(seedGridCache.keys().next().value);
  seedGridCache.set(cacheKey, entry);
  return entry;
}

router.get('/timetable/seed-grid', (req, res) => {
  const view = String(req.query.view || 'group');
  const ctx = context();
  const { rows, softCost, seed } = resolveRowsForSeed(req.query.seed);
  const list = entitiesFor(view, ctx);
  const entity = list.find((e) => e.id === req.query.id) || list[0] || null;
  if (!entity) return res.json({ entity: null, seed, softCost, days: [], periods: [], cells: [], total: 0 });
  res.json({ entity, seed, softCost, ...buildGrid(view, entity.id, rows, ctx) });
});

router.get('/timetable/compare', (req, res) => {
  const view = String(req.query.view || 'group');
  const id = String(req.query.id || '');
  const ctx = context();
  const a = resolveRowsForSeed(req.query.seedA || 'current');
  const b = resolveRowsForSeed(req.query.seedB || '42');
  const entities = id && id !== '__all__'
    ? entitiesFor(view, ctx).filter((e) => e.id === id)
    : entitiesFor(view, ctx);
  const items = entities.map((entity) => ({
    entity,
    gridA: buildGrid(view, entity.id, a.rows, ctx),
    gridB: buildGrid(view, entity.id, b.rows, ctx),
  }));
  res.json({ seedA: a.seed, softCostA: a.softCost, seedB: b.seed, softCostB: b.softCost, items });
});

// --- Teacher Hub ---
router.get('/teacher/my-groups', (req, res) => {
  const ctx = context();
  const tid = req.user.teacher_id || '';
  const teacher = ctx.teachers.get(tid) || null;
  const rows = store.getTimetable()?.rows || [];
  const myRows = tid ? rows.filter((r) => splitIds(r.teacher_id).includes(tid)) : [];
  const groupMap = new Map();
  for (const r of myRows) {
    const gids = ctx.electiveSets.has(r.group_id) ? ctx.electiveSets.get(r.group_id).groups : [r.group_id];
    for (const gid of gids) {
      if (!groupMap.has(gid)) groupMap.set(gid, { group: ctx.groups.get(gid), periods: new Set(), subjects: new Set() });
      groupMap.get(gid).periods.add(r.timeslot_id);
      groupMap.get(gid).subjects.add(r.subject_id);
    }
  }
  const responsibleGroups = [...groupMap.values()]
    .filter((x) => x.group)
    .map((x) => ({
      ...x.group,
      periods: x.periods.size,
      subjects: [...x.subjects].map((sid) => ({ subject_id: sid, subject_name: ctx.subjects.get(sid)?.subject_name || sid })),
    }));
  const totalSlots = new Set(myRows.map((r) => r.timeslot_id)).size;
  const subjectsTaught = [...new Set(myRows.map((r) => r.subject_id))];
  res.json({ teacher, totalPeriods: totalSlots, subjectsCount: subjectsTaught.length, responsibleGroups });
});

function evaluateTeacherRequest(item, tt, data, cfg, ctx) {
  if (!item || item.status !== 'pending') return null;
  if (!tt || !tt.rows || tt.rows.length === 0) {
    return { feasible: false, reasons: ['ยังไม่มีตารางเรียนในระบบ'] };
  }
  try {
    const nextRows = item.kind === 'edit'
      ? editSpan(tt.rows, ctx, { view: 'teacher', id: item.teacher_id, day: item.fromDay, period: item.fromPeriod, length: item.length, room_id: item.room_id })
      : moveSpan(tt.rows, ctx, { view: 'teacher', id: item.teacher_id, fromDay: item.fromDay, fromPeriod: item.fromPeriod, length: item.length, toDay: item.toDay, toPeriod: item.toPeriod });
    const val = validate(nextRows, data, cfg, ctx);
    if (val.passed) return { feasible: true, reasons: [] };
    const reasons = [];
    for (const ch of val.checks || []) {
      if (!ch.passed) {
        const sample = (ch.violations || [])[0]?.message;
        reasons.push(sample ? `${ch.name}: ${sample}` : ch.name);
        if (reasons.length >= 4) break;
      }
    }
    return { feasible: false, reasons: reasons.length ? reasons : ['ขัดต่อเงื่อนไขการจัดตาราง'] };
  } catch (err) {
    return { feasible: false, reasons: [err.message || 'ไม่สามารถย้ายไปยังช่วงเวลานี้ได้'] };
  }
}

router.get('/teacher/requests', (req, res) => {
  const list = hub.listRequests(req.user);
  const tt = store.getTimetable();
  const cfg = loadConfig();
  const data = store.getData();
  const ctx = buildContext(data, cfg);
  const enriched = list.map((item) => ({
    ...item,
    check: evaluateTeacherRequest(item, tt, data, cfg, ctx),
  }));
  res.json({ requests: enriched });
});
router.post('/teacher/requests', wrap((req, res) => res.status(201).json({ request: hub.createRequest(req.user, req.body || {}) })));
router.delete('/teacher/requests/:id', wrap((req, res) => res.json(hub.deleteRequest(req.user, req.params.id))));
router.post('/teacher/requests/check', wrap((req, res) => {
  const tt = requireTimetable();
  const cfg = loadConfig();
  const data = store.getData();
  const ctx = buildContext(data, cfg);
  const item = {
    ...req.body,
    teacher_id: req.body.teacher_id || req.user.teacher_id,
    status: 'pending',
  };
  const check = evaluateTeacherRequest(item, tt, data, cfg, ctx);
  res.json({ ok: Boolean(check?.feasible), feasible: Boolean(check?.feasible), reasons: check?.reasons || [], message: check?.reasons?.[0] || '' });
}));
router.post('/teacher/requests/:id/approve', auth.requireAdmin, wrap((req, res) => {
  const list = hub.listRequests(req.user);
  const item = list.find((r) => r.id === req.params.id);
  if (!item) throw store.httpError(404, 'ไม่พบคำขอ');
  const tt = requireTimetable();
  const cfg = loadConfig();
  const data = store.getData();
  const ctx = buildContext(data, cfg);
  const nextRows = item.kind === 'edit'
    ? editSpan(tt.rows, ctx, { view: 'teacher', id: item.teacher_id, day: item.fromDay, period: item.fromPeriod, length: item.length, room_id: item.room_id })
    : moveSpan(tt.rows, ctx, { view: 'teacher', id: item.teacher_id, fromDay: item.fromDay, fromPeriod: item.fromPeriod, length: item.length, toDay: item.toDay, toPeriod: item.toPeriod });
  const saved = saveManualTimetable(nextRows, cfg, data, tt.meta);
  const updated = hub.updateRequestStatus(item.id, 'approved', req.body?.adminNote);
  res.json({ request: updated, timetable: saved });
}));
router.post('/teacher/requests/:id/reject', auth.requireAdmin, wrap((req, res) => {
  res.json({ request: hub.updateRequestStatus(req.params.id, 'rejected', req.body?.adminNote) });
}));

router.get('/teacher/unavailability', (req, res) => res.json({ unavailability: hub.getUnavailability(req.user) }));
router.put('/teacher/unavailability', wrap((req, res) => res.json({ unavailability: hub.saveUnavailability(req.user, req.body || {}) })));
router.post('/teacher/unavailability/:teacherId/approve', auth.requireAdmin, wrap((req, res) => {
  res.json({ unavailability: hub.setUnavailabilityStatus(req.params.teacherId, 'approved', req.body?.adminNote) });
}));
router.post('/teacher/unavailability/:teacherId/reject', auth.requireAdmin, wrap((req, res) => {
  res.json({ unavailability: hub.setUnavailabilityStatus(req.params.teacherId, 'rejected', req.body?.adminNote) });
}));

router.get('/teacher/notes', (req, res) => res.json({ notes: hub.listNotes(req.user) }));
router.post('/teacher/notes', wrap((req, res) => res.status(201).json({ note: hub.createNote(req.user, req.body || {}) })));
router.put('/teacher/notes/:id', wrap((req, res) => res.json({ note: hub.updateNote(req.user, req.params.id, req.body || {}) })));
router.delete('/teacher/notes/:id', wrap((req, res) => res.json(hub.deleteNote(req.user, req.params.id))));

// --- Public & Share ---
router.get('/public/info', (_req, res) => {
  const cfg = loadConfig();
  const tt = store.getTimetable();
  res.json({
    enabled: Boolean(cfg.document?.publicEnabled),
    college: cfg.document?.college || '',
    semester: cfg.document?.semester || '2',
    year: cfg.document?.year || '2569',
    hasTimetable: Boolean(tt && tt.rows && tt.rows.length > 0),
    updatedAt: tt?.meta?.updatedAt || null,
  });
});

router.get('/public/entities', wrap((_req, res) => {
  requirePublicEnabled();
  const ctx = context();
  res.json({
    group: entitiesFor('group', ctx),
    teacher: entitiesFor('teacher', ctx),
    room: entitiesFor('room', ctx),
  });
}));

router.get('/public/grid', wrap((req, res) => {
  requirePublicEnabled();
  const view = String(req.query.view || 'group');
  const ctx = context();
  const list = entitiesFor(view, ctx);
  const entity = list.find((e) => e.id === req.query.id) || list[0] || null;
  const rows = store.getTimetable()?.rows || [];
  if (!entity) return res.json({ entity: null, days: [], periods: [], cells: [], total: 0, subjects: { list: [], total: { t: 0, p: 0, n: 0, h: 0 } } });
  res.json({
    entity,
    ...buildGrid(view, entity.id, rows, ctx),
    subjects: subjectSummary(view, entity.id, rows, ctx),
  });
}));

router.get('/public/qr', wrap(async (req, res) => {
  const cfg = requirePublicEnabled();
  const view = String(req.query.view || 'group');
  const id = String(req.query.id || '');
  const url = `${resolveBaseUrl(req, cfg)}/p/${encodeURIComponent(view)}/${encodeURIComponent(id)}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 220 });
  res.type('image/svg+xml').send(svg);
}));

router.get('/public/pdf', wrap(async (req, res) => {
  requirePublicEnabled();
  const tt = requireTimetable();
  const view = String(req.query.view || 'group');
  const id = req.query.id ? String(req.query.id) : null;
  const buf = await exportPdf(tt.rows, context(), { view, id });
  const disp = req.query.inline ? 'inline' : 'attachment';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disp}; filename="timetable-${view}${id ? '-' + id : ''}.pdf"`);
  res.send(buf);
}));

router.get('/public/ics', wrap((req, res) => {
  requirePublicEnabled();
  const tt = requireTimetable();
  const view = String(req.query.view || 'group');
  const id = String(req.query.id || '');
  const ctx = context();
  const grid = buildGrid(view, id, tt.rows, ctx);
  const dayBy = { Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU' };
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TimetableAI//TH', 'X-WR-TIMEZONE:Asia/Bangkok'];
  grid.days.forEach((d, di) => {
    for (const sp of grid.cells[di]) {
      const pStart = grid.periods.find((p) => p.period === sp.start);
      const pEnd = grid.periods.find((p) => p.period === sp.start + sp.span - 1);
      const st = (pStart?.start || '08:00').replace(':', '') + '00';
      const en = (pEnd?.end || '09:00').replace(':', '') + '00';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${view}-${id}-${d.key}-${sp.start}@timetable`,
        `SUMMARY:${sp.subject_id} ${sp.subject_name}`,
        `LOCATION:${sp.room_name || sp.room}`,
        `DESCRIPTION:${sp.teacher}`,
        `DTSTART;TZID=Asia/Bangkok:20261102T${st}`,
        `DTEND;TZID=Asia/Bangkok:20261102T${en}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${dayBy[d.key] || 'MO'}`,
        'END:VEVENT'
      );
    }
  });
  lines.push('END:VCALENDAR');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="timetable-${view}-${id}.ics"`);
  res.send(lines.join('\r\n'));
}));

router.get('/share', (req, res) => {
  const cfg = loadConfig();
  const base = resolveBaseUrl(req, cfg);
  const view = String(req.query.view || 'group');
  const id = String(req.query.id || '');
  res.json({
    url: `${base}/p/${encodeURIComponent(view)}/${encodeURIComponent(id)}`,
    base,
    enabled: Boolean(cfg.document?.publicEnabled),
  });
});

// --- Exports ---
router.get('/export/csv', wrap((_req, res) => {
  const tt = requireTimetable();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="output.csv"');
  res.send(exportCsv(tt.rows));
}));

router.get('/export/xlsx', wrap(async (req, res) => {
  const tt = requireTimetable();
  const view = String(req.query.view || 'all');
  const id = req.query.id ? String(req.query.id) : null;
  const buf = await exportXlsx(tt.rows, context(), { view, id });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="timetable-${view}${id ? '-' + id : ''}.xlsx"`);
  res.send(buf);
}));

router.get('/export/pdf', wrap(async (req, res) => {
  const tt = requireTimetable();
  const view = String(req.query.view || 'group');
  const id = req.query.id ? String(req.query.id) : null;
  const buf = await exportPdf(tt.rows, context(), { view, id });
  const disp = req.query.inline ? 'inline' : 'attachment';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disp}; filename="timetable-${view}${id ? '-' + id : ''}.pdf"`);
  res.send(buf);
}));

router.get('/export/qr-pdf', wrap(async (req, res) => {
  const view = String(req.query.view || 'group');
  const cfg = loadConfig();
  const base = resolveBaseUrl(req, cfg);
  const ctx = context();
  const items = entitiesFor(view, ctx).map((e) => ({
    title: e.title,
    url: `${base}/p/${encodeURIComponent(view)}/${encodeURIComponent(e.id)}`,
  }));
  const buf = await exportQrPdf(items, ctx);
  const disp = req.query.inline ? 'inline' : 'attachment';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disp}; filename="qr-${view}.pdf"`);
  res.send(buf);
}));

// --- Chatbot ---
router.post('/chat', wrap((req, res) => {
  const message = String(req.body?.message || '').slice(0, 500);
  const chatCtx = req.body?.context || {};
  const data = store.getData();
  const cfg = loadConfig();
  const ctx = buildContext(data, cfg);
  const tt = store.getTimetable();
  const rows = tt?.rows || [];
  const validation = rows.length ? validate(rows, data, cfg, ctx) : null;
  const out = chatReply(message, chatCtx, { data, config: cfg, ctx, rows, meta: tt?.meta || null, validation });
  res.json(out);
}));

router.post('/chat/action', wrap(async (req, res) => {
  const { kind, payload = {} } = req.body || {};
  if (kind === 'solve') {
    const r = await runSolve({
      constraints: payload.constraints,
      params: payload.seed != null ? { seed: payload.seed } : undefined,
    });
    return res.json({
      ok: r.status === 'success',
      text: r.status === 'success'
        ? `✅ จัดตารางสำเร็จ (${r.rows.length} แถว, Seed ${r.stats.seed}, Soft cost ${r.stats.softCostAfter})`
        : `❌ ${r.message}`,
      refresh: r.status === 'success',
    });
  }
  if (kind === 'diagnose') {
    const { result } = await runWorker(store.getData(), loadConfig(), 'diagnose', { probeSeconds: 4 });
    return res.json({
      ok: true,
      text: result.feasible
        ? '✅ เงื่อนไขปัจจุบันจัดตารางได้สำเร็จ'
        : `⚠️ พบเงื่อนไขที่อาจเป็นสาเหตุ: ${result.culprits.join(', ') || 'ตรวจสอบความจุข้อมูล'}`,
    });
  }
  if (kind === 'best_seed') {
    const r = await runBest(payload.count || 20);
    return res.json({ ok: r.status === 'success', text: r.message, refresh: r.status === 'success' });
  }
  if (kind === 'save_seed') {
    const { item } = addSavedSeed(payload, req.user?.username);
    return res.json({ ok: true, text: `✅ บันทึก Seed ${item.seed} (${item.name}) เรียบร้อยแล้ว` });
  }
  if (kind === 'move') {
    const tt = requireTimetable();
    const cfg = loadConfig();
    const data = store.getData();
    const ctx = buildContext(data, cfg);
    const nextRows = moveSpan(tt.rows, ctx, payload);
    const saved = saveManualTimetable(nextRows, cfg, data, tt.meta);
    return res.json({
      ok: true,
      text: saved.validation.passed ? '✅ ย้ายคาบเรียบร้อยและผ่านทุกเงื่อนไข' : '⚠️ ย้ายคาบแล้ว แต่มีเงื่อนไขบางข้อไม่ผ่าน',
      refresh: true,
    });
  }
  throw store.httpError(400, `ไม่รองรับคำสั่ง ${kind}`);
}));

export default router;
