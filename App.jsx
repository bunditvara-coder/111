import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  GraduationCap, Users, ArrowLeft, KeyRound, Camera, Check, X,
  Download, Radio, Clock, RefreshCw, ChevronRight, Hash, Trash2,
  FileSpreadsheet, ShieldCheck, UserCheck, User, Play, Square,
} from "lucide-react";
import { SUBJECTS, subjectById, subjectLabel, TONE, winIndex, fmtTime, fmtDay, compressImage, parseName } from "./data";
import {
  configured, verifyTeacher, setTeacherKey, startSession, endSession, currentCode,
  listSessions, listCheckins, saveNote, activeSession, uploadPhoto, submitCheckin,
  exportSessionXlsx, exportSummaryXlsx, deleteSession,
  getRoster, addStudent, removeStudent,
} from "./supabase";

function Shell({ children }) {
  return (
    <div className="min-h-screen w-full bg-slate-100 flex justify-center">
      <div className="w-full max-w-md bg-slate-50 min-h-screen shadow-xl relative overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}
function TopBar({ title, sub, onBack, right }) {
  return (
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center gap-3">
      {onBack && <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft size={20} /></button>}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-800 leading-tight truncate">{title}</div>
        {sub && <div className="text-xs text-slate-400 truncate">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function RoleSelect({ onPick }) {
  return (
    <div className="flex-1 flex flex-col px-6 pt-16 pb-10">
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 text-amber-500 mb-3">
          <div className="h-px w-8 bg-amber-400" /><span className="text-xs font-semibold tracking-[0.2em] uppercase">Attendance</span>
        </div>
        <h1 className="text-4xl font-black text-slate-800 leading-tight">เช็คชื่อ<br />เข้าเรียน</h1>
        <p className="text-slate-400 mt-3 text-sm">รหัสหมุนทุกนาที · ถ่ายรูปยืนยัน · สรุปเป็น Excel</p>
      </div>
      <div className="space-y-4 mt-auto">
        <button onClick={() => onPick("student")} className="w-full bg-slate-900 text-white rounded-2xl p-5 flex items-center gap-4 hover:bg-slate-800 transition active:scale-[0.99]">
          <div className="h-12 w-12 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center"><UserCheck size={24} /></div>
          <div className="text-left flex-1"><div className="font-bold text-lg">ฉันคือนักเรียน</div><div className="text-slate-400 text-xs">เช็คชื่อเข้าเรียน</div></div>
          <ChevronRight className="text-slate-500" />
        </button>
        <button onClick={() => onPick("teacher")} className="w-full bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-300 transition active:scale-[0.99]">
          <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><GraduationCap size={24} /></div>
          <div className="text-left flex-1"><div className="font-bold text-lg text-slate-800">ฉันคืออาจารย์</div><div className="text-slate-400 text-xs">เปิดคาบ · ดูรายชื่อ · ส่งออก</div></div>
          <ChevronRight className="text-slate-300" />
        </button>
      </div>
    </div>
  );
}

function TeacherGate({ onOk, onBack }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const ok = await verifyTeacher(pin);
      if (ok) { setTeacherKey(pin); onOk(); }
      else { setErr("PIN ไม่ถูกต้อง"); setPin(""); }
    } catch (e) { setErr("เชื่อมต่อไม่ได้: " + e.message); }
    setBusy(false);
  };
  return (
    <>
      <TopBar title="เข้าสู่โหมดอาจารย์" onBack={onBack} />
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
        <div className="h-16 w-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><KeyRound size={30} /></div>
        <div className="text-center"><div className="font-semibold text-slate-800">ใส่ PIN อาจารย์</div><div className="text-xs text-slate-400 mt-1">ป้องกันนักเรียนเข้าดูรายชื่อ</div></div>
        <input type="password" inputMode="numeric" autoFocus value={pin}
          onChange={(e) => { setErr(""); setPin(e.target.value); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={`w-full text-center text-2xl tracking-[0.5em] font-mono py-4 rounded-xl border-2 outline-none ${err ? "border-rose-400 bg-rose-50" : "border-slate-200 focus:border-indigo-400"}`} placeholder="••••" />
        {err && <div className="text-rose-500 text-sm -mt-3">{err}</div>}
        <button onClick={submit} disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition">{busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
      </div>
    </>
  );
}

function TeacherHome({ onBack, onOpenSubject }) {
  const [info, setInfo] = useState({});
  const refresh = useCallback(async () => {
    const out = {};
    for (const s of SUBJECTS) {
      try { const list = await listSessions(s.id); out[s.id] = { count: list.length, active: list.some((x) => x.active) }; }
      catch { out[s.id] = { count: "–", active: false }; }
    }
    setInfo(out);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <>
      <TopBar title="วิชาที่สอน" sub="เลือกวิชาเพื่อเปิดคาบหรือดูสรุป" onBack={onBack}
        right={<button onClick={refresh} className="p-2 text-slate-400 hover:text-slate-600"><RefreshCw size={18} /></button>} />
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {SUBJECTS.map((s) => {
          const t = TONE[s.tone];
          return (
            <button key={s.id} onClick={() => onOpenSubject(s.id)} className="w-full bg-white rounded-2xl border border-slate-200 p-4 text-left hover:shadow-md transition active:scale-[0.99]">
              <div className="flex items-start gap-3">
                <div className={`h-11 w-11 rounded-xl ${t.soft} ${t.text} flex items-center justify-center shrink-0`}><Users size={22} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 leading-tight">{s.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{s.group || "รายวิชาเดี่ยว"} · {s.roster.length} คน</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">สอนแล้ว {info[s.id]?.count ?? "…"} ครั้ง</span>
                    {info[s.id]?.active && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center gap-1"><Radio size={11} /> กำลังเปิดคาบ</span>}
                  </div>
                </div>
                <ChevronRight className="text-slate-300 shrink-0 mt-2" />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function SubjectDetail({ subjectId, onBack, onStartLive, onManage }) {
  const subject = subjectById(subjectId);
  const t = TONE[subject.tone];
  const [sessions, setSessions] = useState([]);
  const [rosterCount, setRosterCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { setSessions((await listSessions(subjectId)).sort((a, b) => b.no - a.no)); } catch {}
    try { setRosterCount((await getRoster(subjectId)).length); } catch {}
  }, [subjectId]);
  useEffect(() => { refresh(); }, [refresh]);

  const start = async () => {
    setBusy(true);
    try { const sess = await startSession(subjectId); onStartLive(sess); }
    catch (e) { alert("เปิดคาบไม่สำเร็จ: " + e.message); }
    setBusy(false);
  };
  const del = async (s) => {
    if (!window.confirm(`ลบคาบครั้งที่ ${s.no} พร้อมข้อมูลเช็คชื่อและรูปทั้งหมด?\nลบแล้วกู้คืนไม่ได้`)) return;
    try { await deleteSession(s.id); refresh(); }
    catch (e) { alert("ลบไม่สำเร็จ: " + e.message); }
  };
  const active = sessions.find((s) => s.active);
  return (
    <>
      <TopBar title={subject.name} sub={subject.group || "รายวิชาเดี่ยว"} onBack={onBack}
        right={<button onClick={refresh} className="p-2 text-slate-400 hover:text-slate-600"><RefreshCw size={18} /></button>} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {active ? (
          <button onClick={() => onStartLive(active)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-4 flex items-center gap-3 transition">
            <Radio size={22} /><div className="text-left flex-1"><div className="font-bold">กลับเข้าคาบที่กำลังเปิด</div><div className="text-xs text-emerald-100">ครั้งที่ {active.no} · เช็คแล้ว {active.present}/{rosterCount ?? "…"}</div></div><ChevronRight />
          </button>
        ) : (
          <button onClick={start} disabled={busy} className={`w-full ${t.bg} ${t.bgHover} text-white rounded-2xl p-4 flex items-center gap-3 transition disabled:opacity-60`}>
            <Play size={22} /><div className="text-left flex-1"><div className="font-bold">เปิดคาบเรียนใหม่</div><div className="text-xs text-white/70">จะเป็น “ครั้งที่ {sessions.length + 1}”</div></div><ChevronRight />
          </button>
        )}
        <button onClick={onManage} className="w-full bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 hover:border-slate-300 transition">
          <Users className={t.text} size={20} />
          <div className="text-left flex-1"><div className="font-semibold text-slate-700 text-sm">จัดการรายชื่อนักเรียน</div><div className="text-[11px] text-slate-400">เพิ่ม / ลบ รายชื่อเอง · ตอนนี้ {rosterCount ?? "…"} คน</div></div>
          <ChevronRight size={16} className="text-slate-400" />
        </button>
        <button onClick={() => exportSummaryXlsx(subject)} className="w-full bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 hover:border-slate-300 transition">
          <FileSpreadsheet className="text-emerald-600" size={20} />
          <div className="text-left flex-1"><div className="font-semibold text-slate-700 text-sm">ส่งออกสรุปทั้งเทอม (Excel)</div><div className="text-[11px] text-slate-400">ตารางมา/ขาด ทุกครั้งในไฟล์เดียว</div></div>
          <Download size={16} className="text-slate-400" />
        </button>
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 mb-2">ประวัติการสอน</div>
          {sessions.length === 0 && <div className="text-center text-slate-400 text-sm py-8 bg-white rounded-xl border border-dashed border-slate-200">ยังไม่มีคาบเรียน — กด “เปิดคาบเรียนใหม่” ด้านบน</div>}
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${t.soft} ${t.text} flex flex-col items-center justify-center shrink-0`}><span className="text-[9px] leading-none">ครั้ง</span><span className="font-bold leading-none">{s.no}</span></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 flex items-center gap-2">{fmtDay(s.createdAt)}{s.active && <span className="text-[10px] px-1.5 rounded bg-emerald-100 text-emerald-600">เปิดอยู่</span>}</div>
                  <div className="text-[11px] text-slate-400">มาเรียน {s.present}/{rosterCount ?? "…"} คน</div>
                </div>
                <button onClick={() => exportSessionXlsx(subject, s)} className="p-2 text-slate-400 hover:text-emerald-600" title="ส่งออกครั้งนี้"><Download size={18} /></button>
                <button onClick={() => del(s)} className="p-2 text-slate-300 hover:text-rose-500" title="ลบคาบนี้"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function CountRing({ secondsLeft }) {
  const r = 42, C = 2 * Math.PI * r, off = C * (1 - secondsLeft / 60);
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 1s linear" }} />
    </svg>
  );
}

function LiveSession({ session, onBack }) {
  const subject = subjectById(session.subjectId);
  const [now, setNow] = useState(Date.now());
  const [code, setCode] = useState("••••••");
  const [checkins, setCheckins] = useState({});
  const [roster, setRoster] = useState([]);
  const [viewStu, setViewStu] = useState(null);
  const lastWin = useRef(-1);

  useEffect(() => { getRoster(session.subjectId).then(setRoster).catch(() => {}); }, [session.subjectId]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const w = winIndex(now);
    if (w !== lastWin.current) { lastWin.current = w; currentCode(session.id).then(setCode).catch(() => {}); }
  }, [now, session.id]);
  useEffect(() => {
    let alive = true;
    const poll = async () => { try { const m = await listCheckins(session.id); if (alive) setCheckins(m); } catch {} };
    poll(); const t = setInterval(poll, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [session.id]);

  const secondsLeft = 60 - (Math.floor(now / 1000) % 60);
  const presentCount = Object.keys(checkins).length;
  const end = async () => { try { await endSession(session.id); } catch {} onBack(); };

  return (
    <>
      <TopBar title={subject.name} sub={`${subject.group ? subject.group + " · " : ""}ครั้งที่ ${session.no}`} onBack={onBack}
        right={<button onClick={end} className="text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1"><Square size={12} /> ปิดคาบ</button>} />
      <div className="bg-slate-900 px-6 pt-6 pb-7 text-center relative">
        <div className="text-slate-400 text-xs tracking-[0.25em] uppercase mb-4">รหัสเช็คชื่อ · ให้นักเรียนกรอก</div>
        <div className="flex items-center justify-center gap-5">
          <div className="relative h-16 w-16 shrink-0"><CountRing secondsLeft={secondsLeft} /><div className="absolute inset-0 flex items-center justify-center text-amber-400 font-bold text-lg">{secondsLeft}</div></div>
          <div className="font-mono text-[3.4rem] leading-none font-black text-amber-400 tracking-[0.15em] tabular-nums">{code}</div>
        </div>
        <div className="text-slate-500 text-xs mt-4 flex items-center justify-center gap-1.5"><Clock size={12} /> เปลี่ยนอัตโนมัติทุก 1 นาที — ฉายให้นักเรียนเห็น</div>
      </div>
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-around text-center">
        <div><div className="text-2xl font-bold text-emerald-600">{presentCount}</div><div className="text-[11px] text-slate-400">มาเรียน</div></div>
        <div className="h-8 w-px bg-slate-200" />
        <div><div className="text-2xl font-bold text-slate-300">{roster.length - presentCount}</div><div className="text-[11px] text-slate-400">ยังไม่เช็ค</div></div>
        <div className="h-8 w-px bg-slate-200" />
        <div><div className="text-2xl font-bold text-slate-700">{roster.length}</div><div className="text-[11px] text-slate-400">ทั้งหมด</div></div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {roster.map((stu) => {
          const c = checkins[stu.id];
          return (
            <div key={stu.id} onClick={() => c && setViewStu(stu.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${c ? "bg-emerald-50 border-emerald-100 cursor-pointer active:scale-[0.99]" : "bg-white border-slate-100"}`}>
              {c ? <img src={c.photo} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0 ring-2 ring-emerald-200" />
                 : <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-300"><User size={18} /></div>}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${c ? "text-slate-800" : "text-slate-400"}`}>{stu.name}{c?.nickname ? ` (${c.nickname})` : ""}</div>
                <div className="text-[11px] text-slate-400 font-mono">{stu.id}{c ? ` · ${(fmtTime(c.atISO).split(" ")[1] || "")}` : ""}</div>
              </div>
              {c ? <Check className="text-emerald-500 shrink-0" size={20} /> : <span className="text-[11px] text-slate-300 shrink-0">รอ</span>}
            </div>
          );
        })}
      </div>
      {viewStu && checkins[viewStu] && (
        <StudentDetailModal subject={subject} roster={roster} session={session} checkin={checkins[viewStu]} onClose={() => setViewStu(null)}
          onSaved={(upd) => setCheckins((m) => ({ ...m, [viewStu]: upd }))} />
      )}
    </>
  );
}

function StudentDetailModal({ subject, roster, session, checkin, onClose, onSaved }) {
  const stu = roster.find((s) => s.id === checkin.studentId);
  const [note, setNote] = useState(checkin.note || "");
  const [busy, setBusy] = useState(false);
  const doSave = async () => {
    setBusy(true);
    try { await saveNote(session.id, checkin.studentId, note); onSaved({ ...checkin, note }); onClose(); }
    catch (e) { alert("บันทึกไม่สำเร็จ: " + e.message); }
    setBusy(false);
  };
  return (
    <div className="absolute inset-0 z-20 bg-black/50 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl p-5 pb-8 max-h-[85%] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
        <img src={checkin.photo} alt="" className="w-full aspect-square object-cover rounded-2xl mb-4 bg-slate-100" />
        <div className="font-bold text-lg text-slate-800">{stu?.name}</div>
        <div className="text-sm text-slate-400 font-mono">{checkin.studentId} · ชื่อเล่น {checkin.nickname || "-"}</div>
        <div className="text-xs text-slate-400 mt-1">เช็คเมื่อ {fmtTime(checkin.atISO)}</div>
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-500">บันทึกของอาจารย์</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="เช่น มาสาย, แต่งกายไม่เรียบร้อย ฯลฯ" className="w-full mt-1 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-400 resize-none" />
        </div>
        <button onClick={doSave} disabled={busy} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl">{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </div>
    </div>
  );
}

function StudentFlow({ onBack }) {
  const [step, setStep] = useState("pick");
  const [subjectId, setSubjectId] = useState(null);
  const [session, setSession] = useState(null);
  const [doneName, setDoneName] = useState("");
  const pickSubject = async (sid) => {
    try {
      const active = await activeSession(sid);
      if (!active) { alert("ยังไม่มีคาบเรียนที่เปิดอยู่สำหรับวิชานี้\nรออาจารย์กด “เปิดคาบเรียน” ก่อนนะครับ"); return; }
      setSubjectId(sid); setSession({ id: active.id, subjectId: sid, no: active.no }); setStep("form");
    } catch (e) { alert("เชื่อมต่อไม่ได้: " + e.message); }
  };
  if (step === "done") return <StudentDone name={doneName} onBack={onBack} />;
  if (step === "form") return <StudentForm subject={subjectById(subjectId)} session={session} onBack={() => setStep("pick")} onDone={(name) => { setDoneName(name); setStep("done"); }} />;
  return <StudentPick onBack={onBack} onPick={pickSubject} />;
}

function StudentPick({ onBack, onPick }) {
  return (
    <>
      <TopBar title="เลือกวิชาที่จะเข้าเรียน" onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {SUBJECTS.map((s) => {
          const t = TONE[s.tone];
          return (
            <button key={s.id} onClick={() => onPick(s.id)} className="w-full bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 text-left hover:shadow-md transition active:scale-[0.99]">
              <div className={`h-11 w-11 rounded-xl ${t.soft} ${t.text} flex items-center justify-center shrink-0`}><GraduationCap size={22} /></div>
              <div className="flex-1"><div className="font-bold text-slate-800 leading-tight">{s.name}</div><div className="text-xs text-slate-400">{s.group || "รายวิชาเดี่ยว"}</div></div>
              <ChevronRight className="text-slate-300" />
            </button>
          );
        })}
      </div>
    </>
  );
}

function StudentForm({ subject, session, onBack, onDone }) {
  const [sid, setSid] = useState("");
  const [matched, setMatched] = useState(null);
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [photo, setPhoto] = useState(null); // { url, blob }
  const [roster, setRoster] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { getRoster(subject.id).then(setRoster).catch(() => {}); }, [subject.id]);
  useEffect(() => { if (sid.trim()) setMatched(roster.find((s) => s.id === sid.trim()) || null); }, [roster]);

  const onSid = (v) => { setSid(v); setErr(""); setMatched(roster.find((s) => s.id === v.trim()) || null); };
  const onPhoto = async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setPhoto(await compressImage(f)); } catch { setErr("อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง"); } };
  const submit = async () => {
    setErr("");
    if (!matched) return setErr("ไม่พบรหัสนักศึกษานี้ในวิชานี้");
    if (code.trim().length < 6) return setErr("กรอกรหัสเช็คชื่อ 6 หลักบนจอ");
    if (!photo) return setErr("กรุณาถ่ายรูปหน้าตัวเองในห้องเรียน");
    setBusy(true);
    try {
      const url = await uploadPhoto(photo.blob, session.id, matched.id);
      const res = await submitCheckin({ sessionId: session.id, studentId: matched.id, title: matched.title, first: matched.first, last: matched.last, nickname: nickname.trim(), photoUrl: url, code: code.trim() });
      if (!res?.ok) { setBusy(false); return setErr(res?.error || "เช็คชื่อไม่สำเร็จ"); }
      onDone(matched.name);
    } catch (e) { setBusy(false); setErr("เกิดข้อผิดพลาด: " + e.message); }
  };
  return (
    <>
      <TopBar title="เช็คชื่อเข้าเรียน" sub={`${subject.name} · ครั้งที่ ${session.no}`} onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><Hash size={16} /> รหัสนักศึกษา (เต็ม)</label>
          <input value={sid} onChange={(e) => onSid(e.target.value)} inputMode="numeric" placeholder="เช่น 67126616xxx" className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-mono outline-none focus:border-indigo-400" />
          {matched && <div className="mt-2 flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 text-sm"><Check size={16} /> {matched.name}</div>}
          {sid && !matched && <div className="mt-2 text-rose-500 text-xs">ไม่พบรหัสนี้ในรายชื่อวิชา</div>}
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><KeyRound size={16} /> รหัสเช็คชื่อบนจอ (6 หลัก)</label>
          <input value={code} onChange={(e) => { setErr(""); setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); }} inputMode="numeric" placeholder="000000" className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:border-indigo-400" />
          <div className="text-[11px] text-slate-400 mt-1">รหัสเปลี่ยนทุกนาที ต้องกรอกทันเวลา</div>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">ชื่อเล่น</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="ชื่อเล่นของคุณ" className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><Camera size={16} /> รูปถ่ายหน้าตัวเองในห้องเรียน</label>
          <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={onPhoto} className="hidden" />
          {photo ? (
            <div className="relative">
              <img src={photo.url} alt="selfie" className="w-full aspect-square object-cover rounded-2xl bg-slate-100" />
              <button onClick={() => fileRef.current?.click()} className="absolute bottom-3 right-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow"><RefreshCw size={14} /> ถ่ายใหม่</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="w-full aspect-[4/3] border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition"><Camera size={32} /><span className="text-sm font-medium">แตะเพื่อถ่ายรูป</span></button>
          )}
        </div>
        {err && <div className="bg-rose-50 text-rose-600 rounded-xl px-4 py-3 text-sm flex items-center gap-2"><X size={16} /> {err}</div>}
      </div>
      <div className="p-4 border-t border-slate-200 bg-white">
        <button onClick={submit} disabled={busy} className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition">{busy ? "กำลังส่ง…" : (<><ShieldCheck size={20} /> ยืนยันเช็คชื่อ</>)}</button>
      </div>
    </>
  );
}

function StudentDone({ name, onBack }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-5">
      <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center"><div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center text-white"><Check size={40} strokeWidth={3} /></div></div>
      <div><div className="text-2xl font-black text-slate-800">เช็คชื่อสำเร็จ</div><div className="text-slate-500 mt-1">{name}</div></div>
      <div className="text-sm text-slate-400">บันทึกเข้าระบบเรียบร้อยแล้ว</div>
      <button onClick={onBack} className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-6 py-3 rounded-xl">เสร็จสิ้น</button>
    </div>
  );
}

function ManageStudents({ subjectId, onBack }) {
  const subject = subjectById(subjectId);
  const t = TONE[subject.tone];
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sid, setSid] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setRoster(await getRoster(subjectId)); } catch (e) { setErr("โหลดรายชื่อไม่สำเร็จ: " + e.message); }
    setLoading(false);
  }, [subjectId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setErr("");
    const id = sid.trim();
    if (!id) return setErr("กรอกรหัสนักศึกษา");
    if (!name.trim()) return setErr("กรอกชื่อ-นามสกุล");
    const { title, first, last } = parseName(name.trim());
    setBusy(true);
    try {
      await addStudent(subjectId, id, title, first, last);
      setSid(""); setName(""); await load();
    } catch (e) { setErr("เพิ่มไม่สำเร็จ: " + e.message); }
    setBusy(false);
  };
  const remove = async (stu) => {
    if (!window.confirm(`ลบ ${stu.name} (${stu.id}) ออกจากรายชื่อ?`)) return;
    try { await removeStudent(subjectId, stu.id); await load(); }
    catch (e) { alert("ลบไม่สำเร็จ: " + e.message); }
  };

  return (
    <>
      <TopBar title="จัดการรายชื่อนักเรียน" sub={subjectLabel(subject)} onBack={onBack}
        right={<button onClick={load} className="p-2 text-slate-400 hover:text-slate-600"><RefreshCw size={18} /></button>} />
      {/* ฟอร์มเพิ่ม */}
      <div className="bg-white border-b border-slate-200 p-4 space-y-2">
        <input value={sid} onChange={(e) => { setErr(""); setSid(e.target.value); }} inputMode="numeric" placeholder="รหัสนักศึกษา เช่น 67126616xxx"
          className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 font-mono text-sm outline-none focus:border-indigo-400" />
        <input value={name} onChange={(e) => { setErr(""); setName(e.target.value); }} placeholder="ชื่อ-นามสกุล เช่น นางสาวสมหญิง ใจดี"
          className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
        {err && <div className="text-rose-500 text-xs">{err}</div>}
        <button onClick={add} disabled={busy} className={`w-full ${t.bg} ${t.bgHover} text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60`}>{busy ? "กำลังเพิ่ม…" : "+ เพิ่มนักเรียน"}</button>
        <div className="text-[11px] text-slate-400">ใส่คำนำหน้า (นาย/นางสาว/นาง) หน้าชื่อได้เลย ระบบแยกให้อัตโนมัติ · รหัสซ้ำจะอัปเดตชื่อเดิม</div>
      </div>
      {/* รายชื่อ */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-xs font-semibold text-slate-400 px-1 mb-2">ทั้งหมด {roster.length} คน</div>
        {loading ? (
          <div className="text-center text-slate-400 text-sm py-8">กำลังโหลด…</div>
        ) : roster.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8 bg-white rounded-xl border border-dashed border-slate-200">ยังไม่มีรายชื่อ — เพิ่มด้านบน</div>
        ) : (
          <div className="space-y-1.5">
            {roster.map((stu, i) => (
              <div key={stu.id} className="bg-white rounded-xl border border-slate-100 px-3 py-2 flex items-center gap-3">
                <div className="text-[11px] text-slate-300 w-6 text-right shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{stu.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{stu.id}</div>
                </div>
                <button onClick={() => remove(stu)} className="p-2 text-slate-300 hover:text-rose-500" title="ลบ"><Trash2 size={17} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function NotConfigured() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
      <div className="h-16 w-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center"><KeyRound size={30} /></div>
      <div className="font-bold text-slate-800 text-lg">ยังไม่ได้ตั้งค่า Supabase</div>
      <p className="text-sm text-slate-500">สร้างไฟล์ <code className="bg-slate-100 px-1 rounded">.env</code> แล้วใส่ค่า<br /><code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_URL</code> และ <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code><br />ดูขั้นตอนใน README.md</p>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState({ v: "role" });
  const go = (v, data = {}) => setRoute({ v, ...data });
  if (!configured) return <Shell><NotConfigured /></Shell>;
  let content;
  switch (route.v) {
    case "role": content = <RoleSelect onPick={(r) => go(r === "teacher" ? "gate" : "student")} />; break;
    case "gate": content = <TeacherGate onOk={() => go("tHome")} onBack={() => go("role")} />; break;
    case "tHome": content = <TeacherHome onBack={() => go("role")} onOpenSubject={(id) => go("tSubject", { subjectId: id })} />; break;
    case "tSubject": content = <SubjectDetail subjectId={route.subjectId} onBack={() => go("tHome")} onStartLive={(sess) => go("tLive", { session: sess })} onManage={() => go("tStudents", { subjectId: route.subjectId })} />; break;
    case "tStudents": content = <ManageStudents subjectId={route.subjectId} onBack={() => go("tSubject", { subjectId: route.subjectId })} />; break;
    case "tLive": content = <LiveSession session={route.session} onBack={() => go("tSubject", { subjectId: route.session.subjectId })} />; break;
    case "student": content = <StudentFlow onBack={() => go("role")} />; break;
    default: content = <RoleSelect onPick={(r) => go(r === "teacher" ? "gate" : "student")} />;
  }
  return <Shell>{content}</Shell>;
}
