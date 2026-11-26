import { buildContext, splitIds, SPECIAL_SUBJECTS } from './context.js';

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

  const vI0 = [];
  const vC1 = [];
  const vC2 = [];
  const vC3 = [];
  const vC4 = [];
  const vC5 = [];
  const vC6 = [];
  const vC7 = [];
  const vC8 = [];
  const vC9 = [];
  const vC10 = [];
  const vC11 = [];
  const vC12 = [];
  const vC13 = [];

  // Pre-group structures
  const groupSlotMap = new Map(); // group|slot -> rows[]
  const teacherSlotMap = new Map(); // teacher|slot -> Map(key -> rows[])
  const roomSlotMap = new Map(); // room|slot -> Map(key -> rows[])
  const countByGroupSub = new Map(); // group|sub -> count
  const slotsByElectiveSub = new Map(); // sub -> Set(slotId)
  const slotsByCombinedSub = new Map(); // sub -> Map(group -> Set(slotId))
  const wedFixedFound = new Set(); // group|ADVISOR or group|ACTIVITY

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

    // C2: break period
    if (slot && slot.period === p.breakPeriod) {
      vC2.push(`กลุ่ม ${g} วิชา ${subId} ถูกจัดลงคาบพักเที่ยง (${slotLabel(ctx, ts)})`);
    }

    // Track Wed fixed
    if (subId === 'ADVISOR' || subId === 'ACTIVITY') {
      wedFixedFound.add(`${g}|${subId}`);
      if (c.c9_wedFixed && slot) {
        const wf = p.wedFixed || { day: 'Wed', advisorPeriod: 8, activityPeriod: 9 };
        const expectedPeriod = subId === 'ADVISOR' ? wf.advisorPeriod : wf.activityPeriod;
        if (slot.day !== wf.day || slot.period !== expectedPeriod) {
          vC9.push(`${SPECIAL_SUBJECTS[subId]} ของกลุ่ม ${g} อยู่ที่ ${slotLabel(ctx, ts)} แทนที่จะเป็น ${wf.day} คาบ ${expectedPeriod}`);
        }
      }
      continue;
    }

    // Check Year 4 has no timetable
    if (ctx.groups.get(g)?.year === 4) {
      vC3.push(`ชั้นปีที่ 4 (${g}) ห้ามจัดตารางเรียน แต่พบวิชา ${subId} ที่ ${slotLabel(ctx, ts)}`);
    }

    // Check non-fixed classes in Wed P8-P9 when C9 enabled
    if (c.c9_wedFixed && slot && ctx.isWedFixedSlot(slot)) {
      vC9.push(`กลุ่ม ${g} วิชา ${subId} ทับคาบพบอาจารย์ที่ปรึกษา/กิจกรรม (${slotLabel(ctx, ts)})`);
    }

    // Track group-slot occupancy (when C12 is ON, cohorts expand to all groups of that year)
    const affectedGroups = isCohort
      ? (c.c12_electiveSync ? ctx.electiveSets.get(g).groups : [])
      : [g];
    for (const ag of affectedGroups) {
      const gk = `${ag}|${ts}`;
      if (!groupSlotMap.has(gk)) groupSlotMap.set(gk, []);
      groupSlotMap.get(gk).push(row);
    }

    // Count per registration
    const rk = `${g}|${subId}`;
    countByGroupSub.set(rk, (countByGroupSub.get(rk) || 0) + 1);

    // Combined-year tracking
    if (sub?.special_mode === 'combined_year') {
      if (!slotsByCombinedSub.has(subId)) slotsByCombinedSub.set(subId, new Map());
      const gm = slotsByCombinedSub.get(subId);
      if (!gm.has(g)) gm.set(g, new Set());
      gm.get(g).add(ts);
    }

    // Elective tracking
    if (sub?.special_mode === 'elective') {
      if (!slotsByElectiveSub.has(subId)) slotsByElectiveSub.set(subId, new Set());
      slotsByElectiveSub.get(subId).add(ts);
    }

    // Teacher-slot map (combined_year shares same subject+room+teachers across year groups)
    const sessionKey = `${subId}|${tIds.join('+')}|${rIds.join('+')}`;
    for (const tid of tIds) {
      const tk = `${tid}|${ts}`;
      if (!teacherSlotMap.has(tk)) teacherSlotMap.set(tk, new Map());
      const sm = teacherSlotMap.get(tk);
      if (!sm.has(sessionKey)) sm.set(sessionKey, []);
      sm.get(sessionKey).push(row);

      // C8: executive meeting Tue P1-4
      if (c.c8_execMeeting && ctx.isExecTeacher(tid) && ctx.isExecBlockedSlot(ts)) {
        const tName = ctx.teachers.get(tid)?.teacher_name || tid;
        vC8.push(`ผู้บริหาร ${tName} (${tid}) ถูกจัดสอนวิชา ${subId} ในเวลาประชุม (${slotLabel(ctx, ts)})`);
      }
    }

    // Room-slot map
    for (const rid of rIds) {
      const rmk = `${rid}|${ts}`;
      if (!roomSlotMap.has(rmk)) roomSlotMap.set(rmk, new Map());
      const sm = roomSlotMap.get(rmk);
      if (!sm.has(sessionKey)) sm.set(sessionKey, []);
      sm.get(sessionKey).push(row);
    }

    if (sub) {
      // C7: teacher qualification & co-teaching
      const expectedTeachers = ctx.teachersBySubject.get(subId) || [];
      for (const tid of tIds) {
        if (!expectedTeachers.includes(tid)) {
          vC7.push(`อาจารย์ ${tid} ไม่ได้ถูกกำหนดให้สอนวิชา ${subId} (${slotLabel(ctx, ts)})`);
        }
      }
      if (expectedTeachers.length > 1) {
        const missingT = expectedTeachers.filter((tid) => !tIds.includes(tid));
        if (missingT.length > 0) {
          vC7.push(`วิชาสอนร่วม ${subId} กลุ่ม ${g} (${slotLabel(ctx, ts)}) ขาดผู้สอนร่วม: ${missingT.join(', ')}`);
        }
      }

      // C6: room capacity
      let neededSeats = 0;
      if (sub.special_mode === 'elective') {
        neededSeats = 20;
      } else if (sub.special_mode === 'combined_year' && c.c13_combinedYear) {
        neededSeats = ctx.activeGroups
          .filter((ag) => ag.year === sub.year)
          .reduce((sum, ag) => sum + ag.student_count, 0);
      } else {
        neededSeats = ctx.groups.get(g)?.student_count || 0;
      }
      for (const rid of rIds) {
        const rm = ctx.rooms.get(rid);
        if (rm && rm.capacity > 0 && neededSeats > rm.capacity) {
          vC6.push(`ห้อง ${rm.room_name} (${rid}) จุ ${rm.capacity} คน ไม่พอสำหรับ ${g} วิชา ${subId} (${neededSeats} คน)`);
        }
      }

      // C10: room category & homeroom
      if (c.c10_roomCategory) {
        const primaryRoomId = rIds[0];
        const primaryRoom = ctx.rooms.get(primaryRoomId);
        if (sub.group_type === 'นวัตกรรมและเทคโนโลยี') {
          if (!primaryRoom || primaryRoom.room_type !== 'ComputerLab') {
            vC10.push(`วิชา ${subId} (นวัตกรรมและเทคโนโลยี) ของกลุ่ม ${g} ใช้ห้อง ${primaryRoomId} แทนห้องคอมพิวเตอร์`);
          }
        } else if (sub.special_mode === 'combined_year' && c.c13_combinedYear) {
          if (!primaryRoom || primaryRoom.room_type !== 'LectureHall') {
            vC10.push(`วิชาเรียนรวม ${subId} ของกลุ่ม ${g} ใช้ห้อง ${primaryRoomId} แทนห้องประชุม`);
          }
        } else if (sub.special_mode === 'normal') {
          const home = ctx.groups.get(g)?.home_room;
          if (home && primaryRoomId !== home) {
            vC10.push(`กลุ่ม ${g} วิชา ${subId} ใช้ห้อง ${primaryRoomId} แทนห้องประจำ ${home}`);
          }
        } else if (sub.special_mode === 'elective') {
          const validTheory = ctx.theoryRoomsForElective(sub.year);
          if (!validTheory.includes(primaryRoomId)) {
            vC10.push(`วิชาเลือก ${subId} ใช้ห้องทฤษฎี ${primaryRoomId} ที่ไม่อยู่ในชุดห้องทฤษฎีที่อนุญาต`);
          }
        }
      }

      // C11: sport dual room (theory + sport facility at same time)
      if (c.c11_sportDualRoom && (sub.group_type === 'ทักษะและการสอนกีฬา' || sub.special_mode === 'elective')) {
        const expectedSport = ctx.sportRoomFor(subId);
        if (expectedSport && !rIds.includes(expectedSport)) {
          vC11.push(`วิชากีฬา ${subId} กลุ่ม ${g} (${slotLabel(ctx, ts)}) ไม่ได้จองสนาม ${expectedSport}`);
        }
        const hasTheory = rIds.some((rid) => {
          const rt = ctx.rooms.get(rid)?.room_type;
          return rt === 'Theory' || rt === 'LectureHall';
        });
        if (!hasTheory) {
          vC11.push(`วิชากีฬา ${subId} กลุ่ม ${g} (${slotLabel(ctx, ts)}) ไม่ได้จองห้องเรียนทฤษฎีควบคู่กับสนาม`);
        }
      }
    }
  }

  // C1 & C3: check registered hours & completeness
  for (const reg of ctx.registrations) {
    const sub = ctx.subjects.get(reg.subject_id);
    if (!sub || sub.special_mode === 'practicum_y4') continue;
    const req = ctx.hours(reg.subject_id);
    const got = countByGroupSub.get(`${reg.group_id}|${reg.subject_id}`) || 0;
    if (got !== req) {
      vC1.push(`กลุ่ม ${reg.group_id} วิชา ${reg.subject_id} จัดได้ ${got} คาบ (ต้องเป็น ${req} คาบ)`);
    }
    if (got === 0 && req > 0) {
      vC3.push(`กลุ่ม ${reg.group_id} ขาดวิชา ${reg.subject_id}`);
    }
  }

  // C3: group clashes (no group takes >1 subject at same slot; cohort elective rows for SAME set at same slot are allowed as 1 elective block)
  for (const [gk, gRows] of groupSlotMap.entries()) {
    const [g, ts] = gk.split('|');
    const nonCohort = gRows.filter((r) => !ctx.electiveSets.has(r.group_id));
    const cohorts = new Set(gRows.filter((r) => ctx.electiveSets.has(r.group_id)).map((r) => r.group_id));
    if (nonCohort.length > 1 || (nonCohort.length >= 1 && cohorts.size >= 1) || cohorts.size > 1) {
      const subs = [...new Set(gRows.map((r) => r.subject_id))].join(', ');
      vC3.push(`กลุ่ม ${g} เรียนซ้อนกันที่ ${slotLabel(ctx, ts)}: ${subs}`);
    }
  }

  // C4: teacher clashes
  for (const [tk, sm] of teacherSlotMap.entries()) {
    const [tid, ts] = tk.split('|');
    if (sm.size > 1) {
      const subs = [...sm.keys()].map((k) => k.split('|')[0]).join(' / ');
      vC4.push(`อาจารย์ ${tid} สอนซ้อนกันที่ ${slotLabel(ctx, ts)}: ${subs}`);
    } else {
      // Even within the same sessionKey, only combined_year may share multiple groups
      const onlyRows = [...sm.values()][0];
      if (onlyRows.length > 1) {
        const sub = ctx.subjects.get(onlyRows[0].subject_id);
        if (!sub || sub.special_mode !== 'combined_year') {
          vC4.push(`อาจารย์ ${tid} สอนหลายกลุ่มพร้อมกันที่ ${slotLabel(ctx, ts)} ในวิชา ${onlyRows[0].subject_id}`);
        }
      }
    }
  }

  // C5: room/facility clashes
  for (const [rmk, sm] of roomSlotMap.entries()) {
    const [rid, ts] = rmk.split('|');
    if (sm.size > 1) {
      const subs = [...sm.keys()].map((k) => k.split('|')[0]).join(' / ');
      vC5.push(`ห้อง/สนาม ${rid} ใช้งานซ้อนกันที่ ${slotLabel(ctx, ts)}: ${subs}`);
    } else {
      const onlyRows = [...sm.values()][0];
      if (onlyRows.length > 1) {
        const sub = ctx.subjects.get(onlyRows[0].subject_id);
        if (!sub || sub.special_mode !== 'combined_year') {
          vC5.push(`ห้อง/สนาม ${rid} ใช้ซ้อนหลายกลุ่มที่ ${slotLabel(ctx, ts)} ในวิชา ${onlyRows[0].subject_id}`);
        }
      }
    }
  }

  // C9: every active group must have Wed P8 ADVISOR & Wed P9 ACTIVITY
  if (c.c9_wedFixed) {
    for (const g of ctx.activeGroups) {
      if (!wedFixedFound.has(`${g.group_id}|ADVISOR`)) {
        vC9.push(`กลุ่ม ${g.group_id} ไม่มีคาบพบอาจารย์ที่ปรึกษา (พุธ คาบ 8)`);
      }
      if (!wedFixedFound.has(`${g.group_id}|ACTIVITY`)) {
        vC9.push(`กลุ่ม ${g.group_id} ไม่มีคาบกิจกรรม (พุธ คาบ 9)`);
      }
    }
  }

  // C12: elective sets synchronized at exact same timeslots
  if (c.c12_electiveSync) {
    for (const [setId, es] of ctx.electiveSets.entries()) {
      if (es.subjects.length === 0) continue;
      const firstSub = es.subjects[0];
      const baseSlots = [...(slotsByElectiveSub.get(firstSub) || [])].sort().join(',');
      for (const sid of es.subjects.slice(1)) {
        const curSlots = [...(slotsByElectiveSub.get(sid) || [])].sort().join(',');
        if (curSlots !== baseSlots) {
          vC12.push(`ชุดวิชาเลือก ${es.name} (${setId}): วิชา ${sid} จัดคนละเวลากับวิชา ${firstSub}`);
        }
      }
    }
  }

  // C13: combined-year courses synchronized across all groups of that year
  if (c.c13_combinedYear) {
    for (const sub of ctx.subjects.values()) {
      if (sub.special_mode !== 'combined_year') continue;
      const gm = slotsByCombinedSub.get(sub.subject_id) || new Map();
      const expectedGroups = ctx.activeGroups.filter((g) => g.year === sub.year).map((g) => g.group_id);
      const baseKey = [...(gm.get(expectedGroups[0]) || [])].sort().join(',');
      for (const gid of expectedGroups.slice(1)) {
        const k = [...(gm.get(gid) || [])].sort().join(',');
        if (k !== baseKey) {
          vC13.push(`วิชาเรียนรวม ${sub.subject_id}: กลุ่ม ${gid} ไม่ได้เรียนพร้อมกับกลุ่ม ${expectedGroups[0]}`);
        }
      }
    }
  }

  const checks = [
    makeCheck('I0', 0, 'ความสมบูรณ์ของโครงสร้างข้อมูล (Integrity)', 'integrity', true, vI0),
    makeCheck('C1', 1, 'จำนวนคาบรายวิชาเท่ากับชั่วโมงเรียนที่กำหนด', 'basic', true, vC1),
    makeCheck('C2', 2, 'ห้ามจัดเรียนในคาบพักเที่ยง (คาบที่ 5)', 'basic', true, vC2),
    makeCheck('C3', 3, 'กลุ่มนักศึกษาไม่เรียนซ้อนและครบตามหลักสูตร (ปี 4 ไม่มีตาราง)', 'basic', true, vC3),
    makeCheck('C4', 4, 'อาจารย์ไม่สอนซ้อนกันในคาบเดียวกัน', 'basic', true, vC4),
    makeCheck('C5', 5, 'ห้องเรียนและสนามไม่ใช้งานซ้อนกันในคาบเดียวกัน', 'basic', true, vC5),
    makeCheck('C6', 6, 'ความจุห้องเพียงพอต่อจำนวนนักศึกษา', 'basic', true, vC6),
    makeCheck('C7', 7, 'อาจารย์ตรงรายวิชาและวิชาสอนร่วมสอนพร้อมกันทั้ง 2 คน', 'basic', true, vC7),
    makeCheck('C8', 8, 'ประชุมอาจารย์ฝ่ายบริหาร 7 คน (อังคาร คาบ 1–4)', 'special', !!c.c8_execMeeting, vC8),
    makeCheck('C9', 9, 'คาบพบอาจารย์ที่ปรึกษา (พุธ คาบ 8) และกิจกรรม (พุธ คาบ 9)', 'special', !!c.c9_wedFixed, vC9),
    makeCheck('C10', 10, 'ประเภทห้องและห้องประจำ (ทฤษฎี / คอมพิวเตอร์ / ห้องประชุม)', 'special', !!c.c10_roomCategory, vC10),
    makeCheck('C11', 11, 'กลุ่มทักษะและการสอนกีฬาจองทั้งห้องทฤษฎีและโรงยิม/สนามพร้อมกัน', 'special', !!c.c11_sportDualRoom, vC11),
    makeCheck('C12', 12, 'กลุ่มวิชาเลือกกีฬาจัดพร้อมกันทั้งชุด (ห้องทฤษฎี + สนาม)', 'special', !!c.c12_electiveSync, vC12),
    makeCheck('C13', 13, 'วิชาปฏิบัติการวิชาชีพเรียนรวมทั้งชั้นปี (4 คาบ ห้องประชุม)', 'special', !!c.c13_combinedYear, vC13),
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
