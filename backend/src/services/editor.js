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

  // Rows of the same groups at destination swap into source
  const isSwap = (r) => dstSet.has(r.timeslot_id) && allMovingGroups.has(r.group_id);

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

export function editSpan(rows, ctx, { view, id, day, period, length = 1, teacher_id, room_id }) {
  const len = Math.max(1, Number(length) || 1);
  const slots = resolveWindow(ctx, day, Number(period), len);
  if (!slots) throw httpError(400, 'ช่วงคาบไม่ถูกต้อง');
  const slotSet = new Set(slots);

  const seed = rows.filter((r) => slotSet.has(r.timeslot_id) && rowMatchesEntity(r, view, id));
  if (seed.length === 0) throw httpError(404, 'ไม่พบคาบที่ต้องการแก้ไข');
  const subs = new Set(seed.map((r) => r.subject_id));

  return rows.map((r) => {
    if (!slotSet.has(r.timeslot_id)) return { ...r };
    const sub = ctx.subjects.get(r.subject_id);
    const match =
      rowMatchesEntity(r, view, id) ||
      (sub?.special_mode === 'combined_year' && subs.has(r.subject_id));
    if (!match) return { ...r };
    return {
      ...r,
      teacher_id: teacher_id != null && teacher_id !== '' ? String(teacher_id).trim() : r.teacher_id,
      room_id: room_id != null && room_id !== '' ? String(room_id).trim() : r.room_id,
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
