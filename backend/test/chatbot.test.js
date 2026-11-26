import * as store from '../src/services/store.js';
import { loadConfig } from '../src/services/config.js';
import { buildContext } from '../src/services/context.js';
import { solve } from '../src/services/solver.js';
import { validate } from '../src/services/validator.js';
import { extract } from '../src/services/chatbot/nlu.js';
import { reply } from '../src/services/chatbot/bot.js';

store.init();
const data = store.getData();
const config = loadConfig();
const ctx = buildContext(data, config);
const solved = solve(data, config);
const validation = validate(solved.rows, data, config, ctx);
const env = {
  data,
  config,
  ctx,
  rows: solved.rows,
  meta: { stats: solved.stats, source: 'solver' },
  validation,
};

const g0 = ctx.activeGroups[0].group_id;
const g1 = ctx.activeGroups[1].group_id;
const t0 = data.teacher[0].teacher_id;
const t0First = data.teacher[0].teacher_name
  .replace(/^(ผศ\.ดร\.|รศ\.ดร\.|อ\.ดร\.|ผศ\.|รศ\.|อ\.สิบเอก|อ\.)\s*/, '')
  .split(' ')[0];
const r0 = data.room[0];
const g0Regs = data.register.filter((r) => r.group_id === g0);
const s0 = ctx.subjects.get(g0Regs[0].subject_id);
const s1 = ctx.subjects.get(g0Regs[1].subject_id);

const cases = [
  ['สวัสดีครับ', 'greeting'],
  ['ทำอะไรได้บ้าง', 'help'],
  [`ตาราง ${g0} วันจันทร์`, 'schedule', (e) => e.groups[0] === g0 && e.days[0] === 'Mon'],
  [`ครู${t0First}สอนอะไรวันพุธ`, 'schedule', (e) => e.teachers[0] === t0],
  [`${s0.subject_name} เรียนที่ไหน`, 'subject', (e) => e.teachers.length === 0 && e.subjects[0] === s0.subject_id],
  [`ครู ${t0} ว่างคาบไหนวันศุกร์`, 'free', (e) => e.teachers[0] === t0 && e.days[0] === 'Fri'],
  ['ห้องไหนว่าง วันพุธ คาบ 3', 'free_resources', (e) => e.days[0] === 'Wed' && e.periods[0] === 3],
  ['ครูคนไหนว่าง วันจันทร์ คาบ 6', 'free_resources'],
  ['วันอังคาร คาบ 2 ใครเรียนอะไร', 'at_time'],
  [`ห้อง ${r0.room_name} ใช้ทำอะไรบ้าง`, 'schedule', (e) => e.rooms[0] === r0.room_id],
  [`วิชา ${s1.subject_id} เรียนที่ไหน`, 'subject'],
  ['ผลตรวจเงื่อนไข', 'validation'],
  ['ทำไมข้อ 8 ไม่ผ่าน', 'validation', (e) => e.numbers.includes(8)],
  ['เงื่อนไขข้อ 8 คืออะไร', 'explain', (e) => e.numbers.includes(8)],
  ['ภาระสอนของครู', 'load'],
  [`${t0} สอนกี่คาบ`, 'load'],
  ['การใช้ห้อง', 'room_usage'],
  ['ข้อสังเกตจากข้อมูล', 'warnings'],
  ['สรุปภาพรวม', 'summary'],
  ['จัดตารางใหม่ เปิด 8 ปิด 12', 'solve', (e) => e.on.includes(8) && e.off.includes(12)],
  ['จัดตาราง seed 123', 'solve', (e) => e.seed === 123],
  ['สุ่ม seed ใหม่', 'solve', (e) => e.randomSeed === true],
  [`ย้าย ${s0.subject_id} ของ ${g0} ไปพุธ คาบ 1`, 'move', (e) => e.target?.day === 'Wed' && e.target?.period === 1],
  [`หาช่องว่างให้ ${s1.subject_id} ของ ${g0}`, 'find_slot'],
  ['บันทึก seed', 'save_seed'],
  ['ทำไมจัดตารางไม่ได้', 'diagnose'],
  ['หา seed ที่ดีที่สุด 30 seed', 'best_seed'],
  [`ส่งออก PDF ของ ${g0}`, 'export'],
  ['ไปหน้าส่งออก', 'navigate'],
  ['วิธีนำเข้าข้อมูล', 'howto'],
  ['อัลกอริทึมทำงานยังไง', 'algorithm'],
  ['ขอบคุณ', 'thanks'],
  ['กินข้าวยัง', 'unknown'],
];

let failures = 0;
for (const [msg, expectedIntent, entityCheck] of cases) {
  const ents = extract(msg, ctx);
  const res = reply(msg, {}, env);
  const intentOk = res.intent === expectedIntent;
  const entOk = entityCheck ? Boolean(entityCheck(ents)) : true;
  if (intentOk && entOk) {
    console.log(`PASS [${expectedIntent}] "${msg}"`);
  } else {
    failures++;
    console.log(`FAIL [${expectedIntent}] "${msg}" -> got intent=${res.intent}, ents=${JSON.stringify(ents)}`);
  }
}

// Follow-up context test
const first = reply(`ตาราง ${g1}`, {}, env);
const second = reply('แล้ววันพุธล่ะ ว่างคาบไหน', first.context, env);
if (second.intent === 'free' && second.context?.id === g1) {
  console.log(`PASS follow-up context kept id=${g1} intent=free`);
} else {
  failures++;
  console.log(`FAIL follow-up expected free/${g1}, got ${second.intent}/${second.context?.id}`);
}

if (failures > 0) process.exit(1);
