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

// I0: invalid room id
expectFail('I0', 'unknown room id', (rows) => {
  const r = rows.find((x) => x.subject_id !== 'ADVISOR' && x.subject_id !== 'ACTIVITY');
  r.room_id = 'INVALID_ROOM_999';
});

// C1: drop 1 period of a normal subject
expectFail('C1', 'missing period', (rows) => {
  const idx = rows.findIndex((x) => x.group_id === 'Y1_1' && x.subject_id !== 'ADVISOR' && x.subject_id !== 'ACTIVITY');
  rows.splice(idx, 1);
});

// C2: move a row into break period 5
const breakSlot = data.timeslot.find((s) => s.period === 5).timeslot_id;
expectFail('C2', 'class in break period', (rows) => {
  const r = rows.find((x) => x.group_id === 'Y1_1' && x.subject_id !== 'ADVISOR' && x.subject_id !== 'ACTIVITY');
  r.timeslot_id = breakSlot;
});

// C3: duplicate group at same slot
expectFail('C3', 'group double-booked', (rows) => {
  const a = rows.find((x) => x.group_id === 'Y1_1' && x.subject_id === 'มศ 041017');
  const b = rows.find((x) => x.group_id === 'Y1_1' && x.subject_id === 'สศ 021011');
  b.timeslot_id = a.timeslot_id;
});

// C4: teacher double-booked
expectFail('C4', 'teacher double-booked', (rows) => {
  const a = rows.find((x) => x.group_id === 'Y1_1' && x.subject_id === 'มศ 041017');
  const b = rows.find((x) => x.group_id === 'Y1_2' && x.subject_id === 'มศ 041017');
  b.timeslot_id = a.timeslot_id;
});

// C5: room double-booked
expectFail('C5', 'room double-booked', (rows) => {
  const a = rows.find((x) => x.group_id === 'Y1_1' && x.subject_id === 'มศ 041017');
  const b = rows.find((x) => x.group_id === 'Y1_2' && x.timeslot_id === a.timeslot_id);
  if (b) b.room_id = a.room_id;
  else {
    const c = rows.find((x) => x.group_id === 'Y1_2' && x.subject_id === 'สศ 021011');
    c.timeslot_id = a.timeslot_id;
    c.room_id = a.room_id;
  }
});

// C6: capacity exceeded (combined year 120 students in 40-seat room)
expectFail('C6', 'room capacity exceeded', (rows) => {
  const r = rows.find((x) => x.subject_id === 'กศ 071001');
  r.room_id = 'R321';
});

// C7: missing co-teacher
expectFail('C7', 'missing co-teacher', (rows) => {
  const r = rows.find((x) => x.subject_id === 'กศ 071001');
  r.teacher_id = r.teacher_id.split('+')[0];
});

// C8: executive teacher scheduled Tue P1
const tueP1 = data.timeslot.find((s) => s.day === 'Tue' && s.period === 1).timeslot_id;
expectFail('C8', 'executive in Tue P1 meeting', (rows) => {
  const exec = data.teacher.find((t) => t.role === 'Leader');
  const r = rows.find((x) => x.teacher_id.split('+').includes(exec.teacher_id));
  r.timeslot_id = tueP1;
});

// C9: remove Wed P8 ADVISOR
expectFail('C9', 'missing Wed P8 advisor', (rows) => {
  const idx = rows.findIndex((x) => x.subject_id === 'ADVISOR');
  rows.splice(idx, 1);
});

// C10: IT subject in theory room instead of computer lab
expectFail('C10', 'IT subject in wrong room type', (rows) => {
  const r = rows.find((x) => x.subject_id === 'กศ 032010');
  r.room_id = 'R321';
});

// C11: sport subject missing sport facility
expectFail('C11', 'sport subject missing gym/field', (rows) => {
  const r = rows.find((x) => x.subject_id === 'พล 051383');
  r.room_id = r.room_id.split('+')[0];
});

// C12: elective subject desynchronized
const monP1 = data.timeslot.find((s) => s.day === 'Mon' && s.period === 1).timeslot_id;
const friP9 = data.timeslot.find((s) => s.day === 'Fri' && s.period === 9).timeslot_id;
expectFail('C12', 'elective subject desync', (rows) => {
  const r = rows.find((x) => x.group_id === 'Y2_EL');
  r.timeslot_id = r.timeslot_id === monP1 ? friP9 : monP1;
});

// C13: combined-year group desync
expectFail('C13', 'combined-year group desync', (rows) => {
  const r = rows.find((x) => x.subject_id === 'กศ 071001' && x.group_id === 'Y1_2');
  r.timeslot_id = r.timeslot_id === monP1 ? friP9 : monP1;
});

if (failures > 0) process.exit(1);
