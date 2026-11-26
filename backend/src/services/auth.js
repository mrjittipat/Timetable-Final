import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths.js';
import { httpError } from './store.js';

const USERS_PATH = path.join(DATA_DIR, 'users.json');
export const ROLES = ['admin', 'teacher', 'viewer'];
export const DEFAULT_ADMIN = { username: 'admin', password: 'admin1234' };
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

let users = [];
const sessions = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const derived = crypto.scryptSync(String(password), salt, 64);
  const target = Buffer.from(hash, 'hex');
  if (derived.length !== target.length) return false;
  return crypto.timingSafeEqual(derived, target);
}

function saveUsers() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
}

export function publicUser(u) {
  if (!u) return null;
  return {
    username: u.username,
    name: u.name,
    role: u.role,
    teacher_id: u.teacher_id || '',
    avatar: u.avatar || '',
    status: u.status || 'active',
    mustChangePassword: Boolean(u.mustChangePassword),
    createdAt: u.createdAt || null,
  };
}

export function initAuth() {
  try {
    if (fs.existsSync(USERS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
      if (Array.isArray(parsed)) users = parsed;
    }
  } catch {
    users = [];
  }
  const hasAdmin = users.some((u) => u.role === 'admin' && (u.status || 'active') === 'active');
  if (!hasAdmin) {
    const { salt, hash } = hashPassword(DEFAULT_ADMIN.password);
    users.unshift({
      username: DEFAULT_ADMIN.username,
      name: 'ผู้ดูแลระบบ',
      role: 'admin',
      teacher_id: '',
      avatar: '',
      status: 'active',
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      salt,
      hash,
    });
    saveUsers();
  }
}

export function isDefaultAdminActive() {
  const admin = users.find((u) => u.username === DEFAULT_ADMIN.username);
  if (!admin) return false;
  return verifyPassword(DEFAULT_ADMIN.password, admin.salt, admin.hash);
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

export function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.tt_session;
  if (!token) return null;
  const sess = sessions.get(token);
  if (!sess) return null;
  if (sess.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  const u = users.find((x) => x.username === sess.username);
  if (!u || (u.status && u.status !== 'active')) return null;
  return u;
}

export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `tt_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'tt_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

function dropUserSessions(username) {
  for (const [tok, sess] of sessions.entries()) {
    if (sess.username === username) sessions.delete(tok);
  }
}

export function login(username, password, res) {
  const uname = String(username || '').trim();
  const u = users.find((x) => x.username === uname);
  if (!u || !verifyPassword(password, u.salt, u.hash)) {
    throw httpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  if (u.status === 'pending') {
    const err = httpError(403, 'บัญชีนี้อยู่ระหว่างรออนุมัติจากผู้ดูแลระบบ');
    err.code = 'PENDING_APPROVAL';
    err.pendingUser = { username: u.username, name: u.name };
    throw err;
  }
  if (u.status === 'rejected') {
    throw httpError(403, 'คำขอสมัครบัญชีนี้ไม่ได้รับการอนุมัติ');
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username: u.username, expires: Date.now() + SESSION_TTL_MS });
  setSessionCookie(res, token);
  return publicUser(u);
}

export function logout(req, res) {
  const cookies = parseCookies(req);
  if (cookies.tt_session) sessions.delete(cookies.tt_session);
  clearSessionCookie(res);
}

export function listUsers() {
  return users.map(publicUser);
}

export function createUser({ username, name, password, role = 'teacher', teacher_id = '', avatar = '', mustChangePassword = false, status = 'active' }) {
  const uname = String(username || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(uname)) {
    throw httpError(400, 'ชื่อผู้ใช้ต้องยาว 3–32 ตัวอักษร (a-z, 0-9, ., _, -)');
  }
  if (users.some((u) => u.username === uname)) {
    throw httpError(409, `มีชื่อผู้ใช้ ${uname} อยู่แล้ว`);
  }
  const cleanName = String(name || '').trim();
  if (!cleanName || cleanName.length > 80) throw httpError(400, 'กรุณาระบุชื่อที่แสดง (1–80 ตัวอักษร)');
  if (!ROLES.includes(role)) throw httpError(400, 'สิทธิ์ผู้ใช้ไม่ถูกต้อง');
  if (!password || String(password).length < 6) throw httpError(400, 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
  validateAvatar(avatar);

  const { salt, hash } = hashPassword(password);
  const rec = {
    username: uname,
    name: cleanName,
    role,
    teacher_id: String(teacher_id || '').trim(),
    avatar: avatar || '',
    status,
    mustChangePassword: Boolean(mustChangePassword),
    createdAt: new Date().toISOString(),
    salt,
    hash,
  };
  users.push(rec);
  saveUsers();
  return publicUser(rec);
}

export function registerTeacher({ username, name, password, teacher_id, role = 'teacher' }) {
  if (role === 'viewer') throw httpError(400, 'ผู้ชมทั่วไปสามารถเข้าดูตารางสาธารณะที่หน้า /p ได้โดยไม่ต้องสมัครสมาชิก');
  if (role !== 'teacher') throw httpError(400, 'อนุญาตให้สมัครด้วยตนเองเฉพาะบัญชีอาจารย์ผู้สอนเท่านั้น');
  return createUser({
    username,
    name,
    password,
    role: 'teacher',
    teacher_id,
    mustChangePassword: false,
    status: 'pending',
  });
}

export function updateUser(targetUsername, patch = {}, actorUsername = '') {
  const u = users.find((x) => x.username === targetUsername);
  if (!u) throw httpError(404, `ไม่พบผู้ใช้ ${targetUsername}`);

  if (patch.name !== undefined) {
    const clean = String(patch.name || '').trim();
    if (!clean || clean.length > 80) throw httpError(400, 'กรุณาระบุชื่อที่แสดง (1–80 ตัวอักษร)');
    u.name = clean;
  }
  if (patch.role !== undefined) {
    if (!ROLES.includes(patch.role)) throw httpError(400, 'สิทธิ์ผู้ใช้ไม่ถูกต้อง');
    if (u.role === 'admin' && patch.role !== 'admin') {
      const adminCount = users.filter((x) => x.role === 'admin' && (x.status || 'active') === 'active').length;
      if (adminCount <= 1) throw httpError(400, 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 บัญชี');
    }
    u.role = patch.role;
  }
  if (patch.teacher_id !== undefined) u.teacher_id = String(patch.teacher_id || '').trim();
  if (patch.avatar !== undefined) {
    validateAvatar(patch.avatar);
    u.avatar = patch.avatar || '';
  }
  if (patch.mustChangePassword !== undefined) {
    u.mustChangePassword = Boolean(patch.mustChangePassword);
  }
  if (patch.password) {
    if (String(patch.password).length < 6) throw httpError(400, 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
    const { salt, hash } = hashPassword(patch.password);
    u.salt = salt;
    u.hash = hash;
    if (actorUsername && actorUsername !== targetUsername) {
      u.mustChangePassword = true;
      dropUserSessions(targetUsername);
    }
  }
  saveUsers();
  return publicUser(u);
}

export function approveUser(username, teacher_id) {
  const u = users.find((x) => x.username === username);
  if (!u) throw httpError(404, `ไม่พบผู้ใช้ ${username}`);
  u.status = 'active';
  if (teacher_id !== undefined) u.teacher_id = String(teacher_id || '').trim();
  saveUsers();
  return publicUser(u);
}

export function rejectUser(username) {
  const u = users.find((x) => x.username === username);
  if (!u) throw httpError(404, `ไม่พบผู้ใช้ ${username}`);
  u.status = 'rejected';
  dropUserSessions(username);
  saveUsers();
  return publicUser(u);
}

export function deleteUser(targetUsername, actorUsername) {
  if (targetUsername === actorUsername) throw httpError(400, 'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้');
  const idx = users.findIndex((x) => x.username === targetUsername);
  if (idx === -1) throw httpError(404, `ไม่พบผู้ใช้ ${targetUsername}`);
  if (users[idx].role === 'admin') {
    const adminCount = users.filter((x) => x.role === 'admin' && (x.status || 'active') === 'active').length;
    if (adminCount <= 1) throw httpError(400, 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 บัญชี');
  }
  users.splice(idx, 1);
  dropUserSessions(targetUsername);
  saveUsers();
  return { deleted: targetUsername };
}

function validateAvatar(avatar) {
  if (!avatar) return;
  const s = String(avatar);
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) {
    throw httpError(400, 'รูปโปรไฟล์ต้องเป็น PNG, JPEG หรือ WebP ขนาดไม่เกิน 200 KB');
  }
  const b64 = s.split(',')[1] || '';
  const bytes = Math.ceil((b64.length * 3) / 4);
  if (bytes > 200 * 1024) {
    throw httpError(400, 'รูปโปรไฟล์ต้องเป็น PNG, JPEG หรือ WebP ขนาดไม่เกิน 200 KB');
  }
}

export function updateProfile(username, { name, avatar }) {
  const u = users.find((x) => x.username === username);
  if (!u) throw httpError(404, 'ไม่พบผู้ใช้งาน');
  if (name !== undefined) {
    const clean = String(name || '').trim();
    if (!clean || clean.length > 80) throw httpError(400, 'ชื่อที่แสดงต้องยาว 1–80 ตัวอักษร');
    u.name = clean;
  }
  if (avatar !== undefined) {
    validateAvatar(avatar);
    u.avatar = avatar || '';
  }
  saveUsers();
  return publicUser(u);
}

export function changeOwnPassword(username, currentPassword, nextPassword) {
  const u = users.find((x) => x.username === username);
  if (!u) throw httpError(404, 'ไม่พบผู้ใช้งาน');
  if (!verifyPassword(currentPassword, u.salt, u.hash)) {
    throw httpError(400, 'รหัสผ่านเดิมไม่ถูกต้อง');
  }
  if (!nextPassword || String(nextPassword).length < 6) {
    throw httpError(400, 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร');
  }
  if (nextPassword === currentPassword) {
    throw httpError(400, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
  }
  const { salt, hash } = hashPassword(nextPassword);
  u.salt = salt;
  u.hash = hash;
  u.mustChangePassword = false;
  saveUsers();
  return publicUser(u);
}

export function guard(req, res, next) {
  const p = req.path;
  if (
    p === '/health' ||
    p === '/auth/login' ||
    p === '/auth/logout' ||
    p === '/auth/me' ||
    p === '/auth/register' ||
    p === '/auth/register-options' ||
    p.startsWith('/public/')
  ) {
    req.user = getSessionUser(req);
    return next();
  }

  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });
  }
  req.user = user;

  const isRead = req.method === 'GET' || req.method === 'HEAD';
  const openSelfWrite =
    p === '/auth/password' ||
    p === '/auth/profile' ||
    p === '/chat' ||
    p.startsWith('/teacher/');

  if (!isRead && !openSelfWrite && user.role !== 'admin') {
    return res.status(403).json({ message: 'บัญชีนี้ดูข้อมูลได้อย่างเดียว เฉพาะผู้ดูแลระบบที่แก้ไขได้' });
  }
  return next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'เฉพาะผู้ดูแลระบบ' });
  }
  return next();
}
