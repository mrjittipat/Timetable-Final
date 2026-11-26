export const ENTITIES = {
  teacher: {
    file: 'teacher.csv',
    aliases: ['teacher', 'teachers'],
    fields: ['teacher_id', 'teacher_name', 'role'],
    key: ['teacher_id'],
    int: [],
  },
  room: {
    file: 'room.csv',
    aliases: ['room', 'rooms'],
    fields: ['room_id', 'room_name', 'room_type', 'capacity', 'sport_tag'],
    key: ['room_id'],
    int: ['capacity'],
  },
  student_group: {
    file: 'student_group.csv',
    aliases: ['student_group', 'student_groups', 'group', 'groups'],
    fields: ['group_id', 'group_name', 'student_count', 'advisor', 'year', 'home_room'],
    key: ['group_id'],
    int: ['student_count', 'year'],
  },
  subject: {
    file: 'subject.csv',
    aliases: ['subject', 'subjects'],
    fields: [
      'subject_id', 'subject_name', 'theory', 'practice', 'credit',
      'group_type', 'credit_raw', 'year', 'special_mode', 'elective_set', 'sport_tag',
    ],
    key: ['subject_id'],
    int: ['theory', 'practice', 'credit', 'year'],
  },
  teach: {
    file: 'teach.csv',
    aliases: ['teach', 'teaches'],
    fields: ['teacher_id', 'subject_id'],
    key: ['teacher_id', 'subject_id'],
    int: [],
  },
  timeslot: {
    file: 'timeslot.csv',
    aliases: ['timeslot', 'timeslots'],
    fields: ['timeslot_id', 'day', 'period', 'start', 'end'],
    key: ['timeslot_id'],
    int: ['period'],
  },
  register: {
    file: 'register.csv',
    aliases: ['register', 'registers', 'registration'],
    fields: ['group_id', 'subject_id'],
    key: ['group_id', 'subject_id'],
    int: [],
  },
};

export const OUTPUT_FIELDS = ['group_id', 'timeslot_id', 'subject_id', 'teacher_id', 'room_id'];

export function entityFromFilename(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/\.(csv|xlsx|xls)$/i, '')
    .trim();
  for (const [entity, def] of Object.entries(ENTITIES)) {
    if (def.aliases.includes(base)) return entity;
  }
  return null;
}

export function rowKey(entity, row) {
  const def = ENTITIES[entity];
  if (!def) return '';
  return def.key.map((k) => String(row?.[k] ?? '').trim()).join('|');
}

export function normalizeRow(entity, raw = {}) {
  const def = ENTITIES[entity];
  const out = {};
  for (const field of def.fields) {
    const val = raw[field];
    if (def.int.includes(field)) {
      const n = Number(val);
      out[field] = Number.isFinite(n) ? Math.round(n) : 0;
    } else {
      out[field] = val == null ? '' : String(val).trim();
    }
  }
  return out;
}
