import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { subjectLabel, fmtTime, fmtDay } from "./data";
const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(URL && KEY);
export const supabase = configured ? createClient(URL, KEY) : null;

// เก็บ PIN อาจารย์ไว้ในหน่วยความจำหลัง verify สำเร็จ เพื่อส่งไปกับ RPC ของอาจารย์
let teacherKey = null;
export const setTeacherKey = (k) => { teacherKey = k; };

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

// ---------- อาจารย์ ----------
export async function verifyTeacher(key) {
  const ok = await rpc("verify_teacher", { p_key: key });
  return ok === true;
}
export async function startSession(subjectId) {
  const rows = await rpc("start_session", { p_subject_id: subjectId, p_teacher_key: teacherKey });
  const r = Array.isArray(rows) ? rows[0] : rows;
  return { id: r.id, subjectId: r.subject_id, no: r.no, active: r.active, createdAt: r.created_at };
}
export async function endSession(sessionId) {
  await rpc("end_session", { p_session_id: sessionId, p_teacher_key: teacherKey });
}
export async function currentCode(sessionId) {
  return rpc("current_code", { p_session_id: sessionId, p_teacher_key: teacherKey });
}
export async function listSessions(subjectId) {
  const rows = (await rpc("list_sessions", { p_subject_id: subjectId, p_teacher_key: teacherKey })) || [];
  return rows.map((r) => ({ id: r.id, subjectId: r.subject_id, no: r.no, active: r.active, createdAt: r.created_at, present: Number(r.present) }));
}
export async function listCheckins(sessionId) {
  const rows = (await rpc("list_checkins", { p_session_id: sessionId, p_teacher_key: teacherKey })) || [];
  const map = {};
  for (const r of rows) map[r.student_id] = { studentId: r.student_id, nickname: r.nickname, photo: r.photo_url, atISO: r.created_at, note: r.note || "" };
  return map;
}
export async function saveNote(sessionId, studentId, note) {
  await rpc("set_note", { p_session_id: sessionId, p_student_id: studentId, p_note: note, p_teacher_key: teacherKey });
}
async function sessionPresence(subjectId) {
  return (await rpc("session_presence", { p_subject_id: subjectId, p_teacher_key: teacherKey })) || [];
}
export async function deleteSession(sessionId) {
  // best-effort: ลบรูปใน storage ของคาบนี้ก่อน
  try {
    const { data: files } = await supabase.storage.from("selfies").list(sessionId);
    if (files && files.length) {
      await supabase.storage.from("selfies").remove(files.map((f) => `${sessionId}/${f.name}`));
    }
  } catch (e) { /* ไม่เป็นไร ข้ามได้ */ }
  await rpc("delete_session", { p_session_id: sessionId, p_teacher_key: teacherKey });
}

// ---------- รายชื่อนักเรียน (เก็บใน DB) ----------
export async function getRoster(subjectId) {
  const rows = (await rpc("list_students", { p_subject_id: subjectId })) || [];
  return rows.map((r) => {
    const title = r.title || "", first = r.first || "", last = r.last || "";
    return { id: r.student_id, title, first, last, name: `${title}${first}${last ? " " + last : ""}`.trim() };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
export async function addStudent(subjectId, id, title, first, last) {
  await rpc("add_student", { p_subject_id: subjectId, p_student_id: id, p_title: title, p_first: first, p_last: last, p_teacher_key: teacherKey });
}
export async function removeStudent(subjectId, id) {
  await rpc("remove_student", { p_subject_id: subjectId, p_student_id: id, p_teacher_key: teacherKey });
}

// ---------- นักเรียน ----------
export async function activeSession(subjectId) {
  const rows = (await rpc("active_session", { p_subject_id: subjectId })) || [];
  const r = Array.isArray(rows) ? rows[0] : rows;
  return r ? { id: r.id, no: r.no } : null;
}
export async function uploadPhoto(blob, sessionId, studentId) {
  const path = `${sessionId}/${studentId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("selfies").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error("อัปโหลดรูปไม่สำเร็จ: " + error.message);
  return supabase.storage.from("selfies").getPublicUrl(path).data.publicUrl;
}
export async function submitCheckin({ sessionId, studentId, title, first, last, nickname, photoUrl, code }) {
  return rpc("submit_checkin", {
    p_session_id: sessionId, p_student_id: studentId, p_title: title, p_first: first,
    p_last: last, p_nickname: nickname, p_photo_url: photoUrl, p_code: code,
  });
}

// ---------- Excel ----------
export async function exportSessionXlsx(subject, session) {
  const roster = await getRoster(subject.id);
  const checkins = await listCheckins(session.id);
  const aoa = [
    [`${subjectLabel(subject)} — ครั้งที่ ${session.no}`],
    [`วันที่ ${fmtTime(session.createdAt)}`], [],
    ["ลำดับ", "รหัสนักศึกษา", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่อเล่น", "สถานะ", "เวลาเช็คชื่อ", "หมายเหตุ"],
  ];
  roster.forEach((stu, i) => {
    const c = checkins[stu.id];
    aoa.push([i + 1, stu.id, stu.title, stu.first, stu.last, c?.nickname || "", c ? "มาเรียน" : "ขาด", c ? fmtTime(c.atISO) : "", c?.note || ""]);
  });
  const present = Object.keys(checkins).length;
  aoa.push([], ["", "", "", "", "", "มาเรียน", present, `ขาด ${roster.length - present}`, `จาก ${roster.length} คน`]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 9 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 9 }, { wch: 18 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `ครั้งที่ ${session.no}`);
  XLSX.writeFile(wb, `เช็คชื่อ_${subject.name}${subject.group ? "_" + subject.group : ""}_ครั้งที่${session.no}.xlsx`);
}

export async function exportSummaryXlsx(subject) {
  const roster = await getRoster(subject.id);
  const rows = await sessionPresence(subject.id);
  const sessMap = new Map();
  const presence = {};
  for (const r of rows) {
    if (!sessMap.has(r.session_id)) sessMap.set(r.session_id, { no: r.no, createdAt: r.created_at });
    (presence[r.session_id] ||= new Set()).add(r.student_id);
  }
  const sessions = [...sessMap.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => a.no - b.no);
  const head = ["ลำดับ", "รหัสนักศึกษา", "ชื่อ-นามสกุล", ...sessions.map((s) => `ครั้งที่ ${s.no} (${fmtDay(s.createdAt)})`), "รวมมา", "รวมขาด"];
  const aoa = [[`สรุปการเข้าเรียน — ${subjectLabel(subject)}`], [`ทั้งหมด ${sessions.length} ครั้ง`], [], head];
  roster.forEach((stu, i) => {
    let pc = 0;
    const cells = sessions.map((s) => { const ok = presence[s.id]?.has(stu.id); if (ok) pc++; return ok ? "/" : "-"; });
    aoa.push([i + 1, stu.id, stu.name, ...cells, pc, sessions.length - pc]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 30 }, ...sessions.map(() => ({ wch: 16 })), { wch: 8 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "สรุปเข้าเรียน");
  XLSX.writeFile(wb, `สรุปเข้าเรียน_${subject.name}${subject.group ? "_" + subject.group : ""}.xlsx`);
}
