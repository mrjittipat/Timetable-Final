import * as store from '../src/services/store.js';
import { DEFAULT_CONFIG, mergeConfig } from '../src/services/config.js';
import { buildContext } from '../src/services/context.js';
import { solve } from '../src/services/solver.js';
import { validate } from '../src/services/validator.js';

store.init();
const data = store.getData();
const cfg = mergeConfig(DEFAULT_CONFIG);
const ctx = buildContext(data, cfg);

const res = solve(data, cfg);
if (res.status !== 'success') {
  console.log(`FAIL solver failed: ${res.message}`);
  process.exit(1);
}

const good = res.rows;
let failures = 0;

function check(label, pass, detail = '') {
  if (pass) console.log(`PASS ${label}${detail ? ' — ' + detail : ''}`);
  else {
    failures++;
    console.log(`FAIL ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function cloneRows(rows) {
  return rows.map((r) => ({ ...r }));
}

const baseVal = validate(good, data, cfg, ctx);
check('Valid solver output passes all checks', baseVal.passed, `${good.length} rows`);

function expectFail(checkId, label, mutateFn) {
  const copy = cloneRows(good);
  mutateFn(copy);
  const v = validate(copy, data, cfg, ctx);
  const target = v.checks.find((ch) => ch.id === checkId);
  check(
    `${checkId} catches ${label}`,
    Boolean(target && !target.passed && target.violations.length > 0),
    target?.violations?.[0] || 'no violation'
  );
}

// I0: unknown room id
expectFail('I0', 'unknown room id', (rows) => {
  const r = rows.find((x) => x.subject_id !== 'ADVISOR' && x.subject_id !== 'ACTIVITY');
  r.room_id = 'INVALID_ROOM_999';
});

// C1: break period 5
const breakSlot = data.timeslot.find((s) => s.period === 5).timeslot_id;
expectFail('C1', 'class in break period 5', (rows) => {
  const r = rows.find((x) => x.group_id === 'Y1_1' && x.subject_id !== 'ADVISOR' && x.subject_id !== 'ACTIVITY');
  r.timeslot_id = breakSlot;
});

// C2: Wed P8 advisor missing
expectFail('C2', 'missing Wed P8 advisor', (rows) => {
  const idx = rows.findIndex((x) => x.subject_id === 'ADVISOR');
  rows.splice(idx, 1);
});

// C3: executive teacher scheduled Tue P1
const tueP1 = data.timeslot.find((s) => s.day === 'Tue' && s.period === 1).timeslot_id;
expectFail('C3', 'executive in Tue P1 meeting', (rows) => {
  const exec = data.teacher.find((t) => t.role === 'Leader');
  const r = rows.find((x) => x.teacher_id.split('+').includes(exec.teacher_id));
  r.timeslot_id = tueP1;
});

// C4: missing period (hours != L+P)
expectFail('C4', 'missing period', (rows) => {
  const idx = rows.findIndex((x) => x.group_id === 'Y1_1' && x.subject_id !== 'ADVISOR' && x.subject_id !== 'ACTIVITY');
  rows.splice(idx, 1);
});

// C5: theory subject in computer lab
expectFail('C5', 'theory subject in computer lab', (rows) => {
  const r = rows.find((x) => x.subject_id === 'มศ 041017');
  r.room_id = 'COMP1';
});

// C6: IT subject in theory room
expectFail('C6', 'IT subject in wrong room type', (rows) => {
  const r = rows.find((x) => x.subject_id === 'กศ 032010');
  r.room_id = 'R321';
});

// C7: missing co-teacher
expectFail('C7', 'missing co-teacher', (rows) => {
  const r = rows.find((x) => x.subject_id === 'กศ 071001');
  r.teacher_id = r.teacher_id.split('+')[0];
});

// C8: sport subject missing sport facility
expectFail('C8', 'sport subject missing gym/field', (rows) => {
  const r = rows.find((x) => x.subject_id === 'พล 051383');
  r.room_id = r.room_id.split('+')[0];
});

// C9: elective subject desync
const monP1 = data.timeslot.find((s) => s.day === 'Mon' && s.period === 1).timeslot_id;
const friP9 = data.timeslot.find((s) => s.day === 'Fri' && s.period === 9).timeslot_id;
expectFail('C9', 'elective subject desync', (rows) => {
  const r = rows.find((x) => x.group_id === 'Y2_EL');
  r.timeslot_id = r.timeslot_id === monP1 ? friP9 : monP1;
});

// C10: Year 4 scheduled row
expectFail('C10', 'Year 4 has scheduled class', (rows) => {
  rows.push({ group_id: 'Y4_1', timeslot_id: monP1, subject_id: 'กศ 021037', teacher_id: 'T11', room_id: 'R336' });
});

if (failures > 0) process.exit(1);
