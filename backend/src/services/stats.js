import { splitIds, SPECIAL_SUBJECTS } from './context.js';
import { DAY_TH } from './grid.js';

export function timetableStats(rows, ctx) {
  const list = Array.isArray(rows) ? rows : [];
  const days = ctx.days.map((key) => ({ key, label: DAY_TH[key] || key }));
  const periods = ctx.periods.slice();
  const breakPeriod = ctx.params.breakPeriod;
  const maxPerDay = ctx.params.maxPeriodsPerDay || 8;
  const usablePerWeek = ctx.daySlots.reduce((s, arr) => s + arr.length, 0);

  // Teacher load: count distinct slots per teacher (co-teachers both counted; combined-year counts once per slot)
  const teacherSlots = new Map();
  for (const t of ctx.teachers.values()) {
    teacherSlots.set(t.teacher_id, {
      id: t.teacher_id,
      name: t.teacher_name,
      role: t.role,
      slots: new Set(),
      perDay: ctx.days.map(() => new Set()),
    });
  }

  // Room usage: count distinct slots per room/facility
  const roomSlots = new Map();
  for (const r of ctx.rooms.values()) {
    roomSlots.set(r.room_id, {
      id: r.room_id,
      name: r.room_name,
      type: r.room_type,
      slots: new Set(),
    });
  }

  // Group daily load & heat map (active groups)
  const groupSlots = new Map();
  for (const g of ctx.activeGroups) {
    groupSlots.set(g.group_id, {
      id: g.group_id,
      name: g.group_name,
      slots: new Set(),
      perDay: ctx.days.map(() => new Set()),
    });
  }

  const heatSets = ctx.days.map(() => periods.map(() => new Set()));

  for (const r of list) {
    const slot = ctx.slotsById.get(r.timeslot_id);
    if (!slot) continue;
    const pIdx = periods.indexOf(slot.period);

    const isSpecial = Boolean(SPECIAL_SUBJECTS[r.subject_id]);
    if (!isSpecial) {
      for (const tid of splitIds(r.teacher_id)) {
        const rec = teacherSlots.get(tid);
        if (rec) {
          rec.slots.add(r.timeslot_id);
          rec.perDay[slot.dayIdx].add(r.timeslot_id);
        }
      }
      for (const rid of splitIds(r.room_id)) {
        const rec = roomSlots.get(rid);
        if (rec) rec.slots.add(r.timeslot_id);
      }
    }

    const affected = ctx.electiveSets.has(r.group_id)
      ? ctx.electiveSets.get(r.group_id).groups
      : [r.group_id];
    for (const gid of affected) {
      const rec = groupSlots.get(gid);
      if (rec) {
        if (!isSpecial) {
          rec.slots.add(r.timeslot_id);
          rec.perDay[slot.dayIdx].add(r.timeslot_id);
        }
        if (pIdx !== -1) heatSets[slot.dayIdx][pIdx].add(gid);
      }
    }
  }

  const teacherLoad = [...teacherSlots.values()]
    .map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role,
      periods: t.slots.size,
      perDay: t.perDay.map((s) => s.size),
    }))
    .sort((a, b) => b.periods - a.periods || a.id.localeCompare(b.id, undefined, { numeric: true }));

  const roomUsage = [...roomSlots.values()]
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      periods: r.slots.size,
      pct: usablePerWeek > 0 ? Number(((r.slots.size / usablePerWeek) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.pct - a.pct || a.id.localeCompare(b.id, undefined, { numeric: true }));

  const heat = ctx.days.map((_, d) =>
    periods.map((p, pi) => (p === breakPeriod ? null : heatSets[d][pi].size))
  );

  const groupDaily = [...groupSlots.values()].map((g) => ({
    id: g.id,
    name: g.name,
    total: g.slots.size,
    perDay: g.perDay.map((s) => s.size),
  }));

  return {
    days,
    periods,
    breakPeriod,
    maxPerDay,
    groups: ctx.activeGroups.length,
    usablePerWeek,
    teacherLoad,
    roomUsage,
    heat,
    groupDaily,
  };
}
