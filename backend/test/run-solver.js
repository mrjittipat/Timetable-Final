import crypto from 'node:crypto';
import * as store from '../src/services/store.js';
import { loadConfig, mergeConfig } from '../src/services/config.js';
import { solve } from '../src/services/solver.js';
import { validate } from '../src/services/validator.js';

store.init();
const data = store.getData();
const base = loadConfig();

const runAll = process.argv.includes('--all');
const allOn = {
  c8_execMeeting: true,
  c9_wedFixed: true,
  c10_roomCategory: true,
  c11_sportDualRoom: true,
  c12_electiveSync: true,
  c13_combinedYear: true,
};
const allOff = {
  c8_execMeeting: false,
  c9_wedFixed: false,
  c10_roomCategory: false,
  c11_sportDualRoom: false,
  c12_electiveSync: false,
  c13_combinedYear: false,
};

const combos = runAll
  ? [
      { name: 'all-specials-on', constraints: allOn },
      { name: 'basic-only', constraints: allOff },
      { name: 'no-exec-meeting', constraints: { ...allOn, c8_execMeeting: false } },
      { name: 'no-wed-fixed', constraints: { ...allOn, c9_wedFixed: false } },
      { name: 'no-room-category', constraints: { ...allOn, c10_roomCategory: false } },
      { name: 'no-sport-dual-room', constraints: { ...allOn, c11_sportDualRoom: false } },
      { name: 'no-elective-sync', constraints: { ...allOn, c12_electiveSync: false } },
    ]
  : [{ name: 'default', constraints: base.constraints }];

let failures = 0;

for (const combo of combos) {
  const cfg = mergeConfig({ ...base, constraints: combo.constraints });
  const res = solve(data, cfg);
  if (res.status !== 'success') {
    failures++;
    console.log(`FAIL ${combo.name}: ${res.message} ${(res.errors || []).join('; ')}`);
    continue;
  }
  const v = validate(res.rows, data, cfg);
  if (!v.passed) {
    failures++;
    const bad = v.checks.filter((ch) => !ch.passed).map((ch) => `${ch.id}(${ch.violationCount}): ${ch.violations[0]}`);
    console.log(`FAIL ${combo.name}: validation failed -> ${bad.join(' | ')}`);
    continue;
  }
  console.log(
    `PASS ${combo.name} rows=${res.rows.length} restarts=${res.stats.restarts} softCost=${res.stats.softCostBefore}->${res.stats.softCostAfter} sec=${res.stats.seconds}`
  );
}

// Determinism check: seed 42 twice must match byte-for-byte, seed 99 must differ
const cfg42 = mergeConfig({ ...base, constraints: allOn, params: { ...base.params, seed: 42 } });
const cfg99 = mergeConfig({ ...base, constraints: allOn, params: { ...base.params, seed: 99 } });
const r1 = solve(data, cfg42);
const r2 = solve(data, cfg42);
const r3 = solve(data, cfg99);

const h1 = crypto.createHash('sha256').update(JSON.stringify(r1.rows)).digest('hex').slice(0, 12);
const h2 = crypto.createHash('sha256').update(JSON.stringify(r2.rows)).digest('hex').slice(0, 12);
const h3 = crypto.createHash('sha256').update(JSON.stringify(r3.rows)).digest('hex').slice(0, 12);

if (h1 === h2 && h1 !== h3) {
  console.log(`PASS determinism seed42=${h1} (repeat=${h2}) seed99=${h3}`);
} else {
  failures++;
  console.log(`FAIL determinism seed42=${h1} repeat=${h2} seed99=${h3}`);
}

if (failures > 0) process.exit(1);
