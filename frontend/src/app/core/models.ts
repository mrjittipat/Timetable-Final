export type View = 'group' | 'teacher' | 'room';

export interface User {
  username: string;
  name: string;
  role: 'admin' | 'teacher' | 'viewer';
  teacher_id?: string;
  avatar?: string;
  status?: string;
  mustChangePassword?: boolean;
  createdAt?: string;
}

export interface WarningItem {
  level: 'warn' | 'error';
  message: string;
}

export interface EntitySchema {
  file: string;
  aliases: string[];
  fields: string[];
  key: string[];
  int: string[];
}

export interface DataResponse {
  data: Record<string, Record<string, any>[]>;
  schema: Record<string, EntitySchema>;
  warnings: WarningItem[];
  summary: {
    teachers: number;
    leaders: number;
    rooms: number;
    groups: number;
    activeGroups: number;
    subjects: number;
    registrations: number;
    timeslots: number;
    totalPeriods: number;
  };
}

export interface OutputRow {
  group_id: string;
  timeslot_id: string;
  subject_id: string;
  teacher_id: string;
  room_id: string;
}

export interface CheckResult {
  id: string;
  no: number;
  name: string;
  type: 'integrity' | 'basic' | 'special';
  enabled: boolean;
  passed: boolean;
  violationCount: number;
  violations: string[];
}

export interface ValidationResult {
  passed: boolean;
  checks: CheckResult[];
  stats: { rows: number; groups: number };
}

export interface SolveStats {
  courses?: number;
  blocks?: number;
  restarts?: number;
  nodes?: number;
  saIterations?: number;
  softCostBefore?: number;
  softCostAfter?: number;
  saCurve?: { iter: number; cost: number }[];
  seconds?: number;
  seed?: number;
  baseSeed?: number;
  isSnapshot?: boolean;
  bestOf?: number;
  constraints?: Record<string, boolean>;
  params?: Record<string, any>;
}

export interface SavedSeed {
  id: string;
  name: string;
  note?: string;
  tags?: string[];
  pinned?: boolean;
  seed: number;
  baseSeed?: number;
  source?: string;
  isSnapshot?: boolean;
  constraints: Record<string, boolean>;
  params: Record<string, any>;
  softCost?: number | null;
  validationPassed?: boolean | null;
  rowsCount?: number;
  savedBy?: string;
  savedAt?: string;
  updatedAt?: string;
}

export interface DocumentInfo {
  college: string;
  semester: string;
  year: string;
  curriculumHeadName: string;
  deputyName: string;
  directorName: string;
  publicEnabled: boolean;
  publicBaseUrl: string;
}

export interface Config {
  constraints: Record<string, boolean>;
  params: Record<string, any>;
  document: DocumentInfo;
  appearance: Record<string, any>;
  savedSeeds: SavedSeed[];
  savedProfiles: any[];
  updatedAt?: string | null;
}

export interface TimetableResponse {
  rows: OutputRow[];
  meta: { stats?: SolveStats; validationPassed?: boolean; source?: string; updatedAt?: string } | null;
  validation: ValidationResult | null;
}

export interface SolveResponse {
  status: 'success' | 'failed';
  message: string;
  rows: OutputRow[];
  warnings?: WarningItem[];
  errors?: string[];
  stats?: SolveStats;
  validation?: ValidationResult | null;
  log?: string[];
}

export interface EntityRef {
  id: string;
  role?: string;
  isLeader?: boolean;
  title: string;
  subtitle: string;
  heading: string;
  info: [string, string][];
  signer: string;
  signerName: string;
}

export interface GridSpan {
  start: number;
  span: number;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher: string;
  room: string;
  room_name?: string;
  groups: string[];
  group_labels?: string[];
  clash: boolean;
}

export interface Grid {
  entity?: EntityRef | null;
  days: { key: string; label: string }[];
  periods: { period: number; start: string; end: string; isBreak: boolean }[];
  cells: GridSpan[][];
  total: number;
  subjects?: { list: { subject_id: string; name: string; t: number; p: number; n: number; h: number }[]; total: { t: number; p: number; n: number; h: number } };
}
