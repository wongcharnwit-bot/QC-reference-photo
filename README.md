# QC Photo App — เวอร์ชัน Static (ไม่ต้องใช้ Node.js)

เวอร์ชันนี้ใช้ HTML + JavaScript ล้วนๆ ไม่ต้องติดตั้ง Node.js บนเครื่อง

## โฟลเดอร์ที่ใช้ deploy

```
deploy/
├── index.html
├── config.js          ← ต้องสร้างจาก config.example.js
├── css/style.css
├── js/app.js
└── vercel.json
```

> **หมายเหตุ:** โฟลเดอร์ `dist` ที่มีอยู่เป็นแอปอื่น (Production Efficiency Dashboard) ไม่ใช่ QC Photo App

---

## ขั้นตอนติดตั้ง (ไม่ต้องใช้ Node.js)

### 1. ตั้งค่า Supabase

1. สร้าง Project ที่ https://supabase.com
2. รัน SQL จาก `supabase/schema.sql` ใน SQL Editor
3. สร้าง User ใน Authentication > Users
4. ตั้ง QC role:
   ```sql
   update public.profiles set role = 'qc' where email = 'qc@company.com';
   ```

### 2. ตั้งค่า config

1. คัดลอก `config.example.js` เป็น `config.js`
2. ใส่ค่าจาก Supabase Dashboard > Project Settings > API:
   ```js
   window.SUPABASE_URL = "https://xxxxx.supabase.co";
   window.SUPABASE_ANON_KEY = "your-anon-key";
   ```

### 3. Deploy บน Vercel (ไม่ต้องใช้ Node.js)

**วิธีที่ 1: Drag & Drop**
1. เปิด https://vercel.com
2. สร้าง Project ใหม่
3. เลือก **Deploy without Git**
4. ลากโฟลเดอร์ `deploy` ทั้งโฟลเดอร์ขึ้นไป
5. ได้ URL ใช้งานทันที

**วิธีที่ 2: ผ่าน GitHub**
1. Push โฟลเดอร์ `deploy` ขึ้น GitHub
2. Import ใน Vercel
3. ตั้ง Root Directory เป็น `deploy`
4. Framework Preset: **Other** (ไม่ต้อง build)

---

## ทดสอบบนมือถือ

เปิด URL จาก Vercel บนมือถือ → Add to Home Screen → ใช้เหมือนแอป

---

## เปรียบเทียบ 2 เวอร์ชัน

| | `src/` (Next.js) | `deploy/` (Static) |
|---|---|---|
| ต้องใช้ Node.js | ✅ ใช่ | ❌ ไม่ต้อง |
| Deploy Vercel | ต้อง build | อัปโหลดได้เลย |
| ฟีเจอร์ | เหมือนกัน | เหมือนกัน |

**แนะนำ:** ใช้โฟลเดอร์ `deploy/` สำหรับเครื่องที่ลง Node.js ไม่ได้
