import { httpError } from './store.js';
import { splitIds } from './context.js';
import { validate } from './validator.js';
import { DAY_TH } from './grid.js';

function resolveWindow(ctx, dayKey, startPeriod, length) {
  const dayIdx = ctx.days.indexOf(dayKey);
  if (dayIdx === -1) return null;
  const usable = ctx.daySlots[dayIdx];
  const slots = [];
  for (let i = 0; i < length; i++) {
    const sid = ctx.slotByDayPeriod.get(`${dayIdx}|${startPeriod + i}`);
    if (!sid || !usable.includes(sid)) return null;
    slots.push(sid);
  }
  return slots;
}

function rowMatchesEntity(row, view, id) {
  if (view === 'group') return row.group_id === id;
  if (view === 'teacher') return splitIds(row.teacher_id).includes(id);
  if (view === 'room') return splitIds(row.room_id).includes(id);
  return false;
}

export function moveSpan(rows, ctx, { view, id, fromDay, fromPeriod, length = 1, toDay, toPeriod }) {
  const len = Math.max(1, Number(length) || 1);
  const srcSlots = resolveWindow(ctx, fromDay, Number(fromPeriod), len);
  const dstSlots = resolveWindow(ctx, toDay, Number(toPeriod), len);
  if (!srcSlots || !dstSlots) {
    throw httpError(400, 'ช่วงคาบปลายทางไม่พอหรือตรงกับคาบพัก');
  }
  const same = srcSlots.every((s, i) => s === dstSlots[i]);
  if (same) return rows.map((r) => ({ ...r }));

  const srcSet = new Set(srcSlots);
  const dstSet = new Set(dstSlots);
  if (srcSlots.some((s) => dstSet.has(s))) {
    throw httpError(400, 'ช่วงต้นทางและปลายทางซ้อนกัน');
  }

  const slotMapSrcToDst = new Map(srcSlots.map((s, i) => [s, dstSlots[i]]));
  const slotMapDstToSrc = new Map(dstSlots.map((s, i) => [s, srcSlots[i]]));

  // Find moving rows (include combined-year partners of same subject in source slots)
  const seedRows = rows.filter((r) => srcSet.has(r.timeslot_id) && rowMatchesEntity(r, view, id));
  if (seedRows.length === 0) throw httpError(404, 'ไม่พบคาบที่ต้องการย้าย');

  const movingSubjects = new Set(seedRows.map((r) => r.subject_id));
  const movingGroups = new Set(seedRows.map((r) => r.group_id));

  // If moving a combined-year or elective subject, move all partner rows of that subject/set together
  const isMoving = (r) => {
    if (!srcSet.has(r.timeslot_id)) return false;
    if (rowMatchesEntity(r, view, id)) return true;
    const sub = ctx.subjects.get(r.subject_id);
    if (sub?.special_mode === 'combined_year' && movingSubjects.has(r.subject_id)) return true;
    if (ctx.electiveSets.has(r.group_id) && movingGroups.has(r.group_id)) return true;
    return false;
  };

  const movedRows = rows.filter(isMoving);
  const allMovingGroups = new Set(movedRows.map((r) => r.group_id));

  // Rows at destination that belong to the moving groups OR the same entity (e.g. teacher swapping two of their own classes)
  const dstSeedRows = rows.filter(
    (r) => dstSet.has(r.timeslot_id) && (allMovingGroups.has(r.group_id) || rowMatchesEntity(r, view, id))
  );
  const dstSubjects = new Set(dstSeedRows.map((r) => r.subject_id));
  const dstGroups = new Set(dstSeedRows.map((r) => r.group_id));
  const isSwap = (r) => {
    if (!dstSet.has(r.timeslot_id)) return false;
    if (allMovingGroups.has(r.group_id) || rowMatchesEntity(r, view, id)) return true;
    const sub = ctx.subjects.get(r.subject_id);
    if (sub?.special_mode === 'combined_year' && dstSubjects.has(r.subject_id)) return true;
    if (ctx.electiveSets.has(r.group_id) && dstGroups.has(r.group_id)) return true;
    return false;
  };

  return rows.map((r) => {
    if (isMoving(r)) {
      return { ...r, timeslot_id: slotMapSrcToDst.get(r.timeslot_id) };
    }
    if (isSwap(r)) {
      return { ...r, timeslot_id: slotMapDstToSrc.get(r.timeslot_id) };
    }
    return { ...r };
  });
}

export function editSpan(rows, ctx, { view, id, day, period, length = 1, teacher_id, room_id, group_id, group_ids, electiveEdits, electiveRoomMode }) {
  const len = Math.max(1, Number(length) || 1);
  const slots = resolveWindow(ctx, day, Number(period), len);
  if (!slots) throw httpError(400, 'ช่วงคาบไม่ถูกต้อง');
  const slotSet = new Set(slots);

  // Simple toggle for elective cohort room types: Theory and/or Sport
  if (electiveRoomMode && electiveRoomMode.cohortId) {
    const { cohortId, theory = true, sport = true } = electiveRoomMode;
    if (!theory && !sport) throw httpError(400, 'ต้องมีอย่างน้อยห้องทฤษฎีหรือสนามกีฬา 1 ประเภท');

    // Collect already-occupied theory rooms at these slots (excluding this cohort)
    const busyRooms = new Set();
    for (const r of rows) {
      if (!slotSet.has(r.timeslot_id)) continue;
      if (r.group_id === cohortId) continue;
      for (const rid of splitIds(r.room_id)) busyRooms.add(rid);
    }
    const allTheoryRooms = [...ctx.rooms.values()]
      .filter((rm) => rm.room_type === 'Theory')
      .map((rm) => rm.room_id);
    const assignedTheoryBySub = new Map();
    const usedTheoryInCohort = new Set();

    // Preserve any existing theory rooms already assigned to subjects in this cohort
    for (const r of rows) {
      if (r.group_id !== cohortId || !slotSet.has(r.timeslot_id)) continue;
      const existingTheory = splitIds(r.room_id).find((rid) => ctx.rooms.get(rid)?.room_type === 'Theory');
      if (existingTheory && !assignedTheoryBySub.has(r.subject_id)) {
        assignedTheoryBySub.set(r.subject_id, existingTheory);
        usedTheoryInCohort.add(existingTheory);
      }
    }

    const pickTheoryFor = (subId) => {
      if (assignedTheoryBySub.has(subId)) return assignedTheoryBySub.get(subId);
      const free = allTheoryRooms.find((rid) => !busyRooms.has(rid) && !usedTheoryInCohort.has(rid))
        || allTheoryRooms.find((rid) => !usedTheoryInCohort.has(rid))
        || allTheoryRooms[0];
      if (free) {
        assignedTheoryBySub.set(subId, free);
        usedTheoryInCohort.add(free);
      }
      return free || '';
    };

    return rows.map((r) => {
      if (r.group_id !== cohortId || !slotSet.has(r.timeslot_id)) return { ...r };
      const curIds = splitIds(r.room_id);
      const curTheory = curIds.find((rid) => ctx.rooms.get(rid)?.room_type === 'Theory');
      const curSport = curIds.find((rid) => ctx.rooms.get(rid)?.room_type === 'Sport');
      const nextIds = [];
      if (theory) {
        const th = curTheory || pickTheoryFor(r.subject_id);
        if (th) nextIds.push(th);
      }
      if (sport) {
        const sp = curSport || ctx.sportRoomFor(r.subject_id) || '';
        if (sp) nextIds.push(sp);
      }
      return {
        ...r,
        room_id: nextIds.length > 0 ? nextIds.join('+') : r.room_id,
      };
    });
  }

  // Batch edit for elective cohort subjects (Y2_EL, Y3_EL1, Y3_EL2)
  if (Array.isArray(electiveEdits) && electiveEdits.length > 0) {
    const bySub = new Map(electiveEdits.map((e) => [e.subject_id, e]));
    return rows.map((r) => {
      if (!slotSet.has(r.timeslot_id)) return { ...r };
      const ed = bySub.get(r.subject_id);
      if (!ed) return { ...r };
      return {
        ...r,
        room_id: ed.room_id != null && ed.room_id !== '' ? String(ed.room_id).trim() : r.room_id,
        teacher_id: ed.teacher_id != null && ed.teacher_id !== '' ? String(ed.teacher_id).trim() : r.teacher_id,
      };
    });
  }

  const seed = rows.filter((r) => slotSet.has(r.timeslot_id) && rowMatchesEntity(r, view, id));
  if (seed.length === 0) throw httpError(404, 'ไม่พบคาบที่ต้องการแก้ไข');
  const subs = new Set(seed.map((r) => r.subject_id));
  const seedTeacher = seed[0].teacher_id;
  const seedRoom = seed[0].room_id;
  const seedSub = seed[0].subject_id;

  const isTargetRow = (r) => {
    if (!slotSet.has(r.timeslot_id)) return false;
    if (rowMatchesEntity(r, view, id)) return true;
    const sub = ctx.subjects.get(r.subject_id);
    if (sub?.special_mode === 'combined_year' && subs.has(r.subject_id)) return true;
    if (subs.has(r.subject_id) && r.teacher_id === seedTeacher && r.room_id === seedRoom) return true;
    return false;
  };

  // Multi-group edit (add/remove groups for normal, combined-year, ADVISOR, ACTIVITY)
  if (Array.isArray(group_ids) && group_ids.length > 0) {
    const cleanGroups = [...new Set(group_ids.map((g) => String(g || '').trim()).filter(Boolean))];
    if (cleanGroups.length === 0) throw httpError(400, 'ต้องมีกลุ่มเรียนอย่างน้อย 1 กลุ่ม');
    const nextTeacher = teacher_id != null && teacher_id !== '' ? String(teacher_id).trim() : seedTeacher;
    const nextRoom = room_id != null && room_id !== '' ? String(room_id).trim() : seedRoom;
    const kept = rows.filter((r) => !isTargetRow(r));
    const added = [];
    for (const gid of cleanGroups) {
      for (const ts of slots) {
        added.push({
          group_id: gid,
          timeslot_id: ts,
          subject_id: seedSub,
          teacher_id: nextTeacher,
          room_id: nextRoom,
        });
      }
    }
    return [...kept, ...added];
  }

  return rows.map((r) => {
    if (!isTargetRow(r)) return { ...r };
    return {
      ...r,
      teacher_id: teacher_id != null && teacher_id !== '' ? String(teacher_id).trim() : r.teacher_id,
      room_id: room_id != null && room_id !== '' ? String(room_id).trim() : r.room_id,
      group_id: group_id != null && group_id !== '' && !ctx.electiveSets.has(r.group_id) ? String(group_id).trim() : r.group_id,
    };
  });
}

export function validMoveTargets(rows, data, config, ctx, { view, id, fromDay, fromPeriod, length = 1 }) {
  const len = Math.max(1, Number(length) || 1);
  const curVal = validate(rows, data, config, ctx);
  const curFail = curVal.checks.filter((c) => c.enabled && !c.passed).length;
  const curViol = curVal.checks.reduce((s, c) => s + (c.enabled ? c.violationCount : 0), 0);

  const targets = [];
  for (let d = 0; d < ctx.days.length; d++) {
    const dayKey = ctx.days[d];
    for (const p of ctx.periods) {
      if (dayKey === fromDay && p === Number(fromPeriod)) continue;
      try {
        const next = moveSpan(rows, ctx, {
          view,
          id,
          fromDay,
          fromPeriod,
          length: len,
          toDay: dayKey,
          toPeriod: p,
        });
        const v = validate(next, data, config, ctx);
        const fail = v.checks.filter((c) => c.enabled && !c.passed).length;
        const viol = v.checks.reduce((s, c) => s + (c.enabled ? c.violationCount : 0), 0);
        if (fail <= curFail && viol <= curViol) {
          const dstSlots = resolveWindow(ctx, dayKey, p, len);
          const dstSet = new Set(dstSlots);
          const isSwap = rows.some((r) => dstSet.has(r.timeslot_id) && rowMatchesEntity(r, view, id));
          targets.push({
            day: dayKey,
            dayLabel: DAY_TH[dayKey] || dayKey,
            period: p,
            endPeriod: p + len - 1,
            periods: Array.from({ length: len }, (_, i) => p + i),
            isSwap,
          });
        }
      } catch {
        // invalid or overlapping window
      }
    }
  }
  return targets;
}
