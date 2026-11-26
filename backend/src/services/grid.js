import { splitIds, SPECIAL_SUBJECTS, ELECTIVE_SET_META } from './context.js';

export const DAY_TH = {
  Mon: 'จันทร์',
  Tue: 'อังคาร',
  Wed: 'พุธ',
  Thu: 'พฤหัสบดี',
  Fri: 'ศุกร์',
  Sat: 'เสาร์',
  Sun: 'อาทิตย์',
};

export const VIEWS = ['group', 'teacher', 'room'];

export function subjectName(id, ctx) {
  if (SPECIAL_SUBJECTS[id]) return SPECIAL_SUBJECTS[id];
  if (ELECTIVE_SET_META[id]) return ELECTIVE_SET_META[id].name;
  return ctx.subjects.get(id)?.subject_name || id;
}

export function displaySubjectCode(id) {
  if (SPECIAL_SUBJECTS[id]) return SPECIAL_SUBJECTS[id];
  if (ELECTIVE_SET_META[id]) return ELECTIVE_SET_META[id].short;
  return id;
}

export function teacherNames(teacherIdRaw, ctx) {
  const ids = splitIds(teacherIdRaw);
  if (ids.length === 0) return '-';
  return ids.map((id) => ctx.teachers.get(id)?.teacher_name || id).join(' / ');
}

export function roomNames(roomIdRaw, ctx) {
  const ids = splitIds(roomIdRaw);
  if (ids.length === 0) return '-';
  return ids.map((id) => ctx.rooms.get(id)?.room_name || id).join(' + ');
}

export function groupLabel(gid, ctx) {
  if (ELECTIVE_SET_META[gid]) return ELECTIVE_SET_META[gid].label;
  return ctx.groups.get(gid)?.group_name || gid;
}

export function entitiesFor(view, ctx) {
  if (view === 'group') {
    return [...ctx.groups.values()].map((g) => ({
      id: g.group_id,
      title: `กลุ่มเรียน ${g.group_name} (${g.group_id})`,
      subtitle: g.year === 4
        ? `ฝึกปฏิบัติการสอนในสถานศึกษา (ไม่มีตารางเรียน) · จำนวน ${g.student_count} คน`
        : `${g.advisor ? `ครูที่ปรึกษา: ${g.advisor} · ` : ''}ห้องประจำ: ${ctx.rooms.get(g.home_room)?.room_name || g.home_room} · จำนวนนักศึกษา ${g.student_count} คน`,
      heading: 'ตารางเรียน',
      info: [
        ['กลุ่มเรียน', `${g.group_name} (${g.group_id})`],
        ['ครูที่ปรึกษา', g.advisor || '-'],
        ['ห้องประจำ', ctx.rooms.get(g.home_room)?.room_name || g.home_room || '-'],
      ],
      signer: 'อาจารย์ที่ปรึกษา',
      signerName: (g.advisor || '').split('/')[0].trim(),
    }));
  }

  if (view === 'teacher') {
    return [...ctx.teachers.values()].map((t) => ({
      id: t.teacher_id,
      role: t.role,
      isLeader: t.role === 'Leader',
      title: `${t.teacher_name} (${t.teacher_id})`,
      subtitle:
        t.role === 'Leader'
          ? 'ตำแหน่ง: อาจารย์ฝ่ายบริหาร (ประชุมอังคาร คาบ 1–4)'
          : 'ตำแหน่ง: อาจารย์ผู้สอน',
      heading: 'ตารางสอน',
      info: [
        ['ผู้สอน', t.teacher_name],
        ['สถานะ', t.role === 'Leader' ? 'อาจารย์ฝ่ายบริหาร' : 'อาจารย์ผู้สอน'],
      ],
      signer: 'อาจารย์ผู้สอน',
      signerName: t.teacher_name,
    }));
  }

  if (view === 'room') {
    const typeLabel = {
      Theory: 'ห้องเรียนทฤษฎี',
      LectureHall: 'ห้องประชุม',
      ComputerLab: 'ห้องปฏิบัติการคอมพิวเตอร์',
      Sport: 'โรงยิม/สนามกีฬา',
    };
    return [...ctx.rooms.values()].map((r) => ({
      id: r.room_id,
      title: `${r.room_name} (${r.room_id})`,
      subtitle: `${typeLabel[r.room_type] || r.room_type} · ความจุ ${r.capacity} ที่นั่ง${r.sport_tag ? ` · ${r.sport_tag}` : ''}`,
      heading: 'ตารางการใช้พื้นที่',
      info: [
        ['สถานที่', `${r.room_name} (${r.room_id})`],
        ['ประเภท', `${typeLabel[r.room_type] || r.room_type} (${r.capacity} ที่นั่ง)`],
      ],
      signer: 'ผู้ดูแลสถานที่',
      signerName: '',
    }));
  }

  return [];
}

function rowsForEntity(view, id, rows, ctx) {
  if (view === 'group') {
    const g = ctx.groups.get(id);
    const out = [];
    const cohortSeen = new Set();
    for (const r of rows) {
      if (r.group_id === id) {
        out.push(r);
      } else if (g && ctx.isGroupInElectiveCohort(id, r.group_id)) {
        // Collapse the simultaneous elective subjects into one display entry per slot for the group view
        const key = `${r.group_id}|${r.timeslot_id}`;
        if (!cohortSeen.has(key)) {
          cohortSeen.add(key);
          const es = ctx.electiveSets.get(r.group_id);
          out.push({
            group_id: id,
            timeslot_id: r.timeslot_id,
            subject_id: r.group_id,
            teacher_id: '-',
            room_id: '-',
            _electiveDisplay: `เลือก 1 จาก ${es.subjects.length} วิชา`,
          });
        }
      }
    }
    return out;
  }

  if (view === 'teacher') {
    return rows.filter((r) => splitIds(r.teacher_id).includes(id));
  }

  if (view === 'room') {
    return rows.filter((r) => splitIds(r.room_id).includes(id));
  }

  return [];
}

export function buildGrid(view, id, rows, ctx) {
  const days = ctx.days.map((key) => ({ key, label: DAY_TH[key] || key }));
  const periodMeta = ctx.periods.map((p) => {
    const sample = [...ctx.slotsById.values()].find((s) => s.period === p);
    return {
      period: p,
      start: sample?.start || '',
      end: sample?.end || '',
      isBreak: p === ctx.params.breakPeriod,
    };
  });

  const rel = rowsForEntity(view, id, rows || [], ctx);
  const byDayPeriod = new Map();
  const usedSlots = new Set();

  for (const r of rel) {
    const slot = ctx.slotsById.get(r.timeslot_id);
    if (!slot) continue;
    usedSlots.add(r.timeslot_id);
    const k = `${slot.dayIdx}|${slot.period}`;
    if (!byDayPeriod.has(k)) byDayPeriod.set(k, []);
    byDayPeriod.get(k).push(r);
  }

  const cells = ctx.days.map((_, dayIdx) => {
    const spans = [];
    for (const pm of periodMeta) {
      if (pm.isBreak) continue;
      const list = byDayPeriod.get(`${dayIdx}|${pm.period}`) || [];
      if (list.length === 0) continue;

      const first = list[0];
      const groups = [...new Set(list.map((r) => r.group_id))];
      const subjects = new Set(list.map((r) => r.subject_id));
      const clash = view === 'group' ? list.length > 1 : subjects.size > 1;

      const hasTeacher = splitIds(first.teacher_id).length > 0;
      const entry = {
        start: pm.period,
        span: 1,
        subject_id: first.subject_id,
        display_code: displaySubjectCode(first.subject_id),
        subject_name: subjectName(first.subject_id, ctx),
        teacher_id: first.teacher_id,
        teacher: first._electiveDisplay || (hasTeacher ? teacherNames(first.teacher_id, ctx) : ''),
        room: first.room_id,
        room_name: first._electiveDisplay ? 'ห้องทฤษฎี + สนามกีฬา' : roomNames(first.room_id, ctx),
        groups,
        group_labels: groups.map((g) => groupLabel(g, ctx)),
        clash,
      };

      const prev = spans[spans.length - 1];
      if (
        prev &&
        prev.start + prev.span === entry.start &&
        prev.subject_id === entry.subject_id &&
        prev.teacher_id === entry.teacher_id &&
        prev.room === entry.room &&
        prev.groups.join('+') === entry.groups.join('+') &&
        !prev.clash &&
        !entry.clash
      ) {
        prev.span += 1;
      } else {
        spans.push(entry);
      }
    }
    return spans;
  });

  return {
    days,
    periods: periodMeta,
    cells,
    total: usedSlots.size,
  };
}

export function subjectSummary(view, id, rows, ctx) {
  const rel = rowsForEntity(view, id, rows || [], ctx);
  const seen = new Set();
  const list = [];

  for (const r of rel) {
    if (SPECIAL_SUBJECTS[r.subject_id] || ELECTIVE_SET_META[r.subject_id]) continue;
    if (seen.has(r.subject_id)) continue;
    seen.add(r.subject_id);
    const sub = ctx.subjects.get(r.subject_id);
    if (!sub) continue;
    const n = Number(sub.credit) || 0;
    const t = Number(sub.theory) || 0;
    const p = Number(sub.practice) || 0;
    const m3 = String(sub.credit_raw || '').trim().match(/^(\d+)\s*\(\s*(\d+)\s*[-–]\s*(\d+)\s*[-–]\s*(\d+)\s*\)$/);
    const s = m3 ? Number(m3[4]) : 0;
    list.push({
      subject_id: sub.subject_id,
      name: sub.subject_name,
      n,
      t,
      p,
      s,
      h: t + p,
    });
  }

  // Include Year 4 practicum subjects (e.g. กศ 021037 ปฏิบัติการสอนในสถานศึกษา 4)
  // in the responsible teachers' subject summary without scheduling any timetable slots.
  if (view === 'teacher') {
    for (const sub of ctx.subjects.values()) {
      if (sub.special_mode !== 'practicum_y4') continue;
      if (seen.has(sub.subject_id)) continue;
      const assigned = ctx.teachersBySubject.get(sub.subject_id) || [];
      if (!assigned.includes(id)) continue;
      seen.add(sub.subject_id);
      list.push({
        subject_id: sub.subject_id,
        name: sub.subject_name,
        n: Number(sub.credit) || 0,
        t: 0,
        p: 0,
        s: 0,
        h: 0,
      });
    }
  }

  list.sort((a, b) => a.subject_id.localeCompare(b.subject_id, undefined, { numeric: true }));
  const total = list.reduce(
    (acc, item) => ({
      n: acc.n + item.n,
      t: acc.t + item.t,
      p: acc.p + item.p,
      s: acc.s + item.s,
      h: acc.h + item.h,
    }),
    { n: 0, t: 0, p: 0, s: 0, h: 0 }
  );
  return { list, total };
}
