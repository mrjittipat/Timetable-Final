import { extract, detectIntent, normalizeText } from './nlu.js';
import { CONSTRAINTS, PAGES, HOWTO, ALGORITHM } from './knowledge.js';
import { buildGrid, DAY_TH, groupLabel, roomNames, subjectName, teacherNames } from '../grid.js';
import { timetableStats } from '../stats.js';
import { moveSpan, validMoveTargets } from '../editor.js';
import { validate } from '../validator.js';
import { splitIds } from '../context.js';

const SPECIAL_KEY_BY_NO = {
  8: 'c8_execMeeting',
  9: 'c9_wedFixed',
  10: 'c10_roomCategory',
  11: 'c11_sportDualRoom',
  12: 'c12_electiveSync',
  13: 'c13_combinedYear',
};

function compressPeriods(nums) {
  if (!nums.length) return 'ไม่มี';
  const sorted = [...nums].sort((a, b) => a - b);
  const parts = [];
  let s = sorted[0];
  let e = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === e + 1) e = sorted[i];
    else {
      parts.push(s === e ? String(s) : `${s}-${e}`);
      s = e = sorted[i];
    }
  }
  parts.push(s === e ? String(s) : `${s}-${e}`);
  return parts.join(', ');
}

function needTimetableReply(intent) {
  return {
    text: 'ยังไม่มีตารางเรียนในระบบ ต้องจัดตารางก่อนจึงจะตอบคำถามนี้ได้',
    cards: [
      {
        type: 'action',
        title: 'จัดตารางเรียนอัตโนมัติ',
        lines: ['กดยืนยันเพื่อเริ่มจัดตารางตามเงื่อนไขปัจจุบัน'],
        status: 'pending',
        action: { kind: 'solve', payload: {}, label: 'เริ่มจัดตาราง' },
      },
    ],
    suggestions: ['จัดตารางใหม่', 'สรุปภาพรวม', 'ทำอะไรได้บ้าง'],
    context: {},
    intent,
  };
}

export function reply(message, chatCtx = {}, env = {}) {
  const { data, config, ctx, rows = [], meta = null, validation = null } = env;
  const ents = extract(message, ctx);
  const intent = detectIntent(message, ents);
  const hasTT = Array.isArray(rows) && rows.length > 0;

  let target = null;
  if (ents.groups.length > 0) target = { view: 'group', id: ents.groups[0] };
  else if (ents.teachers.length > 0) target = { view: 'teacher', id: ents.teachers[0] };
  else if (ents.rooms.length > 0) target = { view: 'room', id: ents.rooms[0] };
  else if (chatCtx && chatCtx.view && chatCtx.id) target = { view: chatCtx.view, id: chatCtx.id, fromContext: true };

  const nextCtx = target ? { view: target.view, id: target.id } : chatCtx || {};

  if (intent === 'greeting') {
    return {
      text: `สวัสดีครับ ผมคือ **ผู้ช่วยจัดตารางอัตโนมัติ** ของ ${config.document?.college || 'คณะศึกษาศาสตร์'}\nถามตารางเรียน ห้องว่าง ภาระสอน ตรวจเงื่อนไข หรือสั่งจัดตารางใหม่ได้เลยครับ`,
      cards: [],
      suggestions: ['สรุปภาพรวม', 'ตาราง Y1_1 วันจันทร์', 'ห้องไหนว่าง วันพุธ คาบ 3', 'ผลตรวจเงื่อนไข'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'thanks') {
    return {
      text: 'ยินดีครับ หากต้องการตรวจสอบตารางหรือปรับเงื่อนไขเพิ่มเติม ถามได้ทุกเมื่อเลยครับ',
      cards: [],
      suggestions: ['สรุปภาพรวม', 'ผลตรวจเงื่อนไข'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'clear') {
    return { text: 'ล้างประวัติการสนทนาแล้วครับ', cards: [], suggestions: ['สรุปภาพรวม', 'ทำอะไรได้บ้าง'], context: {}, intent };
  }

  if (intent === 'help') {
    const g0 = ctx.activeGroups[0]?.group_id || 'Y1_1';
    return {
      text: 'ผมช่วยงานได้หลายด้านเลยครับ ลองคลิกตัวอย่างคำถามด้านล่างได้เลย:',
      cards: [
        { type: 'list', title: 'ถามข้อมูลตาราง', ask: true, items: [`ตาราง ${g0} วันจันทร์`, 'ห้องไหนว่าง วันพุธ คาบ 3', 'วันอังคาร คาบ 2 ใครเรียนอะไร'] },
        { type: 'list', title: 'วิเคราะห์และอธิบาย', ask: true, items: ['ผลตรวจเงื่อนไข', 'ภาระสอนของครู', 'การใช้ห้อง', 'เงื่อนไขข้อ 8 คืออะไร'] },
        { type: 'list', title: 'สั่งงาน (กดยืนยันก่อนทำ)', ask: true, items: ['จัดตารางใหม่', 'หา seed ที่ดีที่สุด 20 seed', 'ทำไมจัดตารางไม่ได้'] },
        { type: 'list', title: 'ช่วยใช้งานระบบ', ask: true, items: ['วิธีนำเข้าข้อมูล', 'อัลกอริทึมทำงานยังไง', `ส่งออก PDF ของ ${g0}`] },
      ],
      suggestions: ['สรุปภาพรวม', 'ผลตรวจเงื่อนไข'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'algorithm') {
    return {
      text: ALGORITHM.join('\n\n'),
      cards: [],
      suggestions: ['จัดตารางใหม่', 'หา seed ที่ดีที่สุด 20 seed'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'howto') {
    const norm = normalizeText(message);
    const match = HOWTO.find((h) => h.keys.some((k) => norm.includes(k))) || HOWTO[0];
    return {
      text: `**${match.title}**\n` + match.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      cards: [{ type: 'buttons', items: [{ label: `ไปหน้า ${match.page}`, action: { kind: 'navigate', payload: match.page } }] }],
      suggestions: ['อัลกอริทึมทำงานยังไง', 'ทำอะไรได้บ้าง'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'navigate') {
    const norm = normalizeText(message);
    const page = PAGES.find((p) => p.keywords.some((k) => norm.includes(k))) || PAGES[0];
    return {
      text: `กำลังพาไปหน้า **${page.title}** (${page.path}) ครับ`,
      cards: [{ type: 'buttons', items: [{ label: `เปิดหน้า ${page.title}`, action: { kind: 'navigate', payload: page.path, auto: true } }] }],
      suggestions: [],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'warnings') {
    const warns = ctx.warnings || [];
    return {
      text: warns.length === 0 ? 'ไม่พบข้อสังเกตหรือข้อผิดพลาดในข้อมูลตั้งต้นครับ ข้อมูลพร้อมจัดตาราง' : `พบข้อสังเกตจากข้อมูล **${warns.length} รายการ**:`,
      cards: [
        ...(warns.length > 0 ? [{ type: 'list', title: 'ข้อสังเกตจากข้อมูล', items: warns.map((w) => `[${w.level}] ${w.message}`) }] : []),
        { type: 'buttons', items: [{ label: 'เปิดหน้าจัดการข้อมูล', action: { kind: 'navigate', payload: '/data' } }] },
      ],
      suggestions: ['สรุปภาพรวม', 'จัดตารางใหม่'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'explain') {
    const lines = ents.numbers.map((n) => {
      const id = n === 0 ? 'I0' : `C${n}`;
      const info = CONSTRAINTS[id];
      if (!info) return `ไม่พบคำอธิบายสำหรับเงื่อนไขข้อ ${n}`;
      const spKey = SPECIAL_KEY_BY_NO[n];
      const stateStr = spKey ? ` (สถานะปัจจุบัน: **${config.constraints[spKey] ? 'เปิด' : 'ปิด'}**)` : ' (เงื่อนไขพื้นฐาน เปิดเสมอ)';
      return `**${id} — ${info.name}**${stateStr}\n${info.detail}`;
    });
    return { text: lines.join('\n\n'), cards: [], suggestions: ['ผลตรวจเงื่อนไข', 'จัดตารางใหม่'], context: nextCtx, intent };
  }

  if (intent === 'summary') {
    const execCount = [...ctx.teachers.values()].filter((t) => t.role === 'Leader').length;
    const statusText = !hasTT
      ? 'ยังไม่ได้จัดตาราง'
      : validation?.passed
        ? `ผ่านทุกเงื่อนไข (${rows.length} แถว, Seed ${meta?.stats?.seed ?? '-'})`
        : `มีเงื่อนไขไม่ผ่าน (${rows.length} แถว)`;
    return {
      text: `**สรุปภาพรวมระบบ (${config.document?.college || ''})**\n- กลุ่มนักศึกษา: **${ctx.groups.size} กลุ่ม** (จัดตารางจริง ${ctx.activeGroups.length} กลุ่ม, ปี 4 ออกฝึกสอน)\n- อาจารย์ผู้สอน: **${ctx.teachers.size} คน** (ฝ่ายบริหาร ${execCount} คน)\n- ห้องเรียนและสนาม: **${ctx.rooms.size} แห่ง**\n- รายวิชา: **${ctx.subjects.size} วิชา**\n- สถานะตารางล่าสุด: **${statusText}**`,
      cards: [],
      suggestions: ['ผลตรวจเงื่อนไข', 'ภาระสอนของครู', 'การใช้ห้อง'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'solve') {
    const nextConstraints = { ...config.constraints };
    for (const n of ents.on) if (SPECIAL_KEY_BY_NO[n]) nextConstraints[SPECIAL_KEY_BY_NO[n]] = true;
    for (const n of ents.off) if (SPECIAL_KEY_BY_NO[n]) nextConstraints[SPECIAL_KEY_BY_NO[n]] = false;
    const nextSeed = ents.randomSeed ? Math.floor(1 + Math.random() * 99999) : (ents.seed ?? config.params.seed);
    const enabledNos = Object.entries(SPECIAL_KEY_BY_NO)
      .filter(([, k]) => nextConstraints[k])
      .map(([no]) => `C${no}`);
    return {
      text: 'พร้อมเริ่มจัดตารางอัตโนมัติตามค่าด้านล่าง กดยืนยันเพื่อดำเนินการครับ:',
      cards: [
        {
          type: 'action',
          title: 'จัดตารางสอนอัตโนมัติ',
          lines: [
            `Seed: ${nextSeed}${ents.randomSeed ? ' (สุ่มใหม่)' : ''}`,
            `เงื่อนไขพิเศษที่เปิด: ${enabledNos.length ? enabledNos.join(', ') : 'ปิดทั้งหมด'}`,
            `maxBlock: ${config.params.maxBlock} คาบ · เวลาสูงสุด: ${config.params.timeLimitSec} วินาที`,
          ],
          status: 'pending',
          action: { kind: 'solve', payload: { constraints: nextConstraints, seed: nextSeed }, label: 'ยืนยันจัดตาราง' },
        },
      ],
      suggestions: [],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'diagnose') {
    return {
      text: 'ต้องการให้ระบบวิเคราะห์สาเหตุว่าเงื่อนไขใดหรือข้อมูลส่วนใดทำให้จัดตารางไม่ได้ใช่ไหมครับ?',
      cards: [
        {
          type: 'action',
          title: 'วิเคราะห์สาเหตุ (Diagnose)',
          lines: ['ตรวจความจุข้อมูลและทดสอบปิดเงื่อนไขพิเศษทีละข้อ'],
          status: 'pending',
          action: { kind: 'diagnose', payload: {}, label: 'เริ่มวิเคราะห์สาเหตุ' },
        },
      ],
      suggestions: [],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'best_seed') {
    const m = normalizeText(message).match(/(\d+)\s*(?:seed|ครั้ง|รอบ|ตัว)/);
    const count = m ? Math.max(2, Math.min(60, Number(m[1]))) : 20;
    return {
      text: `ต้องการให้ระบบทดลองค้นหา **${count} Seed** เพื่อหาตารางที่ Soft cost ต่ำที่สุดใช่ไหมครับ?`,
      cards: [
        {
          type: 'action',
          title: `ค้นหา Seed ที่ดีที่สุด (${count} Seed)`,
          lines: [`ทดลองจัดตาราง ${count} Seed แล้วเลือกตารางที่คะแนนดีที่สุด`],
          status: 'pending',
          action: { kind: 'best_seed', payload: { count }, label: `เริ่มค้นหา ${count} Seed` },
        },
      ],
      suggestions: [],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'save_seed') {
    if (!hasTT) return needTimetableReply(intent);
    const curSeed = meta?.stats?.seed ?? config.params.seed;
    return {
      text: `ต้องการบันทึก **Seed ${curSeed}** เก็บไว้ในรายการ Seed ที่บันทึกไว้ใช่ไหมครับ?`,
      cards: [
        {
          type: 'action',
          title: `บันทึก Seed ${curSeed}`,
          lines: [`Soft cost: ${meta?.stats?.softCostAfter ?? '-'}`],
          status: 'pending',
          action: { kind: 'save_seed', payload: { seed: curSeed, name: `Seed ${curSeed}` }, label: 'บันทึก Seed' },
        },
      ],
      suggestions: [],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'export') {
    if (!hasTT) return needTimetableReply(intent);
    const norm = normalizeText(message);
    const format = /csv/.test(norm) ? 'csv' : /(excel|xlsx)/.test(norm) ? 'xlsx' : 'pdf';
    const v = target?.view || 'group';
    const id = target?.id || '';
    const label = format === 'pdf' ? 'ดูตัวอย่าง / พิมพ์ PDF' : format === 'xlsx' ? 'ดาวน์โหลด Excel (.xlsx)' : 'ดาวน์โหลด output.csv';
    return {
      text: `เตรียมไฟล์ส่งออกรูปแบบ **${format.toUpperCase()}**${id ? ` สำหรับ **${id}**` : ''} เรียบร้อยครับ`,
      cards: [
        {
          type: 'buttons',
          items: [{ label, action: { kind: 'export', payload: { format, view: v, id } } }],
        },
      ],
      suggestions: ['ไปหน้าส่งออก'],
      context: nextCtx,
      intent,
    };
  }

  // Intents below require a timetable
  if (!hasTT) return needTimetableReply(intent);

  if (intent === 'validation') {
    const val = validation || validate(rows, data, config, ctx);
    if (ents.numbers.length > 0) {
      const blocks = ents.numbers.map((n) => {
        const cid = n === 0 ? 'I0' : `C${n}`;
        const ch = val.checks.find((x) => x.id === cid);
        const info = CONSTRAINTS[cid];
        if (!ch) return `ไม่พบเงื่อนไขข้อ ${n}`;
        if (!ch.enabled) return `**${cid} (${ch.name})**: ปิดใช้งานอยู่`;
        if (ch.passed) return `**${cid} (${ch.name})**: ✅ ผ่านทุกกรณี`;
        return `**${cid} (${ch.name})**: ❌ ไม่ผ่าน (${ch.violationCount} รายการ)\n- สาเหตุที่พบบ่อย: ${info?.why || '-'}\n- แนวทางแก้ไข: ${info?.fix || '-'}\n` +
          ch.violations.slice(0, 10).map((v) => `  • ${v}`).join('\n');
      });
      return { text: blocks.join('\n\n'), cards: [], suggestions: ['ผลตรวจเงื่อนไข', 'จัดตารางใหม่'], context: nextCtx, intent };
    }
    const passedCnt = val.checks.filter((c) => c.passed).length;
    return {
      text: val.passed
        ? `✅ ตารางปัจจุบัน **ผ่านทุกเงื่อนไข (${passedCnt}/${val.checks.length})**`
        : `⚠️ พบเงื่อนไขที่ไม่ผ่านบางรายการ (${passedCnt}/${val.checks.length} ข้อ)`,
      cards: [
        {
          type: 'table',
          title: 'ผลตรวจเงื่อนไขทั้งหมด',
          columns: ['รหัส', 'เงื่อนไข', 'สถานะ'],
          rows: val.checks.map((c) => [
            c.id,
            c.name,
            !c.enabled ? 'ปิด' : c.passed ? 'ผ่าน' : `ไม่ผ่าน (${c.violationCount})`,
          ]),
          link: '/report',
        },
      ],
      suggestions: ['สรุปภาพรวม', 'ภาระสอนของครู'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'schedule') {
    if (!target) {
      return {
        text: 'กรุณาระบุกลุ่มเรียน อาจารย์ หรือห้องเรียนที่ต้องการดูตารางครับ เช่น `ตาราง Y1_1 วันจันทร์`',
        cards: [],
        suggestions: [`ตาราง ${ctx.activeGroups[0]?.group_id || 'Y1_1'} วันจันทร์`],
        context: nextCtx,
        intent,
      };
    }
    const grid = buildGrid(target.view, target.id, rows, ctx);
    const tblRows = [];
    grid.days.forEach((d, di) => {
      if (ents.days.length > 0 && !ents.days.includes(d.key)) return;
      for (const sp of grid.cells[di]) {
        if (ents.periods.length > 0 && !ents.periods.some((p) => p >= sp.start && p < sp.start + sp.span)) continue;
        const pLabel = sp.span > 1 ? `${sp.start}-${sp.start + sp.span - 1}` : String(sp.start);
        const who = target.view === 'group' ? sp.teacher : target.view === 'teacher' ? sp.group_labels.join('+') : `${sp.group_labels.join('+')} · ${sp.teacher}`;
        tblRows.push([d.label, pLabel, `${sp.subject_id} ${sp.subject_name}`, who, sp.room_name]);
      }
    });
    const whoCol = target.view === 'group' ? 'ผู้สอน' : target.view === 'teacher' ? 'กลุ่มเรียน' : 'กลุ่ม·ผู้สอน';
    return {
      text: tblRows.length
        ? `ตารางของ **${target.id}** (${tblRows.length} ช่วงคาบ):`
        : `ไม่พบคาบเรียนของ **${target.id}** ในช่วงเวลาที่ระบุครับ`,
      cards: tblRows.length
        ? [{ type: 'table', title: `ตาราง ${target.id}`, columns: ['วัน', 'คาบ', 'วิชา', whoCol, 'ห้อง/สนาม'], rows: tblRows, link: `/timetable?view=${target.view}&id=${encodeURIComponent(target.id)}` }]
        : [],
      suggestions: ['แล้ววันพุธล่ะ ว่างคาบไหน', 'ส่งออก PDF'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'free') {
    if (!target) {
      return { text: 'กรุณาระบุกลุ่มเรียน อาจารย์ หรือห้องที่ต้องการเช็กคาบว่างครับ', cards: [], suggestions: ['ห้องไหนว่าง วันพุธ คาบ 3'], context: nextCtx, intent };
    }
    const grid = buildGrid(target.view, target.id, rows, ctx);
    const lines = [];
    grid.days.forEach((d, di) => {
      if (ents.days.length > 0 && !ents.days.includes(d.key)) return;
      const busy = new Set();
      for (const sp of grid.cells[di]) {
        for (let p = sp.start; p < sp.start + sp.span; p++) busy.add(p);
      }
      const freePeriods = ctx.daySlots[di]
        .map((sid) => ctx.slotsById.get(sid).period)
        .filter((p) => !busy.has(p));
      lines.push(`- **วัน${d.label}**: คาบ ${compressPeriods(freePeriods)}`);
    });
    return {
      text: `คาบว่างของ **${target.id}** (ไม่รวมคาบพักเที่ยง 5 และพุธ คาบ 8–9):\n` + lines.join('\n'),
      cards: [],
      suggestions: [`ตาราง ${target.id}`],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'free_resources') {
    const norm = normalizeText(message);
    const askTeacher = /(ครู|อาจารย์|ใคร)/.test(norm);
    const dayKey = ents.days[0] || ctx.days[0];
    const period = ents.periods[0] || 1;
    if (period === ctx.params.breakPeriod) {
      return { text: `คาบที่ ${period} เป็น **คาบพักเที่ยง** ทุกกลุ่มและทุกห้องว่างครับ`, cards: [], suggestions: [], context: nextCtx, intent };
    }
    const dayIdx = ctx.days.indexOf(dayKey);
    const slotId = ctx.slotByDayPeriod.get(`${dayIdx}|${period}`);
    const slotRows = rows.filter((r) => r.timeslot_id === slotId);

    if (askTeacher) {
      const busyT = new Set();
      for (const r of slotRows) for (const tid of splitIds(r.teacher_id)) busyT.add(tid);
      const freeT = [...ctx.teachers.values()].filter(
        (t) => !busyT.has(t.teacher_id) && !(ctx.isExecTeacher(t.teacher_id) && ctx.isExecBlockedSlot(slotId))
      );
      return {
        text: `อาจารย์ที่ว่าง **วัน${DAY_TH[dayKey] || dayKey} คาบ ${period}** มี **${freeT.length} คน**:`,
        cards: [{ type: 'list', title: 'อาจารย์ที่ว่าง', items: freeT.map((t) => `${t.teacher_id} ${t.teacher_name}`) }],
        suggestions: [],
        context: nextCtx,
        intent,
      };
    }

    const busyR = new Set();
    for (const r of slotRows) for (const rid of splitIds(r.room_id)) busyR.add(rid);
    const freeR = [...ctx.rooms.values()].filter((r) => !busyR.has(r.room_id));
    return {
      text: `ห้องเรียนและสนามที่ว่าง **วัน${DAY_TH[dayKey] || dayKey} คาบ ${period}** มี **${freeR.length} แห่ง**:`,
      cards: [{ type: 'list', title: 'ห้อง/สนามที่ว่าง', items: freeR.slice(0, 20).map((r) => `${r.room_id} ${r.room_name} (${r.room_type})`) }],
      suggestions: [],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'at_time') {
    const dayKey = ents.days[0];
    const period = ents.periods[0];
    const dayIdx = ctx.days.indexOf(dayKey);
    const slotId = ctx.slotByDayPeriod.get(`${dayIdx}|${period}`);
    const slotRows = rows.filter((r) => r.timeslot_id === slotId);
    return {
      text: slotRows.length
        ? `ตารางเรียน **วัน${DAY_TH[dayKey] || dayKey} คาบ ${period}** (${slotRows.length} รายการ):`
        : `ไม่มีการเรียนการสอนใน **วัน${DAY_TH[dayKey] || dayKey} คาบ ${period}** ครับ`,
      cards: slotRows.length
        ? [{
            type: 'table',
            title: `วัน${DAY_TH[dayKey]} คาบ ${period}`,
            columns: ['กลุ่ม', 'วิชา', 'ผู้สอน', 'ห้อง/สนาม'],
            rows: slotRows.map((r) => [groupLabel(r.group_id, ctx), r.subject_id, teacherNames(r.teacher_id, ctx), roomNames(r.room_id, ctx)]),
          }]
        : [],
      suggestions: [],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'subject') {
    const sid = ents.subjects[0];
    const sub = ctx.subjects.get(sid);
    const rel = rows.filter((r) => r.subject_id === sid);
    const teachers = (ctx.teachersBySubject.get(sid) || []).map((tid) => ctx.teachers.get(tid)?.teacher_name || tid);
    return {
      text: `**${sid} ${subjectName(sid, ctx)}**\n- ชั่วโมงเรียน: **${ctx.hours(sid)} คาบ/สัปดาห์** (${sub?.credit_raw || '-'})\n- กลุ่มวิชา: ${sub?.group_type || '-'}\n- ผู้สอน: ${teachers.join(' / ') || '-'}`,
      cards: rel.length
        ? [{
            type: 'table',
            title: 'ตารางสอนของรายวิชานี้',
            columns: ['กลุ่ม', 'วัน/คาบ', 'ห้อง/สนาม'],
            rows: rel.slice(0, 20).map((r) => {
              const s = ctx.slotsById.get(r.timeslot_id);
              return [groupLabel(r.group_id, ctx), s ? `${DAY_TH[s.day]} คาบ ${s.period}` : r.timeslot_id, roomNames(r.room_id, ctx)];
            }),
          }]
        : [],
      suggestions: [],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'load') {
    const st = timetableStats(rows, ctx);
    if (ents.teachers.length > 0) {
      const t = st.teacherLoad.find((x) => x.id === ents.teachers[0]);
      if (t) {
        return {
          text: `**${t.name} (${t.id})** มีภาระสอนทั้งหมด **${t.periods} คาบ/สัปดาห์**\n` +
            st.days.map((d, i) => `- วัน${d.label}: ${t.perDay[i]} คาบ`).join('\n'),
          cards: [],
          suggestions: [`ตาราง ${t.id}`],
          context: nextCtx,
          intent,
        };
      }
    }
    return {
      text: `สรุปภาระสอนของอาจารย์ทั้งหมด **${st.teacherLoad.length} คน**:`,
      cards: [{
        type: 'table',
        title: 'ภาระสอนของอาจารย์ (เรียงจากมากไปน้อย)',
        columns: ['รหัส', 'ชื่ออาจารย์', 'คาบ/สัปดาห์'],
        rows: st.teacherLoad.map((t) => [t.id, t.name, String(t.periods)]),
      }],
      suggestions: ['การใช้ห้อง', 'ผลตรวจเงื่อนไข'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'room_usage') {
    const st = timetableStats(rows, ctx);
    const unused = st.roomUsage.filter((r) => r.periods === 0).length;
    return {
      text: `สรุปอัตราการใช้ห้องเรียนและสนาม (ไม่ได้ใช้งาน ${unused} แห่ง):`,
      cards: [{
        type: 'table',
        title: 'การใช้ห้องเรียน/สนาม',
        columns: ['รหัส', 'ชื่อสถานที่', 'คาบ', '%'],
        rows: st.roomUsage.slice(0, 15).map((r) => [r.id, r.name, String(r.periods), `${r.pct}%`]),
      }],
      suggestions: ['ห้องไหนว่าง วันพุธ คาบ 3'],
      context: nextCtx,
      intent,
    };
  }

  if (intent === 'move') {
    const gid = ents.groups[0] || (target?.view === 'group' ? target.id : null);
    const sid = ents.subjects[0];
    if (!gid || !sid || !ents.target) {
      return {
        text: 'กรุณาระบุวิชา กลุ่มเรียน และวัน/คาบปลายทางให้ครบครับ เช่น `ย้าย มศ 041017 ของ Y1_1 ไปพุธ คาบ 1`',
        cards: [],
        suggestions: [],
        context: nextCtx,
        intent,
      };
    }
    const grid = buildGrid('group', gid, rows, ctx);
    let foundSpan = null;
    let foundDay = null;
    grid.days.forEach((d, di) => {
      for (const sp of grid.cells[di]) {
        if (sp.subject_id === sid && !foundSpan) {
          foundSpan = sp;
          foundDay = d.key;
        }
      }
    });
    if (!foundSpan) {
      return { text: `ไม่พบวิชา **${sid}** ในตารางของกลุ่ม **${gid}** ครับ`, cards: [], suggestions: [], context: nextCtx, intent };
    }
    const toDay = ents.target.day || foundDay;
    const toPeriod = ents.target.period;
    try {
      const nextRows = moveSpan(rows, ctx, {
        view: 'group',
        id: gid,
        fromDay: foundDay,
        fromPeriod: foundSpan.start,
        length: foundSpan.span,
        toDay,
        toPeriod,
      });
      const vAfter = validate(nextRows, data, config, ctx);
      const failAfter = vAfter.checks.filter((c) => c.enabled && !c.passed).length;
      const danger = failAfter > 0;
      return {
        text: danger
          ? `⚠️ การย้าย **${sid}** ของ **${gid}** ไปวัน${DAY_TH[toDay]} คาบ ${toPeriod} จะทำให้มีเงื่อนไขไม่ผ่าน ${failAfter} ข้อ`
          : `✅ สามารถย้าย **${sid}** ของ **${gid}** ไปวัน${DAY_TH[toDay]} คาบ ${toPeriod} ได้โดยไม่ผิดเงื่อนไข`,
        cards: [{
          type: 'action',
          title: `ย้ายคาบ ${sid} (${gid})`,
          lines: [
            `จาก: วัน${DAY_TH[foundDay]} คาบ ${foundSpan.start} (${foundSpan.span} คาบ)`,
            `ไปที่: วัน${DAY_TH[toDay]} คาบ ${toPeriod}`,
          ],
          status: 'pending',
          action: {
            kind: 'move',
            payload: { view: 'group', id: gid, fromDay: foundDay, fromPeriod: foundSpan.start, length: foundSpan.span, toDay, toPeriod },
            label: danger ? 'ย้ายทั้งที่ไม่ผ่าน' : 'ยืนยันย้ายคาบ',
            danger,
          },
        }],
        suggestions: [],
        context: nextCtx,
        intent,
      };
    } catch (err) {
      return { text: `ไม่สามารถย้ายได้: ${err.message}`, cards: [], suggestions: [], context: nextCtx, intent };
    }
  }

  if (intent === 'find_slot') {
    const gid = ents.groups[0] || (target?.view === 'group' ? target.id : null);
    const sid = ents.subjects[0];
    if (!gid || !sid) {
      return { text: 'กรุณาระบุวิชาและกลุ่มเรียนที่ต้องการหาช่องว่างครับ', cards: [], suggestions: [], context: nextCtx, intent };
    }
    const grid = buildGrid('group', gid, rows, ctx);
    let foundSpan = null;
    let foundDay = null;
    grid.days.forEach((d, di) => {
      for (const sp of grid.cells[di]) {
        if (sp.subject_id === sid && !foundSpan) {
          foundSpan = sp;
          foundDay = d.key;
        }
      }
    });
    if (!foundSpan) return { text: `ไม่พบวิชา ${sid} ในตารางของกลุ่ม ${gid}`, cards: [], suggestions: [], context: nextCtx, intent };
    const opts = validMoveTargets(rows, data, config, ctx, {
      view: 'group',
      id: gid,
      fromDay: foundDay,
      fromPeriod: foundSpan.start,
      length: foundSpan.span,
    }).slice(0, 8);
    return {
      text: opts.length ? `พบช่องที่สามารถย้าย **${sid}** ของ **${gid}** ได้ **${opts.length} ช่อง**:` : 'ไม่พบช่องว่างที่ย้ายได้โดยไม่ละเมิดเงื่อนไขครับ',
      cards: opts.length
        ? [{
            type: 'buttons',
            items: opts.map((o) => ({
              label: `วัน${o.dayLabel} คาบ ${o.period}${o.isSwap ? ' (สลับ)' : ''}`,
              action: { kind: 'ask', payload: `ย้าย ${sid} ของ ${gid} ไป${o.dayLabel} คาบ ${o.period}` },
            })),
          }]
        : [],
      suggestions: [],
      context: nextCtx,
      intent,
    };
  }

  return {
    text: `ขอโทษครับ ผมยังไม่เข้าใจ "${message}" ลองพิมพ์ **ทำอะไรได้บ้าง** เพื่อดูตัวอย่างคำสั่งครับ`,
    cards: [],
    suggestions: ['ทำอะไรได้บ้าง', 'สรุปภาพรวม', 'ผลตรวจเงื่อนไข'],
    context: nextCtx,
    intent: 'unknown',
  };
}
