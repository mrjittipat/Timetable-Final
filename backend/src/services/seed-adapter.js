import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './csv.js';

// Exact 7 executive teachers listed in section 1.3 of the competition brief.
// Per user decision, "อ.สิบเอกสุรชัย แซ่ด่าน" (Year 1) and "อ.สุรชัย แซ่ด่าน" (Year 3) stay distinct.
const EXEC_NAMES = new Set([
  'อ.ดร.ภานุ ศรีวิสุทธิ์',
  'อ.สิบเอกสุรชัย แซ่ด่าน',
  'ผศ.ปรัศนี ช่วยการ ซอลีฮี',
  'ผศ.ธรณัส ปัญญาไข',
  'ผศ.กู้เกียรติ บุญมี',
  'ผศ.ดร.ยานี จรคงสี',
  'ผศ.นฤมล หวานดี',
]);

// Longest/most-specific sport tags first so "เทเบิลเทนนิส" never matches "เทนนิส"
// and "วอลเลย์บอลชายหาด" never matches "วอลเลย์บอล".
const SPORT_MATCHERS = [
  ['วอลเลย์บอลชายหาด', /วอลเลย์บอลชายหาด/],
  ['เทเบิลเทนนิส', /เทเบิลเทนนิส/],
  ['มวยสากลสมัครเล่น', /มวยสากล/],
  ['การช่วยชีวิตทางน้ำ', /ช่วยชีวิตทางน้ำ/],
  ['กิจกรรมเข้าจังหวะ', /กิจกรรมเข้าจังหวะ/],
  ['เซปักตะกร้อ', /เซปักตะกร้อ/],
  ['กระบี่กระบอง', /กระบี่กระบอง/],
  ['บาสเกตบอล', /บาสเก[ต็]+บอล/],
  ['วอลเลย์บอล', /วอลเลย์บอล/],
  ['แฮนด์บอล', /แฮนด์บอล/],
  ['ยิมนาสติก', /ยิมนาสติก/],
  ['แบดมินตัน', /แบดมินตัน/],
  ['มวยไทย', /มวยไทย/],
  ['มวยปล้ำ', /มวยปล้ำ/],
  ['ฟุตซอล', /ฟุตซอล/],
  ['เทคบอล', /เทคบอล/],
  ['ว่ายน้ำ', /ว่ายน้ำ/],
  ['เทนนิส', /เทนนิส/],
  ['ปีนผา', /ปีนผา/],
  ['กรีฑา', /กรีฑา/],
];

export function normalizeTeacherName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^อ\.\s+/, 'อ.');
}

export function detectSportTag(subjectName) {
  const s = String(subjectName || '');
  for (const [tag, re] of SPORT_MATCHERS) {
    if (re.test(s)) return tag;
  }
  return '';
}

function parseCredit(creditRaw, conditionText, specialMode) {
  const raw = String(creditRaw || '').trim();
  const m3 = raw.match(/^(\d+)\s*\(\s*(\d+)\s*[-–]\s*(\d+)\s*[-–]\s*(\d+)\s*\)$/);
  if (m3) {
    return {
      credit: Number(m3[1]),
      theory: Number(m3[2]),
      practice: Number(m3[3]),
    };
  }
  const m1 = raw.match(/^(\d+)\s*\(\s*(\d+)\s*\)$/);
  const credit = m1 ? Number(m1[1]) : 0;
  if (specialMode === 'practicum_y4') {
    return { credit, theory: 0, practice: 0 };
  }
  const mHrs = String(conditionText || '').match(/(\d+)\s*ชม/);
  if (mHrs) {
    return { credit, theory: Number(mHrs[1]), practice: 0 };
  }
  return { credit, theory: 0, practice: 0 };
}

export function buildStaticRooms() {
  const homerooms = [
    ['R321', '321'], ['R322', '322'], ['R323', '323'], ['R324', '324'],
    ['R325', '325'], ['R326', '326'], ['R331', '331'], ['R332', '332'],
    ['R333', '333'], ['R334', '334'], ['R335', '335'], ['R336', '336'],
    ['SP1', 'อาคารพิเศษ 1'], ['SP2', 'อาคารพิเศษ 2'],
  ].map(([room_id, room_name]) => ({
    room_id, room_name, room_type: 'Theory', capacity: 40, sport_tag: '',
  }));

  const halls = [
    { room_id: 'HALL1', room_name: 'ห้องประชุม 1', room_type: 'LectureHall', capacity: 120, sport_tag: '' },
    { room_id: 'HALL2', room_name: 'ห้องประชุม 2', room_type: 'LectureHall', capacity: 120, sport_tag: '' },
  ];

  const labs = [
    { room_id: 'COMP1', room_name: 'ห้องคอมพิวเตอร์ 1', room_type: 'ComputerLab', capacity: 30, sport_tag: '' },
    { room_id: 'COMP2', room_name: 'ห้องคอมพิวเตอร์ 2', room_type: 'ComputerLab', capacity: 30, sport_tag: '' },
  ];

  const sports = [
    ['F01_1', 'โรงยิมส์เซปักตะกร้อ สนาม 1', 'เซปักตะกร้อ'],
    ['F01_2', 'โรงยิมส์เซปักตะกร้อ สนาม 2', 'เทคบอล'],
    ['F02', 'โรงยิมส์วอลเลย์', 'วอลเลย์บอล'],
    ['F03', 'โรงยิมส์ฟุตซอล', 'ฟุตซอล'],
    ['F04', 'โรงยิมปีนผา', 'ปีนผา'],
    ['F05_1', 'สระว่ายน้ำ (ด้านบน)', 'ว่ายน้ำ'],
    ['F05_2', 'สระว่ายน้ำ (ด้านล่าง)', 'การช่วยชีวิตทางน้ำ'],
    ['F06', 'สนามเทนนิส', 'เทนนิส'],
    ['F07', 'สนามวอลเลย์บอลชายหาด', 'วอลเลย์บอลชายหาด'],
    ['F08', 'สนามฟุตบอล (กรีฑา)', 'กรีฑา'],
    ['F09_N', 'ลานตึกคณะพลศึกษา ทิศเหนือ', 'กระบี่กระบอง'],
    ['F09_S', 'ลานตึกคณะพลศึกษา ทิศใต้', 'กิจกรรมเข้าจังหวะ'],
    ['F10_1', 'สปอร์ตคอมเพล็กซ์ ชั้น 1 สนาม 1', 'เทเบิลเทนนิส'],
    ['F10_2', 'สปอร์ตคอมเพล็กซ์ ชั้น 1 สนาม 2', 'มวยปล้ำ'],
    ['F10_3', 'สปอร์ตคอมเพล็กซ์ ชั้น 1 สนาม 3', 'แบดมินตัน'],
    ['F10_4', 'สปอร์ตคอมเพล็กซ์ ชั้น 1 สนาม 4', 'ยิมนาสติก'],
    ['F11_1', 'สปอร์ตคอมเพล็กซ์ ชั้น 2 สนาม 1', 'บาสเกตบอล'],
    ['F11_2', 'สปอร์ตคอมเพล็กซ์ ชั้น 2 สนาม 2', 'แฮนด์บอล'],
    ['F12_1', 'โรงยิมมวย สนาม 1', 'มวยไทย'],
    ['F12_2', 'โรงยิมมวย สนาม 2', 'มวยสากลสมัครเล่น'],
  ].map(([room_id, room_name, sport_tag]) => ({
    room_id, room_name, room_type: 'Sport', capacity: 40, sport_tag,
  }));

  return [...homerooms, ...halls, ...labs, ...sports];
}

export function buildStaticGroups() {
  return [
    { group_id: 'Y1_1', group_name: 'ปี 1/1', student_count: 30, advisor: '', year: 1, home_room: 'R321' },
    { group_id: 'Y1_2', group_name: 'ปี 1/2', student_count: 30, advisor: '', year: 1, home_room: 'R322' },
    { group_id: 'Y1_3', group_name: 'ปี 1/3', student_count: 30, advisor: '', year: 1, home_room: 'R323' },
    { group_id: 'Y1_4', group_name: 'ปี 1/4', student_count: 30, advisor: '', year: 1, home_room: 'R324' },
    { group_id: 'Y2_1', group_name: 'ปี 2/1', student_count: 30, advisor: '', year: 2, home_room: 'R325' },
    { group_id: 'Y2_2', group_name: 'ปี 2/2', student_count: 30, advisor: '', year: 2, home_room: 'R326' },
    { group_id: 'Y2_3', group_name: 'ปี 2/3', student_count: 30, advisor: '', year: 2, home_room: 'R331' },
    { group_id: 'Y2_4', group_name: 'ปี 2/4', student_count: 30, advisor: '', year: 2, home_room: 'R332' },
    { group_id: 'Y3_1', group_name: 'ปี 3/1', student_count: 25, advisor: '', year: 3, home_room: 'R333' },
    { group_id: 'Y3_2', group_name: 'ปี 3/2', student_count: 25, advisor: '', year: 3, home_room: 'R334' },
    { group_id: 'Y3_3', group_name: 'ปี 3/3', student_count: 25, advisor: '', year: 3, home_room: 'R335' },
    { group_id: 'Y4_1', group_name: 'ปี 4/1', student_count: 20, advisor: '', year: 4, home_room: 'R336' },
    { group_id: 'Y4_2', group_name: 'ปี 4/2', student_count: 20, advisor: '', year: 4, home_room: 'SP1' },
    { group_id: 'Y4_3', group_name: 'ปี 4/3', student_count: 20, advisor: '', year: 4, home_room: 'SP2' },
  ];
}

export function buildStaticTimeslots() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const slots = [];
  let idx = 1;
  for (const day of days) {
    for (let period = 1; period <= 9; period++) {
      const sh = 7 + period;
      const eh = 8 + period;
      slots.push({
        timeslot_id: `T${String(idx++).padStart(2, '0')}`,
        day,
        period,
        start: `${String(sh).padStart(2, '0')}:00`,
        end: `${String(eh).padStart(2, '0')}:00`,
      });
    }
  }
  return slots;
}

export function convertYearRowsToTables(yearRowsByYear) {
  const student_group = buildStaticGroups();
  const room = buildStaticRooms();
  const timeslot = buildStaticTimeslots();

  const teacherByName = new Map();
  const teacher = [];
  const subjectById = new Map();
  const subject = [];
  const teachKeys = new Set();
  const teach = [];
  const registerKeys = new Set();
  const register = [];

  const getOrAddTeacher = (rawName, note) => {
    const clean = normalizeTeacherName(rawName);
    if (!clean) return null;
    let rec = teacherByName.get(clean);
    const isExec = String(note || '').includes('ผู้บริหาร') || EXEC_NAMES.has(clean);
    if (!rec) {
      rec = {
        teacher_id: `T${String(teacher.length + 1).padStart(2, '0')}`,
        teacher_name: clean,
        role: isExec ? 'Leader' : 'Teacher',
      };
      teacherByName.set(clean, rec);
      teacher.push(rec);
    } else if (isExec && rec.role !== 'Leader') {
      rec.role = 'Leader';
    }
    return rec.teacher_id;
  };

  for (const { year, rows } of yearRowsByYear) {
    const yearGroups = student_group.filter((g) => g.year === year);
    for (const r of rows) {
      const subjectId = String(r['รหัสวิชา'] || '').trim();
      const subjectName = String(r['ชื่อรายวิชา'] || '').trim();
      if (!subjectId || !subjectName) continue;

      const creditRaw = String(r['หน่วยกิต'] || '').trim();
      const groupType = String(r['กลุ่มวิชา'] || '').trim();
      const teacherRaw = r['อาจารย์ผู้สอน'];
      const teacherNote = r['หมายเหตุอาจารย์'];
      const condition = String(r['เงื่อนไขรายวิชา'] || '').trim();

      let specialMode = 'normal';
      let electiveSet = '';
      if (year === 4 || /360/.test(creditRaw)) {
        specialMode = 'practicum_y4';
      } else if (/เรียนรวมทั้งชั้นปี/.test(condition)) {
        specialMode = 'combined_year';
      } else if (
        groupType === 'ทักษะและการสอนกีฬาขั้นสูง' ||
        groupType === 'การตัดสินกีฬา' ||
        groupType === 'กลวิธีการฝึกกีฬา' ||
        /เลือกเรียน/.test(condition)
      ) {
        specialMode = 'elective';
        if (year === 2) electiveSet = 'Y2_EL';
        else if (groupType === 'การตัดสินกีฬา') electiveSet = 'Y3_EL1';
        else electiveSet = 'Y3_EL2';
      }

      const { credit, theory, practice } = parseCredit(creditRaw, condition, specialMode);
      const needsSport =
        groupType === 'ทักษะและการสอนกีฬา' || specialMode === 'elective';
      const sportTag = needsSport ? detectSportTag(subjectName) : '';

      if (!subjectById.has(subjectId)) {
        const sub = {
          subject_id: subjectId,
          subject_name: subjectName,
          theory,
          practice,
          credit,
          group_type: groupType,
          credit_raw: creditRaw,
          year,
          special_mode: specialMode,
          elective_set: electiveSet,
          sport_tag: sportTag,
        };
        subjectById.set(subjectId, sub);
        subject.push(sub);
      }

      const teacherId = getOrAddTeacher(teacherRaw, teacherNote);
      if (teacherId) {
        const tk = `${teacherId}|${subjectId}`;
        if (!teachKeys.has(tk)) {
          teachKeys.add(tk);
          teach.push({ teacher_id: teacherId, subject_id: subjectId });
        }
      }

      if (specialMode === 'elective') {
        const rk = `${electiveSet}|${subjectId}`;
        if (!registerKeys.has(rk)) {
          registerKeys.add(rk);
          register.push({ group_id: electiveSet, subject_id: subjectId });
        }
      } else if (specialMode !== 'practicum_y4') {
        for (const g of yearGroups) {
          const rk = `${g.group_id}|${subjectId}`;
          if (!registerKeys.has(rk)) {
            registerKeys.add(rk);
            register.push({ group_id: g.group_id, subject_id: subjectId });
          }
        }
      } else {
        for (const g of yearGroups) {
          const rk = `${g.group_id}|${subjectId}`;
          if (!registerKeys.has(rk)) {
            registerKeys.add(rk);
            register.push({ group_id: g.group_id, subject_id: subjectId });
          }
        }
      }
    }
  }

  return { teacher, room, student_group, subject, teach, timeslot, register };
}

export function loadCompetitionSeed(seedDir) {
  const yearFiles = [
    { year: 1, file: 'ชั้นปีที่1.csv' },
    { year: 2, file: 'ชั้นปีที่2.csv' },
    { year: 3, file: 'ชั้นปีที่3.csv' },
    { year: 4, file: 'ชั้นปีที่4.csv' },
  ];
  const loaded = [];
  for (const yf of yearFiles) {
    const fp = path.join(seedDir, yf.file);
    if (fs.existsSync(fp)) {
      const text = fs.readFileSync(fp, 'utf8');
      loaded.push({ year: yf.year, rows: parseCsv(text) });
    }
  }
  if (!loaded.length) return null;
  return convertYearRowsToTables(loaded);
}
