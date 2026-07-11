-- ============================================================
--  ระบบเช็คชื่อ — Supabase schema
--  วิธีใช้: เปิด Supabase > SQL Editor > วางทั้งหมดนี้ > Run
--  แก้ PIN อาจารย์ได้ที่บรรทัด app_config ด้านล่าง
-- ============================================================

-- ---------- ตาราง ----------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null,
  no int not null,
  secret text not null,              -- ความลับสำหรับคำนวณรหัสหมุน (ไม่เปิดให้ client อ่านตรง ๆ)
  active boolean not null default true,
  note text default '',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id text not null,
  title text, first text, last text,
  nickname text,
  photo_url text,
  code_used text,
  note text default '',
  created_at timestamptz not null default now(),
  unique (session_id, student_id)     -- กันเช็คซ้ำในคาบเดียว
);

create table if not exists app_config (
  key text primary key,
  value text not null
);

-- >>> ตั้ง PIN อาจารย์ตรงนี้ (เปลี่ยน '2468' เป็นอะไรก็ได้) <<<
insert into app_config (key, value) values ('teacher_key', '2468')
on conflict (key) do update set value = excluded.value;

-- ---------- ปิดการเข้าถึงตรง (ทุกอย่างผ่าน RPC เท่านั้น) ----------
alter table sessions   enable row level security;
alter table checkins   enable row level security;
alter table app_config enable row level security;
-- ไม่สร้าง policy ใด ๆ = anon อ่าน/เขียนตรงไม่ได้ ต้องผ่านฟังก์ชัน SECURITY DEFINER ด้านล่าง

-- ---------- คำนวณรหัส 6 หลักจาก secret + ช่วงเวลา (นาที) ----------
create or replace function calc_code(p_secret text, p_window bigint)
returns text language sql immutable as $$
  select lpad(
    ((('x' || substr(md5(p_secret || ':' || p_window), 1, 7))::bit(28)::int) % 1000000)::text,
    6, '0');
$$;

-- ---------- ตรวจ PIN อาจารย์ ----------
create or replace function verify_teacher(p_key text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from app_config where key = 'teacher_key' and value = p_key);
$$;

-- ---------- อาจารย์: เปิดคาบใหม่ (ปิดคาบเก่าอัตโนมัติ) ----------
create or replace function start_session(p_subject_id text, p_teacher_key text)
returns table (id uuid, subject_id text, no int, active boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_no int; v_id uuid;
begin
  if not verify_teacher(p_teacher_key) then raise exception 'unauthorized'; end if;
  update sessions set active = false, ended_at = now()
    where subject_id = p_subject_id and active = true;
  select coalesce(max(s.no), 0) + 1 into v_no from sessions s where s.subject_id = p_subject_id;
  insert into sessions (subject_id, no, secret)
    values (p_subject_id, v_no, gen_random_uuid()::text)
    returning sessions.id into v_id;
  return query select s.id, s.subject_id, s.no, s.active, s.created_at
    from sessions s where s.id = v_id;
end; $$;

-- ---------- อาจารย์: ดึงรหัสปัจจุบันของคาบ (เรียกทุกนาที) ----------
create or replace function current_code(p_session_id uuid, p_teacher_key text)
returns text language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  if not verify_teacher(p_teacher_key) then raise exception 'unauthorized'; end if;
  select secret into v_secret from sessions where id = p_session_id;
  if v_secret is null then raise exception 'no session'; end if;
  return calc_code(v_secret, floor(extract(epoch from now()) / 60)::bigint);
end; $$;

-- ---------- อาจารย์: รายการคาบของวิชา + จำนวนคนมา ----------
create or replace function list_sessions(p_subject_id text, p_teacher_key text)
returns table (id uuid, subject_id text, no int, active boolean, created_at timestamptz, present bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not verify_teacher(p_teacher_key) then raise exception 'unauthorized'; end if;
  return query
    select s.id, s.subject_id, s.no, s.active, s.created_at,
           (select count(*) from checkins c where c.session_id = s.id)
    from sessions s where s.subject_id = p_subject_id order by s.no desc;
end; $$;

-- ---------- อาจารย์: รายชื่อคนที่เช็คในคาบ ----------
create or replace function list_checkins(p_session_id uuid, p_teacher_key text)
returns table (student_id text, nickname text, photo_url text, created_at timestamptz, note text)
language plpgsql security definer set search_path = public as $$
begin
  if not verify_teacher(p_teacher_key) then raise exception 'unauthorized'; end if;
  return query
    select c.student_id, c.nickname, c.photo_url, c.created_at, c.note
    from checkins c where c.session_id = p_session_id order by c.student_id;
end; $$;

-- ---------- อาจารย์: การมาเรียนทุกคาบ (ไว้ทำตารางสรุป Excel) ----------
create or replace function session_presence(p_subject_id text, p_teacher_key text)
returns table (session_id uuid, no int, created_at timestamptz, student_id text)
language plpgsql security definer set search_path = public as $$
begin
  if not verify_teacher(p_teacher_key) then raise exception 'unauthorized'; end if;
  return query
    select s.id, s.no, s.created_at, c.student_id
    from sessions s join checkins c on c.session_id = s.id
    where s.subject_id = p_subject_id order by s.no;
end; $$;

-- ---------- อาจารย์: ปิดคาบ ----------
create or replace function end_session(p_session_id uuid, p_teacher_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not verify_teacher(p_teacher_key) then raise exception 'unauthorized'; end if;
  update sessions set active = false, ended_at = now() where id = p_session_id;
end; $$;

-- ---------- อาจารย์: บันทึกหมายเหตุรายคน ----------
create or replace function set_note(p_session_id uuid, p_student_id text, p_note text, p_teacher_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not verify_teacher(p_teacher_key) then raise exception 'unauthorized'; end if;
  update checkins set note = p_note
    where session_id = p_session_id and student_id = p_student_id;
end; $$;

-- ---------- นักเรียน: หาคาบที่เปิดอยู่ (ไม่เห็น secret) ----------
create or replace function active_session(p_subject_id text)
returns table (id uuid, no int) language sql security definer set search_path = public as $$
  select id, no from sessions
  where subject_id = p_subject_id and active = true
  order by created_at desc limit 1;
$$;

-- ---------- นักเรียน: ส่งเช็คชื่อ (ตรวจรหัสฝั่ง server) ----------
create or replace function submit_checkin(
  p_session_id uuid, p_student_id text, p_title text, p_first text, p_last text,
  p_nickname text, p_photo_url text, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_secret text; v_active boolean; w bigint;
begin
  select secret, active into v_secret, v_active from sessions where id = p_session_id;
  if v_secret is null then return json_build_object('ok', false, 'error', 'ไม่พบคาบเรียน'); end if;
  if not v_active then return json_build_object('ok', false, 'error', 'คาบเรียนปิดแล้ว'); end if;
  w := floor(extract(epoch from now()) / 60)::bigint;
  if p_code <> calc_code(v_secret, w) and p_code <> calc_code(v_secret, w - 1) then
    return json_build_object('ok', false, 'error', 'รหัสไม่ถูกต้องหรือหมดเวลา — ดูรหัสล่าสุดบนจอ');
  end if;
  if exists (select 1 from checkins where session_id = p_session_id and student_id = p_student_id) then
    return json_build_object('ok', false, 'error', 'รหัสนี้เช็คชื่อไปแล้วในคาบนี้');
  end if;
  insert into checkins (session_id, student_id, title, first, last, nickname, photo_url, code_used)
    values (p_session_id, p_student_id, p_title, p_first, p_last, p_nickname, p_photo_url, p_code);
  return json_build_object('ok', true);
end; $$;

-- ---------- สิทธิเรียกใช้ฟังก์ชัน ----------
grant execute on function
  verify_teacher(text), start_session(text,text), current_code(uuid,text),
  list_sessions(text,text), list_checkins(uuid,text), session_presence(text,text),
  end_session(uuid,text), set_note(uuid,text,text,text),
  active_session(text),
  submit_checkin(uuid,text,text,text,text,text,text,text)
to anon, authenticated;

-- ---------- ที่เก็บรูป (Storage bucket) ----------
insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', true)
on conflict (id) do nothing;

drop policy if exists "anon upload selfies" on storage.objects;
create policy "anon upload selfies" on storage.objects
  for insert to anon with check (bucket_id = 'selfies');

drop policy if exists "public read selfies" on storage.objects;
create policy "public read selfies" on storage.objects
  for select to anon, authenticated using (bucket_id = 'selfies');
