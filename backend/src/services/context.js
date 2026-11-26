export const SPECIAL_SUBJECTS = {
  ADVISOR: 'พบอาจารย์ที่ปรึกษา',
  ACTIVITY: 'กิจกรรม',
};

export const ELECTIVE_SET_META = {
  Y2_EL: { id: 'Y2_EL', year: 2, name: 'ทักษะและการสอนกีฬาขั้นสูง', label: 'ปี 2 (วิชาเลือก)' },
  Y3_EL1: { id: 'Y3_EL1', year: 3, name: 'การตัดสินกีฬา', label: 'ปี 3 (วิชาเลือก: การตัดสิน)' },
  Y3_EL2: { id: 'Y3_EL2', year: 3, name: 'กลวิธีการฝึกกีฬา', label: 'ปี 3 (วิชาเลือก: กลวิธีการฝึก)' },
};

export function splitIds(value) {
  return String(value || '')
    .split('+')
    .map((s) => s.trim())
    .filter((s) => s && s !== '-');
}

export function buildContext(data, config) {
  const params = config.params;
  const constraints = config.constraints;
  const warnings = [];

  const days = [];
  const dayToIdx = new Map();
  const slotsById = new Map();
  const slotByDayPeriod = new Map();
  const periodSet = new Set();

  (data.timeslot || []).forEach((row, index) => {
    if (!dayToIdx.has(row.day)) {
      dayToIdx.set(row.day, days.length);
      days.push(row.day);
    }
    const dayIdx = dayToIdx.get(row.day);
    const slot = { ...row, id: row.timeslot_id, dayIdx, index };
    slotsById.set(row.timeslot_id, slot);
    slotByDayPeriod.set(`${dayIdx}|${row.period}`, row.timeslot_id);
    periodSet.add(row.period);
  });

  const periods = [...periodSet].sort((a, b) => a - b);

  const isWedFixedSlot = (slot) => {
    if (!constraints.c9_wedFixed) return false;
    const wf = params.wedFixed || { day: 'Wed', advisorPeriod: 8, activityPeriod: 9 };
    return slot.day === wf.day && (slot.period === wf.advisorPeriod || slot.period === wf.activityPeriod);
  };

  const daySlots = days.map((_, dayIdx) =>
    [...slotsById.values()]
      .filter((s) => s.dayIdx === dayIdx && s.period !== params.breakPeriod && !isWedFixedSlot(s))
      .sort((a, b) => a.period - b.period)
      .map((s) => s.id)
  );

  const teachers = new Map();
  for (const t of data.teacher || []) teachers.set(t.teacher_id, t);

  const groups = new Map();
  for (const g of data.student_group || []) groups.set(g.group_id, g);

  const activeGroups = [...groups.values()].filter((g) => g.year !== 4);

  const subjects = new Map();
  for (const s of data.subject || []) subjects.set(s.subject_id, s);

  const rooms = new Map();
  for (const r of data.room || []) {
    if (!/^[A-Za-z0-9_-]+$/.test(r.room_id)) {
      warnings.push({ level: 'warn', message: `ห้อง "${r.room_id}" มีรหัสไม่ถูกต้อง จึงไม่นำมาใช้จัดตาราง` });
      continue;
    }
    rooms.set(r.room_id, r);
  }

  const teachersBySubject = new Map();
  for (const row of data.teach || []) {
    if (!teachers.has(row.teacher_id)) {
      warnings.push({ level: 'warn', message: `teach.csv อ้างถึงครู ${row.teacher_id} ที่ไม่มีใน teacher.csv` });
      continue;
    }
    if (!teachersBySubject.has(row.subject_id)) teachersBySubject.set(row.subject_id, []);
    const list = teachersBySubject.get(row.subject_id);
    if (!list.includes(row.teacher_id)) list.push(row.teacher_id);
  }

  const hours = (subjectId) => {
    const s = subjects.get(subjectId);
    if (!s) return 0;
    if (s.special_mode === 'practicum_y4') return 0;
    return (Number(s.theory) || 0) + (Number(s.practice) || 0);
  };

  const electiveSets = new Map();
  for (const [setId, meta] of Object.entries(ELECTIVE_SET_META)) {
    const setGroups = activeGroups.filter((g) => g.year === meta.year).map((g) => g.group_id);
    electiveSets.set(setId, { ...meta, groups: setGroups, subjects: [] });
  }

  const registrations = [];
  const regSeen = new Set();
  const groupRegCount = new Map();

  for (const row of data.register || []) {
    const k = `${row.group_id}|${row.subject_id}`;
    if (regSeen.has(k)) continue;
    regSeen.add(k);

    const isElectiveCohort = electiveSets.has(row.group_id);
    if (!isElectiveCohort && !groups.has(row.group_id)) {
      warnings.push({ level: 'error', message: `register.csv อ้างถึงกลุ่ม ${row.group_id} ที่ไม่มีใน student_group.csv` });
      continue;
    }
    if (!subjects.has(row.subject_id)) {
      warnings.push({ level: 'error', message: `register.csv อ้างถึงวิชา ${row.subject_id} ที่ไม่มีใน subject.csv` });
      continue;
    }

    const sub = subjects.get(row.subject_id);
    const tList = teachersBySubject.get(row.subject_id) || [];
    if (sub.special_mode !== 'practicum_y4' && tList.length === 0) {
      warnings.push({ level: 'error', message: `วิชา ${row.subject_id} ที่กลุ่ม ${row.group_id} ลงทะเบียน ไม่มีครูผู้สอนใน teach.csv` });
    }
    if (sub.special_mode !== 'practicum_y4' && hours(row.subject_id) === 0) {
      warnings.push({ level: 'warn', message: `วิชา ${row.subject_id} มีจำนวนคาบเป็น 0` });
    }

    registrations.push(row);
    groupRegCount.set(row.group_id, (groupRegCount.get(row.group_id) || 0) + 1);
    if (isElectiveCohort) {
      electiveSets.get(row.group_id).subjects.push(row.subject_id);
    }
  }

  for (const g of activeGroups) {
    if (!groupRegCount.has(g.group_id)) {
      warnings.push({ level: 'warn', message: `กลุ่ม ${g.group_id} ไม่มีรายวิชาที่ลงทะเบียน` });
    }
  }

  const sportRoomByTag = new Map();
  for (const r of rooms.values()) {
    if (r.room_type === 'Sport' && r.sport_tag) {
      sportRoomByTag.set(r.sport_tag, r.room_id);
    }
  }

  const sportRoomFor = (subjectId) => {
    const sub = subjects.get(subjectId);
    if (!sub || !sub.sport_tag) return null;
    return sportRoomByTag.get(sub.sport_tag) || null;
  };

  const allTheoryRoomIds = [...rooms.values()]
    .filter((r) => r.room_type === 'Theory' || r.room_type === 'LectureHall')
    .map((r) => r.room_id);
  const lectureHallIds = [...rooms.values()]
    .filter((r) => r.room_type === 'LectureHall')
    .map((r) => r.room_id);
  const computerLabIds = [...rooms.values()]
    .filter((r) => r.room_type === 'ComputerLab')
    .map((r) => r.room_id);
  const year4FreeRoomIds = [...groups.values()]
    .filter((g) => g.year === 4 && g.home_room && rooms.has(g.home_room))
    .map((g) => g.home_room);

  const theoryRoomsForElective = (year) => {
    const yearHomes = activeGroups
      .filter((g) => g.year === year && g.home_room && rooms.has(g.home_room))
      .map((g) => g.home_room);
    const pool = [...yearHomes, ...lectureHallIds, ...year4FreeRoomIds];
    return [...new Set(pool)].filter((id) => rooms.has(id));
  };

  const roomsFor = (subjectId, groupId = null) => {
    const sub = subjects.get(subjectId);
    if (!sub) return [...rooms.keys()];

    let neededSeats = 0;
    if (sub.special_mode === 'elective') {
      neededSeats = 20;
    } else if (sub.special_mode === 'combined_year' && constraints.c13_combinedYear) {
      neededSeats = activeGroups
        .filter((ag) => ag.year === sub.year)
        .reduce((sum, ag) => sum + ag.student_count, 0);
    } else if (groupId && groups.has(groupId)) {
      neededSeats = groups.get(groupId).student_count || 0;
    }

    const fitsCap = (rid) => {
      const rm = rooms.get(rid);
      return rm && (rm.capacity <= 0 || rm.capacity >= neededSeats);
    };

    if (!constraints.c10_roomCategory) {
      const needsTheory =
        constraints.c11_sportDualRoom &&
        (sub.group_type === 'ทักษะและการสอนกีฬา' || sub.special_mode === 'elective');
      return [...rooms.values()]
        .filter((r) => (needsTheory ? (r.room_type === 'Theory' || r.room_type === 'LectureHall') : r.room_type !== 'Sport'))
        .map((r) => r.room_id)
        .filter(fitsCap);
    }

    if (sub.group_type === 'นวัตกรรมและเทคโนโลยี') {
      return computerLabIds.filter(fitsCap);
    }

    if (sub.special_mode === 'combined_year' && constraints.c13_combinedYear) {
      return lectureHallIds.filter(fitsCap);
    }

    if (sub.special_mode === 'elective') {
      return theoryRoomsForElective(sub.year).filter(fitsCap);
    }

    if (groupId && groups.has(groupId)) {
      const hr = groups.get(groupId).home_room;
      if (hr && rooms.has(hr) && fitsCap(hr)) return [hr];
    }

    return allTheoryRoomIds.filter(fitsCap);
  };

  const isExecTeacher = (teacherId) => teachers.get(teacherId)?.role === 'Leader';

  const isExecBlockedSlot = (slotId) => {
    if (!constraints.c8_execMeeting) return false;
    const slot = slotsById.get(slotId);
    if (!slot) return false;
    const em = params.execMeeting || { day: 'Tue', periods: [1, 2, 3, 4] };
    return slot.day === em.day && em.periods.includes(slot.period);
  };

  const isCoTaught = (subjectId) => (teachersBySubject.get(subjectId) || []).length > 1;

  const isGroupInElectiveCohort = (groupId, cohortId) => {
    const es = electiveSets.get(cohortId);
    return !!es && es.groups.includes(groupId);
  };

  return {
    config,
    params,
    constraints,
    warnings,
    days,
    dayToIdx,
    periods,
    daySlots,
    slotsById,
    slotByDayPeriod,
    teachers,
    groups,
    activeGroups,
    subjects,
    rooms,
    teachersBySubject,
    registrations,
    electiveSets,
    hours,
    roomsFor,
    sportRoomFor,
    theoryRoomsForElective,
    lectureHallIds,
    computerLabIds,
    allTheoryRoomIds,
    isExecTeacher,
    isExecBlockedSlot,
    isCoTaught,
    isGroupInElectiveCohort,
    isWedFixedSlot,
  };
}
