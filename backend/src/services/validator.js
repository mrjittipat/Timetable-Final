import { buildContext, splitIds, SPECIAL_SUBJECTS, THEORY_GROUP_TYPES } from './context.js';

function slotLabel(ctx, slotId) {
  const s = ctx.slotsById.get(slotId);
  return s ? `${s.day} คาบ ${s.period}` : slotId;
}

function makeCheck(id, no, name, type, enabled, violations) {
  return {
    id,
    no,
    name,
    type,
    enabled,
    passed: !enabled || violations.length === 0,
    violationCount: enabled ? violations.length : 0,
    violations: enabled ? violations.slice(0, 50) : [],
  };
}

export function validate(rows, data, config, ctx = buildContext(data, config)) {
  const list = Array.isArray(rows) ? rows : [];
  const c = ctx.constraints;
  const p = ctx.params;

  const vI0 = [];  // Integrity + no group/teacher/room clash + capacity
  const vC1 = [];  // Rule 1 (1.2): คาบ 5 ทุกวันเป็นพักเที่ยง ห้ามจัดเรียน
  const vC2 = [];  // Rule 2 (1.2): วันพุธคาบ 8 พบอาจารย์ที่ปรึกษา คาบ 9 กิจกรรม
  const vC3 = [];  // Rule 3 (1.3): ผู้บริหาร 7 คนห้ามสอนวันอังคารคาบ 1–4
  const vC4 = [];  // Rule 4 (ส่วนที่ 4): จำนวนคาบของวิชา = ชั่วโมงบรรยาย + ชั่วโมงปฏิบัติ
  const vC5 = [];  // Rule 5 (เงื่อนไขข้อ 1): วิชาภาษา/สังคม/วิชาชีพครู/บังคับ/คณิต/วิทย์ เรียนห้องทฤษฎี
  const vC6 = [];  // Rule 6 (เงื่อนไขข้อ 2): วิชานวัตกรรมและเทคโนโลยีเรียนห้องคอม
  const vC7 = [];  // Rule 7 (เงื่อนไขข้อ 3): วิชาที่มีครู 2 คน ครูทั้งคู่ต้องสอนพร้อมกัน
  const vC8 = [];  // Rule 8 (เงื่อนไขข้อ 4): วิชากีฬาต้องจองห้องทฤษฎีกับสนามพร้อมกัน
  const vC9 = [];  // Rule 9 (เงื่อนไขข้อ 5): วิชาเลือกกีฬาในชุดเดียวกันต้องเรียนเวลาเดียวกัน
  const vC10 = []; // Rule 10 (เงื่อนไขข้อ 6): ปี 4 ไม่ต้องจัดตาราง

  const groupSlotMap = new Map();
  const teacherSlotMap = new Map();
  const roomSlotMap = new Map();
  const countByGroupSub = new Map();
  const slotsByElectiveSub = new Map();
  const wedFixedFound = new Set();

  for (const row of list) {
    const { group_id: g, timeslot_id: ts, subject_id: subId, teacher_id: tRaw, room_id: rRaw } = row;
    const isSpecialSub = Boolean(SPECIAL_SUBJECTS[subId]);
    const isCohort = ctx.electiveSets.has(g);

    // I0: structural integrity
    if (!isCohort && !ctx.groups.has(g)) vI0.push(`ไม่พบกลุ่มเรียน ${g}`);
    if (!ctx.slotsById.has(ts)) vI0.push(`ไม่พบคาบเรียน ${ts}`);
    if (!isSpecialSub && !ctx.subjects.has(subId)) vI0.push(`ไม่พบรายวิชา ${subId}`);

    const tIds = splitIds(tRaw);
    const rIds = splitIds(rRaw);
    if (!isSpecialSub) {
      if (tIds.length === 0) vI0.push(`แถว ${g}/${subId} (${slotLabel(ctx, ts)}) ไม่มีรหัสอาจารย์`);
      for (const tid of tIds) {
        if (!ctx.teachers.has(tid)) vI0.push(`ไม่พบอาจารย์ ${tid} ในวิชา ${subId}`);
      }
    }
    if (rIds.length === 0) {
      vI0.push(`แถว ${g}/${subId} (${slotLabel(ctx, ts)}) ไม่มีรหัสห้อง/สนาม`);
    }
    for (const rid of rIds) {
      if (!ctx.rooms.has(rid)) vI0.push(`ไม่พบห้อง/สนาม ${rid} ในวิชา ${subId}`);
    }

    const slot = ctx.slotsById.get(ts);
    const sub = ctx.subjects.get(subId);

    // C1: คาบ 5 ทุกวันเป็นพักเที่ยง ห้ามจัดเรียน
    if (slot && slot.period === p.breakPeriod) {
      vC1.push(`กลุ่ม ${g} วิชา ${subId} ถูกจัดลงคาบพักเที่ยง (${slotLabel(ctx, ts)})`);
    }

    // C2: วันพุธคาบ 8 พบอาจารย์ที่ปรึกษา คาบ 9 กิจกรรม
    if (subId === 'ADVISOR' || subId === 'ACTIVITY') {
      wedFixedFound.add(`${g}|${subId}`);
      if (slot) {
        const wf = p.wedFixed || { day: 'Wed', advisorPeriod: 8, activityPeriod: 9 };
        const expectedPeriod = subId === 'ADVISOR' ? wf.advisorPeriod : wf.activityPeriod;
        if (slot.day !== wf.day || slot.period !== expectedPeriod) {
          vC2.push(`${SPECIAL_SUBJECTS[subId]} ของกลุ่ม ${g} อยู่ที่ ${slotLabel(ctx, ts)} แทนที่จะเป็น ${wf.day} คาบ ${expectedPeriod}`);
        }
      }
      continue;
    }

    if (slot && ctx.isWedFixedSlot(slot)) {
      vC2.push(`กลุ่ม ${g} วิชา ${subId} ทับคาบพบอาจารย์ที่ปรึกษา/กิจกรรม (${slotLabel(ctx, ts)})`);
    }

    // C10: ปี 4 ไม่ต้องจัดตาราง
    if (c.r10_year4NoSchedule && ctx.groups.get(g)?.year === 4) {
      vC10.push(`ชั้นปีที่ 4 (${g}) ไม่ต้องจัดตารางเรียน แต่พบวิชา ${subId} ที่ ${slotLabel(ctx, ts)}`);
    }

    // Group slot occupancy
    const affectedGroups = isCohort
      ? (c.r9_electiveSync ? ctx.electiveSets.get(g).groups : [])
      : [g];
    for (const ag of affectedGroups) {
      const gk = `${ag}|${ts}`;
      if (!groupSlotMap.has(gk)) groupSlotMap.set(gk, []);
      groupSlotMap.get(gk).push(row);
    }

    // Count per registration (for C4)
    const rk = `${g}|${subId}`;
    countByGroupSub.set(rk, (countByGroupSub.get(rk) || 0) + 1);

    if (sub?.special_mode === 'elective') {
      if (!slotsByElectiveSub.has(subId)) slotsByElectiveSub.set(subId, new Set());
      slotsByElectiveSub.get(subId).add(ts);
    }

    const sessionKey = `${subId}|${tIds.join('+')}|${rIds.join('+')}`;
    for (const tid of tIds) {
      const tk = `${tid}|${ts}`;
      if (!teacherSlotMap.has(tk)) teacherSlotMap.set(tk, new Map());
      const sm = teacherSlotMap.get(tk);
      if (!sm.has(sessionKey)) sm.set(sessionKey, []);
      sm.get(sessionKey).push(row);

      // C3: ผู้บริหาร 7 คนห้ามสอนวันอังคารคาบ 1–4
      if (ctx.isExecTeacher(tid) && ctx.isExecBlockedSlot(ts)) {
        const tName = ctx.teachers.get(tid)?.teacher_name || tid;
        vC3.push(`ผู้บริหาร ${tName} (${tid}) ถูกจัดสอนวิชา ${subId} ในเวลาประชุม (${slotLabel(ctx, ts)})`);
      }
    }

    for (const rid of rIds) {
      const rmk = `${rid}|${ts}`;
      if (!roomSlotMap.has(rmk)) roomSlotMap.set(rmk, new Map());
      const sm = roomSlotMap.get(rmk);
      if (!sm.has(sessionKey)) sm.set(sessionKey, []);
      sm.get(sessionKey).push(row);
    }

    if (sub) {
      // Teacher qualification & C7 (co-teaching)
      const expectedTeachers = ctx.teachersBySubject.get(subId) || [];
      for (const tid of tIds) {
        if (!expectedTeachers.includes(tid)) {
          vI0.push(`อาจารย์ ${tid} ไม่ได้ถูกกำหนดให้สอนวิชา ${subId} (${slotLabel(ctx, ts)})`);
        }
      }
      if (c.r7_coTeach && expectedTeachers.length > 1) {
        const missingT = expectedTeachers.filter((tid) => !tIds.includes(tid));
        if (missingT.length > 0) {
          vC7.push(`วิชาสอนร่วม ${subId} กลุ่ม ${g} (${slotLabel(ctx, ts)}) ขาดผู้สอนร่วม: ${missingT.join(', ')}`);
        }
      }

      // Capacity check (part of I0)
      let neededSeats = 0;
      if (sub.special_mode === 'elective') neededSeats = 20;
      else if (sub.special_mode === 'combined_year') {
        neededSeats = ctx.activeGroups
          .filter((ag) => ag.year === sub.year)
          .reduce((sum, ag) => sum + ag.student_count, 0);
      } else {
        neededSeats = ctx.groups.get(g)?.student_count || 0;
      }
      for (const rid of rIds) {
        const rm = ctx.rooms.get(rid);
        if (rm && rm.capacity > 0 && neededSeats > rm.capacity) {
          vI0.push(`ห้อง ${rm.room_name} (${rid}) จุ ${rm.capacity} คน ไม่พอสำหรับ ${g} วิชา ${subId} (${neededSeats} คน)`);
        }
      }

      const primaryRoomId = rIds[0];
      const primaryRoom = ctx.rooms.get(primaryRoomId);

      // C5: วิชาภาษา/สังคม/วิชาชีพครู/บังคับ/คณิต/วิทย์ เรียนห้องทฤษฎี
      if (c.r5_theoryRoom && THEORY_GROUP_TYPES.has(sub.group_type)) {
        if (!primaryRoom || (primaryRoom.room_type !== 'Theory' && primaryRoom.room_type !== 'LectureHall')) {
          vC5.push(`วิชา ${subId} (${sub.group_type}) กลุ่ม ${g} ใช้ห้อง ${primaryRoomId} แทนห้องเรียนทฤษฎี`);
        }
      }

      // C6: วิชานวัตกรรมและเทคโนโลยีเรียนห้องคอม
      if (c.r6_computerLab && sub.group_type === 'นวัตกรรมและเทคโนโลยี') {
        if (!primaryRoom || primaryRoom.room_type !== 'ComputerLab') {
          vC6.push(`วิชา ${subId} (นวัตกรรมและเทคโนโลยี) กลุ่ม ${g} ใช้ห้อง ${primaryRoomId} แทนห้องคอมพิวเตอร์`);
        }
      }

      // C8: วิชากีฬาต้องจองห้องทฤษฎีกับสนามพร้อมกัน
      if (c.r8_sportDualRoom && (sub.group_type === 'ทักษะและการสอนกีฬา' || sub.special_mode === 'elective')) {
        const expectedSport = ctx.sportRoomFor(subId);
        if (expectedSport && !rIds.includes(expectedSport)) {
          vC8.push(`วิชากีฬา ${subId} กลุ่ม ${g} (${slotLabel(ctx, ts)}) ไม่ได้จองสนาม ${expectedSport}`);
        }
        const hasTheory = rIds.some((rid) => {
          const rt = ctx.rooms.get(rid)?.room_type;
          return rt === 'Theory' || rt === 'LectureHall';
        });
        if (!hasTheory) {
          vC8.push(`วิชากีฬา ${subId} กลุ่ม ${g} (${slotLabel(ctx, ts)}) ไม่ได้จองห้องเรียนทฤษฎีควบคู่กับสนาม`);
        }
      }
    }
  }

  // C4: จำนวนคาบของวิชา = ชั่วโมงบรรยาย + ชั่วโมงปฏิบัติ
  for (const reg of ctx.registrations) {
    const sub = ctx.subjects.get(reg.subject_id);
    if (!sub || sub.special_mode === 'practicum_y4') continue;
    const req = ctx.hours(reg.subject_id);
    const got = countByGroupSub.get(`${reg.group_id}|${reg.subject_id}`) || 0;
    if (got !== req) {
      vC4.push(`กลุ่ม ${reg.group_id} วิชา ${reg.subject_id} จัดได้ ${got} คาบ (ต้องเป็น ${req} คาบ)`);
    }
  }

  // I0: Group clashes
  for (const [gk, gRows] of groupSlotMap.entries()) {
    const [g, ts] = gk.split('|');
    const nonCohort = gRows.filter((r) => !ctx.electiveSets.has(r.group_id));
    const cohorts = new Set(gRows.filter((r) => ctx.electiveSets.has(r.group_id)).map((r) => r.group_id));
    if (nonCohort.length > 1 || (nonCohort.length >= 1 && cohorts.size >= 1) || cohorts.size > 1) {
      const subs = [...new Set(gRows.map((r) => r.subject_id))].join(', ');
      vI0.push(`กลุ่ม ${g} เรียนซ้อนกันที่ ${slotLabel(ctx, ts)}: ${subs}`);
    }
  }

  // I0: Teacher clashes
  for (const [tk, sm] of teacherSlotMap.entries()) {
    const [tid, ts] = tk.split('|');
    if (sm.size > 1) {
      const subs = [...sm.keys()].map((k) => k.split('|')[0]).join(' / ');
      vI0.push(`อาจารย์ ${tid} สอนซ้อนกันที่ ${slotLabel(ctx, ts)}: ${subs}`);
    } else {
      const onlyRows = [...sm.values()][0];
      if (onlyRows.length > 1) {
        const sub = ctx.subjects.get(onlyRows[0].subject_id);
        if (!sub || sub.special_mode !== 'combined_year') {
          vI0.push(`อาจารย์ ${tid} สอนหลายกลุ่มพร้อมกันที่ ${slotLabel(ctx, ts)} ในวิชา ${onlyRows[0].subject_id}`);
        }
      }
    }
  }

  // I0: Room/facility clashes
  for (const [rmk, sm] of roomSlotMap.entries()) {
    const [rid, ts] = rmk.split('|');
    if (sm.size > 1) {
      const subs = [...sm.keys()].map((k) => k.split('|')[0]).join(' / ');
      vI0.push(`ห้อง/สนาม ${rid} ใช้งานซ้อนกันที่ ${slotLabel(ctx, ts)}: ${subs}`);
    } else {
      const onlyRows = [...sm.values()][0];
      if (onlyRows.length > 1) {
        const sub = ctx.subjects.get(onlyRows[0].subject_id);
        if (!sub || sub.special_mode !== 'combined_year') {
          vI0.push(`ห้อง/สนาม ${rid} ใช้ซ้อนหลายกลุ่มที่ ${slotLabel(ctx, ts)} ในวิชา ${onlyRows[0].subject_id}`);
        }
      }
    }
  }

  // C2: every active group must have Wed P8 ADVISOR & Wed P9 ACTIVITY
  for (const g of ctx.activeGroups) {
    if (!wedFixedFound.has(`${g.group_id}|ADVISOR`)) {
      vC2.push(`กลุ่ม ${g.group_id} ไม่มีคาบพบอาจารย์ที่ปรึกษา (พุธ คาบ 8)`);
    }
    if (!wedFixedFound.has(`${g.group_id}|ACTIVITY`)) {
      vC2.push(`กลุ่ม ${g.group_id} ไม่มีคาบกิจกรรม (พุธ คาบ 9)`);
    }
  }

  // C9: วิชาเลือกกีฬาในชุดเดียวกันต้องเรียนเวลาเดียวกัน
  if (c.r9_electiveSync) {
    for (const [setId, es] of ctx.electiveSets.entries()) {
      if (es.subjects.length === 0) continue;
      const firstSub = es.subjects[0];
      const baseSlots = [...(slotsByElectiveSub.get(firstSub) || [])].sort().join(',');
      for (const sid of es.subjects.slice(1)) {
        const curSlots = [...(slotsByElectiveSub.get(sid) || [])].sort().join(',');
        if (curSlots !== baseSlots) {
          vC9.push(`ชุดวิชาเลือก ${es.name} (${setId}): วิชา ${sid} จัดคนละเวลากับวิชา ${firstSub}`);
        }
      }
    }
  }

  const checks = [
    makeCheck('I0', 0, 'โครงสร้างข้อมูลถูกต้องและไม่ชนกัน (กลุ่ม / อาจารย์ / ห้อง / ความจุ)', 'integrity', true, vI0),
    makeCheck('C1', 1, 'คาบ 5 ทุกวันเป็นพักเที่ยง ห้ามจัดเรียน (ข้อ 1.2)', 'basic', true, vC1),
    makeCheck('C2', 2, 'วันพุธคาบ 8 พบอาจารย์ที่ปรึกษา คาบ 9 กิจกรรม (ข้อ 1.2)', 'basic', true, vC2),
    makeCheck('C3', 3, 'ผู้บริหาร 7 คนห้ามสอนวันอังคารคาบ 1–4 (ข้อ 1.3)', 'basic', true, vC3),
    makeCheck('C4', 4, 'จำนวนคาบของวิชา = ชั่วโมงบรรยาย + ชั่วโมงปฏิบัติ (ส่วนที่ 4)', 'basic', true, vC4),
    makeCheck('C5', 5, 'วิชาภาษา/สังคม/วิชาชีพครู/บังคับ/คณิต/วิทย์ เรียนห้องทฤษฎี (เงื่อนไขข้อ 1)', 'special', !!c.r5_theoryRoom, vC5),
    makeCheck('C6', 6, 'วิชานวัตกรรมและเทคโนโลยีเรียนห้องคอม (เงื่อนไขข้อ 2)', 'special', !!c.r6_computerLab, vC6),
    makeCheck('C7', 7, 'วิชาที่มีครู 2 คน ครูทั้งคู่ต้องสอนพร้อมกัน (เงื่อนไขข้อ 3)', 'special', !!c.r7_coTeach, vC7),
    makeCheck('C8', 8, 'วิชากีฬาต้องจองห้องทฤษฎีกับสนามพร้อมกัน (เงื่อนไขข้อ 4)', 'special', !!c.r8_sportDualRoom, vC8),
    makeCheck('C9', 9, 'วิชาเลือกกีฬาในชุดเดียวกันต้องเรียนเวลาเดียวกัน (เงื่อนไขข้อ 5)', 'special', !!c.r9_electiveSync, vC9),
    makeCheck('C10', 10, 'ปี 4 ไม่ต้องจัดตาราง (เงื่อนไขข้อ 6)', 'special', !!c.r10_year4NoSchedule, vC10),
  ];

  const passed = checks.every((ch) => ch.passed);
  return {
    passed,
    checks,
    stats: {
      rows: list.length,
      groups: ctx.activeGroups.length,
    },
  };
}
