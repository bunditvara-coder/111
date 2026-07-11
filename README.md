# ระบบเช็คชื่อเข้าเรียน (เวอร์ชันไฟล์แบนราบ — อัป GitHub ง่าย)

ทุกไฟล์อยู่ระดับเดียวกันหมด **ไม่มีโฟลเดอร์ย่อย** เพื่อให้ลากขึ้น GitHub ทีเดียวไม่หลุดโครงสร้าง

## อัปขึ้น GitHub (ผ่านเว็บ ไม่ต้อง run อะไร)
1. แตกไฟล์ zip นี้ออกมา — จะเห็นไฟล์ทั้งหมดกองรวมกัน ไม่มีโฟลเดอร์
2. เข้า repo บน GitHub → Add file → Upload files (หรือหน้า .../upload/main)
3. เข้าไปในโฟลเดอร์ที่แตกไว้ กด `Ctrl+A` เลือกทุกไฟล์ → ลากมาวางทั้งหมด
4. **Commit changes** (ถ้าชื่อซ้ำกับของเดิม มันจะเขียนทับให้ = อัปเดตเป็นเวอร์ชันที่ถูก)

## Netlify
- ผูก repo ไว้แล้วมันจะ deploy ใหม่เอง หรือกด **Retry → Clear cache and retry**
- Environment variables ต้องมี 2 ตัว:
  - `VITE_SUPABASE_URL` = https://xxxxxx.supabase.co
  - `VITE_SUPABASE_ANON_KEY` = sb_publishable_xxxxx (publishable key)
- **ไม่ต้องตั้ง Base directory** เพราะไฟล์อยู่ root แล้ว

## Supabase
- เปิด `schema.sql` คัดลอกทั้งหมด → Supabase → SQL Editor → Run (ตั้ง PIN อาจารย์ = 2468)

## แก้รายชื่อ/วิชา
- แก้ในไฟล์ `data.js`
