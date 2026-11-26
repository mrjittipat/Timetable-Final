import { buildContext } from './context.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function splitHours(h, maxBlock) {
  const lim = Math.max(1, Number(maxBlock) || 4);
  const n = Math.ceil(h / lim);
  const base = Math.floor(h / n);
  const rem = h % n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(base + (i < rem ? 1 : 0));
  return out;
}

function buildBlocks(ctx) {
  const c = ctx.constraints;
  const p = ctx.params;
  const courses = [];
  const blocks = [];
  const problems = [];

  const combinedHandled = new Set();
  const electiveHandled = new Set();

  for (const reg of ctx.registrations) {
    const sub = ctx.subjects.get(reg.subject_id);
    if (!sub || sub.special_mode === 'practicum_y4') continue;
    const h = ctx.hours(sub.subject_id);
    if (h <= 0) continue;

    // Synchronized elective set (C12 ON)
    if (sub.special_mode === 'elective' && c.c12_electiveSync) {
      const setId = reg.group_id;
      if (electiveHandled.has(setId)) continue;
      electiveHandled.add(setId);

      const es = ctx.electiveSets.get(setId);
      const subItems = [];
      const allTeachers = [];
      const allSportRooms = [];
      for (const sid of es.subjects) {
        const sObj = ctx.subjects.get(sid);
        const tList = ctx.teachersBySubject.get(sid) || [];
        if (tList.length === 0) problems.push(`${sid} (${setId}) ไม่มีครูที่สอนได้`);
        const spRoom = ctx.sportRoomFor(sid);
        if (c.c11_sportDualRoom && !spRoom) problems.push(`${sid} (${setId}) ไม่มีสนามกีฬาที่ตรงกัน`);
        subItems.push({
          subjectId: sid,
          teachers: tList,
          sportRoom: c.c11_sportDualRoom ? spRoom : null,
        });
        for (const t of tList) allTeachers.push(t);
        if (c.c11_sportDualRoom && spRoom) allSportRooms.push(spRoom);
      }

      const theoryPool = ctx.theoryRoomsForElective(es.year);
      if (theoryPool.length < subItems.length) {
        problems.push(`ชุดวิชาเลือก ${es.name} (${setId}) ต้องการ ${subItems.length} ห้องทฤษฎี แต่มีเพียง ${theoryPool.length} ห้อง`);
      }

      const course = {
        id: courses.length,
        kind: 'elective_set',
        setId,
        subjectId: setId,
        subjectName: es.name,
        groups: es.groups.slice(),
        hours: h,
        teachers: [...new Set(allTeachers)],
        sportRooms: allSportRooms,
        theoryPool,
        subItems,
        blockIds: [],
      };
      courses.push(course);
      for (const len of splitHours(h, p.maxBlock)) {
        const bid = blocks.length;
        blocks.push({ id: bid, course, len, fixed: null });
        course.blockIds.push(bid);
      }
      continue;
    }

    // Independent elective subject (C12 OFF)
    if (sub.special_mode === 'elective' && !c.c12_electiveSync) {
      const tList = ctx.teachersBySubject.get(sub.subject_id) || [];
      if (tList.length === 0) problems.push(`${sub.subject_id} (${reg.group_id}) ไม่มีครูที่สอนได้`);
      const spRoom = c.c11_sportDualRoom ? ctx.sportRoomFor(sub.subject_id) : null;
      const rooms = ctx.roomsFor(sub.subject_id, null);
      if (rooms.length === 0) problems.push(`${sub.subject_id} (${reg.group_id}) ไม่มีห้องที่ใช้ได้ตามเงื่อนไข`);

      const course = {
        id: courses.length,
        kind: 'elective_single',
        setId: reg.group_id,
        subjectId: sub.subject_id,
        subjectName: sub.subject_name,
        groups: [],
        hours: h,
        teachers: tList,
        rooms,
        sportRoom: spRoom,
        blockIds: [],
      };
      courses.push(course);
      for (const len of splitHours(h, p.maxBlock)) {
        const bid = blocks.length;
        blocks.push({ id: bid, course, len, fixed: null });
        course.blockIds.push(bid);
      }
      continue;
    }

    // Combined-year course (C13 ON)
    if (sub.special_mode === 'combined_year' && c.c13_combinedYear) {
      if (combinedHandled.has(sub.subject_id)) continue;
      combinedHandled.add(sub.subject_id);

      const yGroups = ctx.activeGroups.filter((g) => g.year === sub.year).map((g) => g.group_id);
      const tList = ctx.teachersBySubject.get(sub.subject_id) || [];
      const rooms = ctx.roomsFor(sub.subject_id, null);
      if (tList.length === 0) problems.push(`${sub.subject_id} (${yGroups.join('+')}) ไม่มีครูที่สอนได้`);
      if (rooms.length === 0) problems.push(`${sub.subject_id} (${yGroups.join('+')}) ไม่มีห้องที่ใช้ได้ตามเงื่อนไข`);

      const course = {
        id: courses.length,
        kind: 'combined_year',
        subjectId: sub.subject_id,
        subjectName: sub.subject_name,
        groups: yGroups,
        hours: h,
        teachers: tList,
        rooms,
        sportRoom: null,
        blockIds: [],
      };
      courses.push(course);
      for (const len of splitHours(h, p.maxBlock)) {
        const bid = blocks.length;
        blocks.push({ id: bid, course, len, fixed: null });
        course.blockIds.push(bid);
      }
      continue;
    }

    // Normal course (or combined_year when C13 OFF)
    const tList = ctx.teachersBySubject.get(sub.subject_id) || [];
    const rooms = ctx.roomsFor(sub.subject_id, reg.group_id);
    const needsSport = c.c11_sportDualRoom && sub.group_type === 'ทักษะและการสอนกีฬา';
    const sportRoom = needsSport ? ctx.sportRoomFor(sub.subject_id) : null;
    if (tList.length === 0) problems.push(`${sub.subject_id} (${reg.group_id}) ไม่มีครูที่สอนได้`);
    if (rooms.length === 0) problems.push(`${sub.subject_id} (${reg.group_id}) ไม่มีห้องที่ใช้ได้ตามเงื่อนไข`);
    if (needsSport && !sportRoom) problems.push(`${sub.subject_id} (${reg.group_id}) ไม่มีสนามกีฬาที่ตรงกัน`);

    const course = {
      id: courses.length,
      kind: 'normal',
      subjectId: sub.subject_id,
      subjectName: sub.subject_name,
      groups: [reg.group_id],
      hours: h,
      teachers: tList,
      rooms,
      sportRoom,
      blockIds: [],
    };
    courses.push(course);
    for (const len of splitHours(h, p.maxBlock)) {
      const bid = blocks.length;
      blocks.push({ id: bid, course, len, fixed: null });
      course.blockIds.push(bid);
    }
  }

  return { courses, blocks, problems };
}

class Board {
  constructor(ctx, blocks) {
    this.ctx = ctx;
    this.blocks = blocks;
    this.group = new Map();
    this.teacher = new Map();
    this.room = new Map();
    this.dayLoad = new Map();
    this.place = new Array(blocks.length).fill(null);
    this.unplaced = new Set(blocks.map((b) => b.id));

    this.groupBlocks = new Map();
    for (const g of ctx.activeGroups) this.groupBlocks.set(g.group_id, []);
    for (const b of blocks) {
      for (const g of b.course.groups) {
        if (!this.groupBlocks.has(g)) this.groupBlocks.set(g, []);
        this.groupBlocks.get(g).push(b);
      }
    }

    // Precompute contiguous period windows per dayIdx & length (never crossing lunch break)
    this.windowsByDayLen = new Map();
    for (let d = 0; d < ctx.days.length; d++) {
      const slots = ctx.daySlots[d];
      for (let len = 1; len <= 6; len++) {
        const wins = [];
        for (let i = 0; i + len <= slots.length; i++) {
          const slice = slots.slice(i, i + len);
          let contiguous = true;
          for (let k = 1; k < slice.length; k++) {
            const pPrev = ctx.slotsById.get(slice[k - 1]).period;
            const pCur = ctx.slotsById.get(slice[k]).period;
            if (pCur !== pPrev + 1) {
              contiguous = false;
              break;
            }
          }
          if (contiguous) wins.push(slice);
        }
        this.windowsByDayLen.set(`${d}|${len}`, wins);
      }
    }
  }

  clear() {
    this.group.clear();
    this.teacher.clear();
    this.room.clear();
    this.dayLoad.clear();
    this.place.fill(null);
    this.unplaced = new Set(this.blocks.map((b) => b.id));
  }

  getDayLoad(g, d) {
    return this.dayLoad.get(`${g}|${d}`) || 0;
  }

  pickRoom(course, slots, rng) {
    const rooms = course.rooms;
    for (const bid of course.blockIds) {
      const pl = this.place[bid];
      if (pl && pl.room && slots.every((s) => !this.room.has(`${pl.room}|${s}`))) {
        return pl.room;
      }
    }
    const start = Math.floor(rng() * rooms.length);
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[(start + i) % rooms.length];
      if (slots.every((s) => !this.room.has(`${r}|${s}`))) return r;
    }
    return null;
  }

  pickElectiveRooms(course, slots, rng) {
    const pool = course.theoryPool;
    const need = course.subItems.length;
    const start = Math.floor(rng() * pool.length);
    const chosen = [];
    for (let i = 0; i < pool.length && chosen.length < need; i++) {
      const r = pool[(start + i) % pool.length];
      if (slots.every((s) => !this.room.has(`${r}|${s}`))) {
        chosen.push(r);
      }
    }
    return chosen.length === need ? chosen : null;
  }

  options(b, rng) {
    const ctx = this.ctx;
    const course = b.course;
    const out = [];
    const maxPerDay = ctx.params.maxPeriodsPerDay || 8;

    const usedDays = new Set();
    if (course.blockIds.length <= ctx.days.length) {
      for (const bid of course.blockIds) {
        const pl = this.place[bid];
        if (pl) usedDays.add(pl.day);
      }
    }

    for (let d = 0; d < ctx.days.length; d++) {
      if (usedDays.has(d)) continue;
      const wins = this.windowsByDayLen.get(`${d}|${b.len}`) || [];
      for (const slots of wins) {
        // Group availability & daily load check
        let ok = true;
        for (const g of course.groups) {
          if (this.getDayLoad(g, d) + b.len > maxPerDay) {
            ok = false;
            break;
          }
          for (const s of slots) {
            if (this.group.has(`${g}|${s}`)) {
              ok = false;
              break;
            }
          }
          if (!ok) break;
        }
        if (!ok) continue;

        // Teacher availability & executive meeting check (all teachers of course simultaneously)
        for (const tid of course.teachers) {
          for (const s of slots) {
            if (this.teacher.has(`${tid}|${s}`) || (ctx.isExecTeacher(tid) && ctx.isExecBlockedSlot(s))) {
              ok = false;
              break;
            }
          }
          if (!ok) break;
        }
        if (!ok) continue;

        if (course.kind === 'elective_set') {
          // Check all sport facilities free
          for (const sr of course.sportRooms) {
            for (const s of slots) {
              if (this.room.has(`${sr}|${s}`)) {
                ok = false;
                break;
              }
            }
            if (!ok) break;
          }
          if (!ok) continue;

          const theoryRooms = this.pickElectiveRooms(course, slots, rng);
          if (!theoryRooms) continue;
          out.push({
            day: d,
            slots,
            teachers: course.teachers,
            rooms: [...theoryRooms, ...course.sportRooms],
            theoryRooms,
          });
        } else {
          if (course.sportRoom) {
            for (const s of slots) {
              if (this.room.has(`${course.sportRoom}|${s}`)) {
                ok = false;
                break;
              }
            }
            if (!ok) continue;
          }
          const primaryRoom = this.pickRoom(course, slots, rng);
          if (!primaryRoom) continue;
          const allRooms = course.sportRoom ? [primaryRoom, course.sportRoom] : [primaryRoom];
          out.push({
            day: d,
            slots,
            teachers: course.teachers,
            room: primaryRoom,
            rooms: allRooms,
          });
        }
      }
    }
    return out;
  }

  assign(b, opt) {
    const course = b.course;
    for (const g of course.groups) {
      for (const s of opt.slots) this.group.set(`${g}|${s}`, b.id);
      this.dayLoad.set(`${g}|${opt.day}`, this.getDayLoad(g, opt.day) + b.len);
    }
    for (const t of opt.teachers) {
      for (const s of opt.slots) this.teacher.set(`${t}|${s}`, b.id);
    }
    for (const r of opt.rooms) {
      for (const s of opt.slots) this.room.set(`${r}|${s}`, b.id);
    }
    this.place[b.id] = opt;
    this.unplaced.delete(b.id);
  }

  unassign(b) {
    const opt = this.place[b.id];
    if (!opt) return;
    const course = b.course;
    for (const g of course.groups) {
      for (const s of opt.slots) this.group.delete(`${g}|${s}`);
      this.dayLoad.set(`${g}|${opt.day}`, this.getDayLoad(g, opt.day) - b.len);
    }
    for (const t of opt.teachers) {
      for (const s of opt.slots) this.teacher.delete(`${t}|${s}`);
    }
    for (const r of opt.rooms) {
      for (const s of opt.slots) this.room.delete(`${r}|${s}`);
    }
    this.place[b.id] = null;
    this.unplaced.add(b.id);
  }

  wasteAfter(g, b, opt) {
    let minLen = Infinity;
    for (const ob of this.groupBlocks.get(g) || []) {
      if (ob.id !== b.id && !this.place[ob.id] && !ob.fixed) {
        if (ob.len < minLen) minLen = ob.len;
      }
    }
    if (!Number.isFinite(minLen)) return 0;

    const optSet = new Set(opt.slots);
    const slots = this.ctx.daySlots[opt.day];
    let waste = 0;
    let run = 0;
    let prevPeriod = null;
    for (const s of slots) {
      const period = this.ctx.slotsById.get(s).period;
      if (prevPeriod !== null && period !== prevPeriod + 1) {
        if (run > 0 && run < minLen) waste += run;
        run = 0;
      }
      prevPeriod = period;
      if (!optSet.has(s) && !this.group.has(`${g}|${s}`)) {
        run++;
      } else {
        if (run > 0 && run < minLen) waste += run;
        run = 0;
      }
    }
    if (run > 0 && run < minLen) waste += run;
    return waste;
  }

  score(b, opt) {
    const lp = this.ctx.params.latestPreferredPeriod || 9;
    let sc = 0;
    for (const s of opt.slots) {
      if (this.ctx.slotsById.get(s).period > lp) sc += 3;
    }
    for (const g of b.course.groups) {
      sc += this.getDayLoad(g, opt.day) * 0.3;
      sc += this.wasteAfter(g, b, opt) * 4;
    }
    return sc;
  }

  canStillFit(g) {
    const lens = [];
    for (const ob of this.groupBlocks.get(g) || []) {
      if (!this.place[ob.id] && !ob.fixed) lens.push(ob.len);
    }
    if (lens.length === 0) return true;

    const runs = [];
    for (let d = 0; d < this.ctx.days.length; d++) {
      const slots = this.ctx.daySlots[d];
      let run = 0;
      let prevPeriod = null;
      for (const s of slots) {
        const period = this.ctx.slotsById.get(s).period;
        if (prevPeriod !== null && period !== prevPeriod + 1) {
          if (run > 0) runs.push(run);
          run = 0;
        }
        prevPeriod = period;
        if (!this.group.has(`${g}|${s}`)) run++;
        else {
          if (run > 0) runs.push(run);
          run = 0;
        }
      }
      if (run > 0) runs.push(run);
    }

    const distinct = [...new Set(lens)];
    for (const L of distinct) {
      let count = 0;
      let need = 0;
      for (const x of lens) {
        if (x >= L) {
          count++;
          need += x;
        }
      }
      let fits = 0;
      let room = 0;
      for (const r of runs) {
        if (r >= L) {
          fits += Math.floor(r / L);
          room += r;
        }
      }
      if (count > fits || need > room) return false;
    }
    return true;
  }

  groupCost(g) {
    const ctx = this.ctx;
    const lp = ctx.params.latestPreferredPeriod || 9;
    let cost = 0;
    const loads = [];
    for (let d = 0; d < ctx.days.length; d++) {
      const slots = ctx.daySlots[d];
      let first = -1;
      let last = -1;
      let n = 0;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (this.group.has(`${g}|${s}`)) {
          if (first === -1) first = i;
          last = i;
          n++;
          if (ctx.slotsById.get(s).period > lp) cost += 3;
        }
      }
      if (n > 0) cost += (last - first + 1 - n) * 2;
      loads.push(n);
    }
    const avg = loads.reduce((a, b) => a + b, 0) / Math.max(1, loads.length);
    for (const l of loads) cost += (l - avg) * (l - avg) * 0.3;
    return cost;
  }

  totalCost() {
    let sum = 0;
    for (const g of this.ctx.activeGroups) sum += this.groupCost(g.group_id);
    return sum;
  }

  toRows() {
    const ctx = this.ctx;
    const rows = [];
    for (const b of this.blocks) {
      const pl = this.place[b.id];
      if (!pl) continue;
      const course = b.course;
      if (course.kind === 'elective_set') {
        for (const s of pl.slots) {
          course.subItems.forEach((item, idx) => {
            const roomStr = item.sportRoom
              ? `${pl.theoryRooms[idx]}+${item.sportRoom}`
              : pl.theoryRooms[idx];
            rows.push({
              group_id: course.setId,
              timeslot_id: s,
              subject_id: item.subjectId,
              teacher_id: item.teachers.join('+'),
              room_id: roomStr,
            });
          });
        }
      } else if (course.kind === 'elective_single') {
        const roomStr = course.sportRoom ? `${pl.room}+${course.sportRoom}` : pl.room;
        for (const s of pl.slots) {
          rows.push({
            group_id: course.setId,
            timeslot_id: s,
            subject_id: course.subjectId,
            teacher_id: course.teachers.join('+'),
            room_id: roomStr,
          });
        }
      } else {
        const roomStr = course.sportRoom ? `${pl.room}+${course.sportRoom}` : pl.room;
        for (const s of pl.slots) {
          for (const g of course.groups) {
            rows.push({
              group_id: g,
              timeslot_id: s,
              subject_id: course.subjectId,
              teacher_id: course.teachers.join('+'),
              room_id: roomStr,
            });
          }
        }
      }
    }

    // Add fixed Wed P8 (ADVISOR) and Wed P9 (ACTIVITY) rows when C9 is enabled
    if (ctx.constraints.c9_wedFixed) {
      const wf = ctx.params.wedFixed || { day: 'Wed', advisorPeriod: 8, activityPeriod: 9 };
      const wedIdx = ctx.dayToIdx.get(wf.day);
      if (wedIdx != null) {
        const advSlot = ctx.slotByDayPeriod.get(`${wedIdx}|${wf.advisorPeriod}`);
        const actSlot = ctx.slotByDayPeriod.get(`${wedIdx}|${wf.activityPeriod}`);
        for (const g of ctx.activeGroups) {
          const room = g.home_room || 'R321';
          if (advSlot) {
            rows.push({
              group_id: g.group_id,
              timeslot_id: advSlot,
              subject_id: 'ADVISOR',
              teacher_id: '-',
              room_id: room,
            });
          }
          if (actSlot) {
            rows.push({
              group_id: g.group_id,
              timeslot_id: actSlot,
              subject_id: 'ACTIVITY',
              teacher_id: '-',
              room_id: room,
            });
          }
        }
      }
    }

    rows.sort((a, b) => {
      const gc = a.group_id.localeCompare(b.group_id, undefined, { numeric: true });
      if (gc !== 0) return gc;
      const si = (ctx.slotsById.get(a.timeslot_id)?.index ?? 0) - (ctx.slotsById.get(b.timeslot_id)?.index ?? 0);
      if (si !== 0) return si;
      return a.subject_id.localeCompare(b.subject_id, undefined, { numeric: true });
    });
    return rows;
  }
}

export function solve(data, config, { onProgress } = {}) {
  const startMs = Date.now();
  const ctx = buildContext(data, config);
  const seed = Number(ctx.params.seed) || 1;
  const rng = mulberry32(seed);
  const timeLimitSec = Math.max(1, Number(ctx.params.timeLimitSec) || 20);
  const deadline = startMs + timeLimitSec * 1000;

  const { courses, blocks, problems } = buildBlocks(ctx);
  const errors = [
    ...ctx.warnings.filter((w) => w.level === 'error').map((w) => w.message),
    ...problems,
  ];
  if (errors.length > 0) {
    return {
      status: 'failed',
      message: 'ข้อมูลไม่พร้อมสำหรับการจัดตาราง',
      errors,
      rows: [],
      warnings: ctx.warnings,
      stats: { seconds: Number(((Date.now() - startMs) / 1000).toFixed(2)) },
    };
  }

  onProgress?.(`เริ่มค้นหา ${blocks.length} บล็อก จาก ${courses.length} รายวิชา-กลุ่ม`);

  const board = new Board(ctx, blocks);
  const failCount = new Array(blocks.length).fill(0);
  const NODE_LIMIT = 4000;
  const MAX_RESTARTS = 200;

  let found = false;
  let restarts = 0;
  let nodes = 0;
  let budget = 0;

  function dfs() {
    if (board.unplaced.size === 0) return true;
    if (--budget <= 0 || Date.now() > deadline) return false;

    let bestBlock = null;
    let bestOpts = null;
    for (const id of board.unplaced) {
      const b = blocks[id];
      const opts = board.options(b, rng);
      if (opts.length === 0) {
        failCount[id]++;
        return false;
      }
      if (
        !bestBlock ||
        opts.length < bestOpts.length ||
        (opts.length === bestOpts.length && b.len > bestBlock.len)
      ) {
        bestBlock = b;
        bestOpts = opts;
      }
    }

    const ranked = bestOpts
      .map((o) => ({ o, key: board.score(bestBlock, o) + rng() * 2 }))
      .sort((a, b) => a.key - b.key)
      .slice(0, 8);

    for (const { o } of ranked) {
      board.assign(bestBlock, o);
      let fit = true;
      for (const g of bestBlock.course.groups) {
        if (!board.canStillFit(g)) {
          fit = false;
          break;
        }
      }
      if (!fit) {
        board.unassign(bestBlock);
        continue;
      }
      if (dfs()) return true;
      board.unassign(bestBlock);
      if (budget <= 0) return false;
    }
    return false;
  }

  while (!found && restarts < MAX_RESTARTS && Date.now() < deadline) {
    board.clear();
    budget = NODE_LIMIT;
    found = dfs();
    nodes += NODE_LIMIT - budget;
    restarts++;
    if (!found) onProgress?.(`รอบที่ ${restarts} ยังไม่พบคำตอบ เริ่มใหม่`);
  }

  if (!found) {
    const topFail = blocks
      .map((b) => ({ b, c: failCount[b.id] }))
      .filter((x) => x.c > 0)
      .sort((a, b) => b.c - a.c)
      .slice(0, 5)
      .map(({ b }) => `${b.course.subjectId} ${b.course.subjectName} กลุ่ม ${b.course.groups.join('+')} (${b.len} คาบ)`);
    return {
      status: 'failed',
      message: 'ไม่พบตารางที่ผ่านทุกเงื่อนไขภายในเวลาที่กำหนด',
      errors: topFail.length ? [`วางบล็อกเหล่านี้ไม่ได้บ่อยที่สุด: ${topFail.join('; ')}`] : [],
      rows: [],
      warnings: ctx.warnings,
      stats: { seconds: Number(((Date.now() - startMs) / 1000).toFixed(2)) },
    };
  }

  onProgress?.('ปรับปรุงตารางด้วย Simulated Annealing');

  const softCostBefore = board.totalCost();
  let curCost = softCostBefore;
  const movable = blocks.filter((b) => !b.fixed);
  const ITER = 20000;
  let temp = 5;
  const cooling = Math.pow(0.01 / temp, 1 / ITER);
  let saIterations = 0;
  const saCurve = [{ iter: 0, cost: Number(curCost.toFixed(2)) }];

  for (let i = 0; i < ITER && Date.now() < deadline; i++) {
    saIterations++;
    temp *= cooling;
    if (movable.length === 0) break;
    const b = movable[Math.floor(rng() * movable.length)];
    let before = 0;
    for (const g of b.course.groups) before += board.groupCost(g);
    const old = board.place[b.id];
    board.unassign(b);
    const opts = board.options(b, rng);
    if (opts.length === 0) {
      board.assign(b, old);
      continue;
    }
    const chosen = opts[Math.floor(rng() * opts.length)];
    board.assign(b, chosen);
    let after = 0;
    for (const g of b.course.groups) after += board.groupCost(g);
    const delta = after - before;
    if (delta > 0 && rng() >= Math.exp(-delta / temp)) {
      board.unassign(b);
      board.assign(b, old);
    } else {
      curCost += delta;
    }
    if ((i + 1) % 500 === 0) {
      saCurve.push({ iter: i + 1, cost: Number(curCost.toFixed(2)) });
    }
  }

  const softCostAfter = board.totalCost();
  const rows = board.toRows();
  const seconds = Number(((Date.now() - startMs) / 1000).toFixed(2));

  return {
    status: 'success',
    message: 'จัดตารางสำเร็จ',
    rows,
    warnings: ctx.warnings,
    stats: {
      courses: courses.length,
      blocks: blocks.length,
      restarts,
      nodes,
      saIterations,
      softCostBefore: Number(softCostBefore.toFixed(2)),
      softCostAfter: Number(softCostAfter.toFixed(2)),
      saCurve,
      seconds,
      seed,
      constraints: { ...ctx.constraints },
      params: { ...ctx.params },
    },
  };
}
