import { buildContext } from './context.js';
import { solve, mulberry32 } from './solver.js';
import { mergeConfig } from './config.js';

const SPECIAL_LIST = [
  { key: 'c8_execMeeting', no: 8, label: 'ประชุมผู้บริหาร (อังคาร 1–4)' },
  { key: 'c9_wedFixed', no: 9, label: 'พบที่ปรึกษา/กิจกรรม (พุธ 8–9)' },
  { key: 'c10_roomCategory', no: 10, label: 'ประเภทห้องและห้องประจำ' },
  { key: 'c11_sportDualRoom', no: 11, label: 'วิชากีฬาใช้ 2 สถานที่พร้อมกัน' },
  { key: 'c12_electiveSync', no: 12, label: 'วิชาเลือกกีฬาจัดพร้อมกันทั้งชุด' },
  { key: 'c13_combinedYear', no: 13, label: 'วิชาปฏิบัติการเรียนรวมทั้งชั้นปี' },
];

function capacityChecks(ctx) {
  const findings = [];
  for (const w of ctx.warnings) {
    if (w.level === 'error') {
      findings.push({ level: 'error', area: 'ข้อมูล', message: w.message });
    }
  }

  const usablePerWeek = ctx.daySlots.reduce((sum, arr) => sum + arr.length, 0);
  for (const g of ctx.activeGroups) {
    let need = 0;
    for (const r of ctx.registrations) {
      if (r.group_id === g.group_id) need += ctx.hours(r.subject_id);
    }
    for (const es of ctx.electiveSets.values()) {
      if (es.groups.includes(g.group_id) && es.subjects.length > 0) {
        need += ctx.hours(es.subjects[0]);
      }
    }
    if (need > usablePerWeek) {
      findings.push({
        level: 'error',
        area: 'กลุ่ม',
        message: `กลุ่ม ${g.group_id} (${g.group_name}) ต้องเรียน ${need} คาบ แต่มีคาบว่างเพียง ${usablePerWeek} คาบ/สัปดาห์`,
      });
    }
  }

  // Check teacher weekly load
  const teacherLoad = new Map();
  const seenCombined = new Set();
  for (const r of ctx.registrations) {
    const sub = ctx.subjects.get(r.subject_id);
    if (!sub || sub.special_mode === 'practicum_y4') continue;
    if (sub.special_mode === 'combined_year' && ctx.constraints.c13_combinedYear) {
      if (seenCombined.has(sub.subject_id)) continue;
      seenCombined.add(sub.subject_id);
    }
    const h = ctx.hours(sub.subject_id);
    for (const tid of ctx.teachersBySubject.get(sub.subject_id) || []) {
      teacherLoad.set(tid, (teacherLoad.get(tid) || 0) + h);
    }
  }
  for (const [tid, load] of teacherLoad.entries()) {
    const t = ctx.teachers.get(tid);
    const maxSlots = ctx.isExecTeacher(tid) && ctx.constraints.c8_execMeeting ? usablePerWeek - 4 : usablePerWeek;
    if (load > maxSlots) {
      findings.push({
        level: 'error',
        area: 'ครูผู้สอน',
        message: `${t?.teacher_name || tid} มีภาระสอน ${load} คาบ เกินคาบที่สอนได้ ${maxSlots} คาบ/สัปดาห์`,
      });
    }
  }

  // Check elective theory room capacity
  if (ctx.constraints.c12_electiveSync) {
    for (const es of ctx.electiveSets.values()) {
      const pool = ctx.theoryRoomsForElective(es.year);
      if (pool.length < es.subjects.length) {
        findings.push({
          level: 'error',
          area: 'ห้องเรียน',
          message: `ชุดวิชาเลือก ${es.name} มี ${es.subjects.length} วิชา แต่มีห้องทฤษฎีเพียง ${pool.length} ห้อง`,
        });
      }
    }
  }

  if (findings.length === 0) {
    findings.push({
      level: 'ok',
      area: 'ความจุ',
      message: `ข้อมูลความจุกลุ่มเรียน (${ctx.activeGroups.length} กลุ่ม), อาจารย์ (${ctx.teachers.size} คน) และห้อง/สนาม (${ctx.rooms.size} แห่ง) เพียงพอสำหรับการจัดตาราง`,
    });
  }
  return findings;
}

export function diagnose(data, config, { probeSeconds = 4, onProgress } = {}) {
  const ctx = buildContext(data, config);
  const findings = capacityChecks(ctx);
  const probes = [];
  const culprits = [];
  const suggestions = [];

  const runProbe = (label, cfg) => {
    onProgress?.(`ทดสอบ: ${label}`);
    const probeCfg = mergeConfig({ ...cfg, params: { ...cfg.params, timeLimitSec: probeSeconds } });
    const res = solve(data, probeCfg);
    probes.push({ label, ok: res.status === 'success', seconds: res.stats?.seconds || 0 });
    return res;
  };

  const baseRes = runProbe('เงื่อนไขปัจจุบัน', config);
  if (baseRes.status === 'success') {
    suggestions.push('เงื่อนไขปัจจุบันสามารถจัดตารางได้สำเร็จแล้ว');
    return { feasible: true, culprits, probes, findings, suggestions };
  }

  for (const e of (baseRes.errors || []).slice(0, 5)) {
    findings.push({ level: 'warn', area: 'การค้นหา', message: e });
  }

  const hasBlocking = findings.some((f) => f.level === 'error' && (f.area === 'ข้อมูล' || f.area === 'กลุ่ม'));
  if (!hasBlocking) {
    const enabledSpecials = SPECIAL_LIST.filter((s) => config.constraints[s.key]);
    for (const sp of enabledSpecials) {
      const nextCfg = mergeConfig({
        ...config,
        constraints: { ...config.constraints, [sp.key]: false },
      });
      const r = runProbe(`ปิดข้อ ${sp.no}`, nextCfg);
      if (r.status === 'success') culprits.push(sp.no);
    }

    if (culprits.length === 0 && enabledSpecials.length > 1) {
      const allOff = {};
      for (const sp of SPECIAL_LIST) allOff[sp.key] = false;
      runProbe('ปิดเงื่อนไขพิเศษทั้งหมด', mergeConfig({ ...config, constraints: allOff }));
    }
  }

  if (culprits.length > 0) {
    suggestions.push(`ลองปิดเงื่อนไขข้อ ${culprits.join(', ')} หรือเพิ่มเวลาสูงสุดในการค้นหา (timeLimitSec)`);
  } else if (hasBlocking) {
    suggestions.push('แก้ไขข้อผิดพลาดในข้อมูลตั้งต้นก่อนเริ่มจัดตารางใหม่');
  } else {
    suggestions.push('ลองเพิ่มเวลาสูงสุดในการค้นหา หรือลองเปลี่ยน Seed ใหม่');
  }

  return { feasible: false, culprits, probes, findings, suggestions };
}

export function bestSeed(data, config, { count = 20, seeds, onProgress } = {}) {
  const startMs = Date.now();
  const baseSeed = Number(config.params?.seed) || 42;
  const targetCount = Math.max(2, Math.min(60, Number(count) || 20));
  const seedList = [];
  const seen = new Set();

  if (Array.isArray(seeds) && seeds.length > 0) {
    for (const s of seeds) {
      const n = Number(s);
      if (Number.isFinite(n) && !seen.has(n)) {
        seen.add(n);
        seedList.push(n);
      }
    }
  } else {
    seen.add(baseSeed);
    seedList.push(baseSeed);
    const rng = mulberry32(baseSeed ^ 0x9e3779b9);
    while (seedList.length < targetCount) {
      const cand = 1 + Math.floor(rng() * 99999);
      if (!seen.has(cand)) {
        seen.add(cand);
        seedList.push(cand);
      }
    }
  }

  const limit = Math.min(Number(config.params?.timeLimitSec) || 20, 10);
  const results = [];
  let best = null;

  for (let i = 0; i < seedList.length; i++) {
    const s = seedList[i];
    onProgress?.(`ทดสอบ Seed ${s} (${i + 1}/${seedList.length})`);
    const cfg = mergeConfig({ ...config, params: { ...config.params, seed: s, timeLimitSec: limit } });
    const res = solve(data, cfg);
    const ok = res.status === 'success';
    const softCost = ok ? res.stats.softCostAfter : null;
    results.push({ seed: s, ok, softCost, seconds: res.stats?.seconds || 0 });
    if (ok && (!best || softCost < best.softCost)) {
      best = { seed: s, softCost, rows: res.rows, stats: res.stats, warnings: res.warnings };
    }
  }

  results.sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    if (!a.ok) return 0;
    return a.softCost - b.softCost;
  });

  return {
    best,
    results,
    seconds: Number(((Date.now() - startMs) / 1000).toFixed(2)),
  };
}
