import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './paths.js';
import { httpError } from './store.js';

const HUB_PATH = path.join(DATA_DIR, 'teacher-hub.json');

function loadHub() {
  try {
    if (fs.existsSync(HUB_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(HUB_PATH, 'utf8'));
      return {
        requests: Array.isArray(parsed.requests) ? parsed.requests : [],
        unavailability: parsed.unavailability && typeof parsed.unavailability === 'object' ? parsed.unavailability : {},
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      };
    }
  } catch {
    // ignore
  }
  return { requests: [], unavailability: {}, notes: [] };
}

function saveHub(hub) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(HUB_PATH, JSON.stringify(hub, null, 2), 'utf8');
  return hub;
}

export function listRequests(user) {
  const hub = loadHub();
  if (user.role === 'admin') return hub.requests;
  return hub.requests.filter((r) => r.teacher_id === user.teacher_id || r.username === user.username);
}

export function createRequest(user, body) {
  const hub = loadHub();
  const item = {
    id: crypto.randomUUID(),
    username: user.username,
    teacher_id: user.teacher_id || body.teacher_id || '',
    teacher_name: user.name,
    kind: body.kind || 'move',
    fromDay: body.fromDay || '',
    fromPeriod: Number(body.fromPeriod) || 1,
    length: Number(body.length) || 1,
    toDay: body.toDay || '',
    toPeriod: Number(body.toPeriod) || 1,
    room_id: body.room_id || '',
    subject_id: body.subject_id || '',
    reason: String(body.reason || '').trim(),
    status: 'pending',
    adminNote: '',
    createdAt: new Date().toISOString(),
  };
  hub.requests.unshift(item);
  saveHub(hub);
  return item;
}

export function deleteRequest(user, id) {
  const hub = loadHub();
  const idx = hub.requests.findIndex((r) => r.id === id);
  if (idx === -1) throw httpError(404, 'ไม่พบคำขอ');
  if (user.role !== 'admin' && hub.requests[idx].username !== user.username) {
    throw httpError(403, 'ไม่มีสิทธิ์ลบคำขอนี้');
  }
  hub.requests.splice(idx, 1);
  saveHub(hub);
  return { deleted: id };
}

export function updateRequestStatus(id, status, adminNote = '') {
  const hub = loadHub();
  const item = hub.requests.find((r) => r.id === id);
  if (!item) throw httpError(404, 'ไม่พบคำขอ');
  item.status = status;
  item.adminNote = String(adminNote || '').trim();
  item.resolvedAt = new Date().toISOString();
  saveHub(hub);
  return item;
}

export function getUnavailability(user) {
  const hub = loadHub();
  if (user.role === 'admin') return hub.unavailability;
  const tid = user.teacher_id || user.username;
  return { [tid]: hub.unavailability[tid] || { slots: [], datedSlots: [], status: 'approved' } };
}

export function saveUnavailability(user, body) {
  const hub = loadHub();
  const tid = (user.role === 'admin' && body.teacher_id) ? body.teacher_id : (user.teacher_id || user.username);
  const prev = hub.unavailability[tid] || { slots: [], datedSlots: [], status: 'pending' };
  const next = {
    slots: Array.isArray(body.slots) ? body.slots : prev.slots,
    datedSlots: Array.isArray(body.datedSlots) ? body.datedSlots : prev.datedSlots,
    reason: body.reason !== undefined ? String(body.reason).trim() : (prev.reason || ''),
    status: user.role === 'admin' ? 'approved' : 'pending',
    updatedAt: new Date().toISOString(),
  };
  hub.unavailability[tid] = next;
  saveHub(hub);
  return next;
}

export function setUnavailabilityStatus(teacherId, status, adminNote = '') {
  const hub = loadHub();
  const rec = hub.unavailability[teacherId] || { slots: [], datedSlots: [] };
  rec.status = status;
  rec.adminNote = String(adminNote || '').trim();
  hub.unavailability[teacherId] = rec;
  saveHub(hub);
  return rec;
}

export function listNotes(user) {
  const hub = loadHub();
  return hub.notes.filter((n) => n.username === user.username);
}

export function createNote(user, body) {
  const hub = loadHub();
  const note = {
    id: crypto.randomUUID(),
    username: user.username,
    title: String(body.title || '').trim() || 'บันทึกใหม่',
    content: String(body.content || '').trim(),
    subject_id: body.subject_id || '',
    group_id: body.group_id || '',
    pinned: Boolean(body.pinned),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  hub.notes.unshift(note);
  saveHub(hub);
  return note;
}

export function updateNote(user, id, body) {
  const hub = loadHub();
  const note = hub.notes.find((n) => n.id === id && n.username === user.username);
  if (!note) throw httpError(404, 'ไม่พบบันทึก');
  if (body.title !== undefined) note.title = String(body.title).trim();
  if (body.content !== undefined) note.content = String(body.content).trim();
  if (body.subject_id !== undefined) note.subject_id = body.subject_id;
  if (body.group_id !== undefined) note.group_id = body.group_id;
  if (body.pinned !== undefined) note.pinned = Boolean(body.pinned);
  note.updatedAt = new Date().toISOString();
  saveHub(hub);
  return note;
}

export function deleteNote(user, id) {
  const hub = loadHub();
  const idx = hub.notes.findIndex((n) => n.id === id && n.username === user.username);
  if (idx === -1) throw httpError(404, 'ไม่พบบันทึก');
  hub.notes.splice(idx, 1);
  saveHub(hub);
  return { deleted: id };
}

export function pendingCounts() {
  const hub = loadHub();
  const pendingRequests = hub.requests.filter((r) => r.status === 'pending').length;
  const pendingUnavail = Object.values(hub.unavailability).filter((u) => u.status === 'pending').length;
  return { pendingRequests, pendingUnavail, teacherHubTotal: pendingRequests + pendingUnavail };
}
