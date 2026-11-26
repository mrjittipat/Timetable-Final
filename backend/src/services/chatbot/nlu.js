import { DAY_TH } from '../grid.js';

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

export function normalizeText(text) {
  let s = String(text || '');
  s = s.replace(/[๐-๙]/g, (ch) => String(THAI_DIGITS.indexOf(ch)));
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

const DAY_PATTERNS = [
  ['Mon', /(?:วัน)?จันทร์|\bmon\b/],
  ['Tue', /(?:วัน)?อังคาร|\btue\b/],
  ['Wed', /(?:วัน)?พุธ|\bwed\b/],
  ['Thu', /(?:วัน)?พฤหัส(?:บดี)?|\bthu\b/],
  ['Fri', /(?:วัน)?ศุกร์|\bfri\b/],
  ['Sat', /(?:วัน)?เสาร์|\bsat\b/],
  ['Sun', /(?:วัน)?อาทิตย์|\bsun\b/],
];

function todayKey(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
  }).format(now);
  return weekday.slice(0, 3);
}

function stripTitle(name) {
  return String(name || '')
    .replace(/^(ผศ\.ดร\.|รศ\.ดร\.|อ\.ดร\.|ผศ\.|รศ\.|อ\.สิบเอก|อ\.|ครู|อาจารย์|นาย|นางสาว|นาง)\s*/i, '')
    .trim();
}

export function extract(text, ctx) {
  const norm = normalizeText(text);
  const groups = [];
  const teachers = [];
  const rooms = [];
  const subjects = [];
  const days = [];
  const periods = [];
  const numbers = [];
  const on = [];
  const off = [];
  let seed = null;
  let randomSeed = false;
  let target = null;

  // 1. Target for move (extract and strip before source day/period parsing)
  let work = norm;
  const targetMatch = work.match(
    /ไป(?:ที่|ยัง)?\s*(?:วัน)?(จันทร์|อังคาร|พุธ|พฤหัส(?:บดี)?|ศุกร์|mon|tue|wed|thu|fri)?\s*คาบ(?:ที่)?\s*(\d+)/
  );
  if (targetMatch) {
    let tDay = null;
    if (targetMatch[1]) {
      for (const [dk, re] of DAY_PATTERNS) {
        if (re.test(targetMatch[1])) {
          tDay = dk;
          break;
        }
      }
    }
    target = { day: tDay, period: Number(targetMatch[2]) };
    work = work.replace(targetMatch[0], ' ');
  }

  // 2. Seed & randomSeed
  const seedMatch = work.match(/seed\s*(?:=|:|เป็น|ค่า)?\s*(\d+)/);
  if (seedMatch) seed = Number(seedMatch[1]);
  if (/(สุ่ม\s*seed|seed\s*ใหม่|random)/.test(work)) randomSeed = true;

  // 3. Constraint numbers & on/off toggles
  const numMatches = [...work.matchAll(/(?:ข้อ|เงื่อนไข(?:ที่|ข้อ)?|\bc)\s*(\d{1,2})\b/g)];
  for (const m of numMatches) {
    const n = Number(m[1]);
    if (n >= 0 && n <= 13 && !numbers.includes(n)) numbers.push(n);
  }
  const toggleMatches = [...work.matchAll(/(เปิด|ปิด)\s*(?:เงื่อนไข|ข้อ)?\s*(ทั้งหมด|(?:\d{1,2}(?:\s*(?:,|และ|\s)\s*\d{1,2})*))/g)];
  const specialNos = [8, 9, 10, 11, 12, 13];
  for (const m of toggleMatches) {
    const arr = m[1] === 'เปิด' ? on : off;
    if (m[2] === 'ทั้งหมด') {
      for (const n of specialNos) if (!arr.includes(n)) arr.push(n);
    } else {
      for (const d of m[2].match(/\d{1,2}/g) || []) {
        const n = Number(d);
        if (specialNos.includes(n) && !arr.includes(n)) arr.push(n);
      }
    }
  }

  // 4. Days
  for (const [dk, re] of DAY_PATTERNS) {
    if (re.test(work) && !days.includes(dk)) days.push(dk);
  }
  if (/วันนี้/.test(work)) {
    const dk = todayKey(0);
    if (!days.includes(dk)) days.push(dk);
  }
  if (/พรุ่งนี้/.test(work)) {
    const dk = todayKey(1);
    if (!days.includes(dk)) days.push(dk);
  }

  // 5. Periods
  const pMatches = [...work.matchAll(/คาบ(?:ที่)?\s*(\d+)(?:\s*(?:-|–|ถึง)\s*(\d+))?/g)];
  const validPeriods = new Set(ctx.periods || []);
  for (const m of pMatches) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let p = Math.min(a, b); p <= Math.max(a, b); p++) {
      if (validPeriods.has(p) && !periods.includes(p)) periods.push(p);
    }
  }

  // 6. Groups
  for (const g of ctx.groups.values()) {
    const gidLow = g.group_id.toLowerCase();
    const gnameLow = g.group_name.toLowerCase();
    if (work.includes(gidLow) || work.includes(gnameLow)) {
      if (!groups.includes(g.group_id)) groups.push(g.group_id);
    }
  }
  // Also match shorthand like "ปี 1/1" or "1/1"
  const yrGrp = work.match(/(?:ปี\s*)?([1-4])\s*\/\s*([1-4])/);
  if (yrGrp) {
    const cand = `Y${yrGrp[1]}_${yrGrp[2]}`;
    if (ctx.groups.has(cand) && !groups.includes(cand)) groups.push(cand);
  }

  // 7. Subjects (by ID or name >= 4 chars)
  let textWithoutSubjects = work;
  const allSubjects = [...ctx.subjects.values()].sort((a, b) => b.subject_name.length - a.subject_name.length);
  for (const s of allSubjects) {
    const sidLow = s.subject_id.toLowerCase();
    const snameLow = s.subject_name.toLowerCase();
    if (work.includes(sidLow) || (snameLow.length >= 4 && work.includes(snameLow))) {
      if (!subjects.includes(s.subject_id)) subjects.push(s.subject_id);
      if (snameLow.length >= 4) textWithoutSubjects = textWithoutSubjects.split(snameLow).join(' ');
    }
  }
  if (/พบ(?:อาจารย์)?ที่ปรึกษา/.test(work) && !subjects.includes('ADVISOR')) subjects.push('ADVISOR');

  // 8. Teachers (after removing subject names to avoid false positives)
  const allSubjectNamesConcat = allSubjects.map((s) => s.subject_name.toLowerCase()).join(' ');
  for (const t of ctx.teachers.values()) {
    const tidLow = t.teacher_id.toLowerCase();
    const tFullLow = t.teacher_name.toLowerCase();
    const firstName = stripTitle(t.teacher_name).split(' ')[0]?.toLowerCase() || '';
    const inSub = firstName.length >= 2 && allSubjectNamesConcat.includes(firstName);

    const idRe = new RegExp(`(?:^|[^a-z0-9])${tidLow}(?:$|[^a-z0-9])`);
    let matched = idRe.test(textWithoutSubjects) || textWithoutSubjects.includes(tFullLow);
    if (!matched && firstName.length >= 2) {
      if (inSub) {
        matched =
          textWithoutSubjects.includes(`ครู${firstName}`) ||
          textWithoutSubjects.includes(`ครู ${firstName}`) ||
          textWithoutSubjects.includes(`อ.${firstName}`) ||
          textWithoutSubjects.includes(`อาจารย์${firstName}`);
      } else {
        matched = textWithoutSubjects.includes(firstName);
      }
    }
    if (matched && !teachers.includes(t.teacher_id)) teachers.push(t.teacher_id);
  }

  // 9. Rooms
  for (const r of ctx.rooms.values()) {
    const ridLow = r.room_id.toLowerCase();
    const rnameLow = r.room_name.toLowerCase();
    const idRe = new RegExp(`(?:^|[^a-z0-9])${ridLow}(?:$|[^a-z0-9])`);
    const nameRe = /^\d+$/.test(rnameLow)
      ? new RegExp(`ห้อง(?:เรียน)?\\s*${rnameLow}(?:$|\\D)`)
      : null;
    if (
      idRe.test(work) ||
      (nameRe ? nameRe.test(work) : rnameLow.length >= 3 && work.includes(rnameLow))
    ) {
      if (!rooms.includes(r.room_id)) rooms.push(r.room_id);
    }
  }

  return {
    groups,
    teachers,
    rooms,
    subjects,
    days,
    periods,
    numbers,
    seed,
    randomSeed,
    on,
    off,
    target,
  };
}

export function detectIntent(text, ents) {
  const t = normalizeText(text);
  if (/^(สวัสดี|หวัดดี|hello|hi|ดีจ้า|ดีครับ|ดีค่ะ)/.test(t) && t.length < 20) return 'greeting';
  if (/(ขอบคุณ|ขอบใจ|thank)/.test(t) && t.length < 25) return 'thanks';
  if (/(ทำอะไรได้|ช่วยอะไรได้|ความสามารถ|ใช้ยังไง$|^help$|^ช่วยด้วย|เมนู|คำสั่ง)/.test(t)) return 'help';
  if (/^(ล้างแชท|เริ่มใหม่|clear)$/.test(t)) return 'clear';
  if (/(อัลกอริทึม|algorithm|csp|annealing|ทำงานยังไง|ทำงานอย่างไร|หลักการ)/.test(t)) return 'algorithm';
  if (/(วิธี|ยังไง|อย่างไร|ทำไง|how)/.test(t) && !/(ทำไม)/.test(t)) return 'howto';
  if (/(ไปหน้า|เปิดหน้า|พาไป|ไปที่หน้า)/.test(t)) return 'navigate';
  if (/(จัด(?:ตาราง)?ไม่ได้|จัด(?:ตาราง)?ไม่สำเร็จ|วิเคราะห์สาเหตุ|หาสาเหตุ|diagnose|ทำไม.*ไม่สำเร็จ)/.test(t)) return 'diagnose';
  if (/(seed\s*ที่ดีที่สุด|หา\s*seed|ค้นหา\s*seed|best\s*seed|seed\s*ดีสุด|ตารางที่ดีที่สุด)/.test(t)) return 'best_seed';
  if (/(บันทึก|เซฟ|save)\s*seed/.test(t)) return 'save_seed';
  if (/(หาช่อง|ช่องว่างให้|ย้ายไปไหน|ย้ายไปที่ไหน|ควรย้าย|ย้ายได้ที่ไหน|แนะนำช่อง)/.test(t)) return 'find_slot';
  if (/(ย้าย|สลับ)/.test(t)) return 'move';
  if (/(ส่งออก|ดาวน์โหลด|export|pdf|excel|xlsx|csv|พิมพ์ตาราง|ปริ้น|print)/.test(t)) return 'export';
  if (/(จัดตาราง|รัน|run|solve|สุ่ม\s*seed|seed\s*ใหม่)/.test(t) && !/(ผล|สถานะ)/.test(t)) return 'solve';
  if (/(ข้อสังเกต|คำเตือน|ปัญหาข้อมูล|ข้อมูลผิด|warning|ข้อมูลมีปัญหา)/.test(t)) return 'warnings';
  if (ents.numbers.length > 0 && /(คืออะไร|หมายถึง|อธิบาย|คือ)/.test(t) && !/(ทำไม|ไม่ผ่าน)/.test(t)) return 'explain';
  if (/(ผ่าน|เงื่อนไข|ผลตรวจ|ชนกัน|ชน|ผิดเงื่อนไข|ละเมิด|validator|ตรวจ)/.test(t)) return 'validation';
  if (/(ว่าง)/.test(t) && /(ห้องไหน|ครูคนไหน|ครูใคร|อาจารย์คนไหน|อาจารย์ใคร|ห้องอะไร|ใครว่าง|สนามไหน)/.test(t)) return 'free_resources';
  if (/(ว่าง)/.test(t)) return 'free';
  if (/(กี่คาบ|ภาระ|ชั่วโมงสอน|workload|สอนเยอะ|สอนมาก|สอนน้อย|จำนวนคาบ)/.test(t)) return 'load';
  if (/(การใช้ห้อง|ใช้ห้อง|ห้องไหนใช้|อัตราการใช้)/.test(t) && ents.rooms.length === 0) return 'room_usage';
  if (/(สรุป|ภาพรวม|overview|สถานะ)/.test(t)) return 'summary';
  if (ents.days.length > 0 && ents.periods.length > 0 && ents.groups.length === 0 && ents.teachers.length === 0 && ents.rooms.length === 0) return 'at_time';
  if (ents.subjects.length > 0 && ents.groups.length === 0 && ents.teachers.length === 0 && ents.rooms.length === 0) return 'subject';
  if (ents.groups.length > 0 || ents.teachers.length > 0 || ents.rooms.length > 0 || /(ตาราง|เรียนอะไร|สอนอะไร)/.test(t)) return 'schedule';
  return 'unknown';
}

export { DAY_TH };
