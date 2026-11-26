<div align="center">

# 📅 Smart AI Timetable Scheduler
### ระบบจัดตารางเรียน–ตารางสอนอัตโนมัติด้วยปัญญาประดิษฐ์

[![Node.js](https://img.shields.io/badge/Node.js-24%20ESM-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Offline](https://img.shields.io/badge/100%25-Offline%20Capable-800020)](#)

เว็บแอปพลิเคชันจัดตารางเรียน–ตารางสอนอัตโนมัติแบบ Full-Stack ใช้ **CSP Search (MRV + Forward Checking)** ร่วมกับ **Simulated Annealing** และตัวตรวจสอบเงื่อนไขแบบอิสระ (Independent Validator) รองรับการทำงานแบบออฟไลน์เต็มรูปแบบ พร้อมระบบบริหารจัดการข้อมูล อาจารย์ และเผยแพร่ตารางสาธารณะ

</div>

---

## ✨ ฟีเจอร์หลัก (Key Features)

### 🧠 ระบบจัดตารางอัตโนมัติ (AI Solver & Validator)
- **CSP Search + Simulated Annealing** — จัดตารางครบทุกเงื่อนไขแบบ Deterministic ด้วย Random Seed และค้นหา Seed ที่ดีที่สุดอัตโนมัติ (Best Seed Search)
- **ฟังก์ชันพิเศษ: จัดชิดคาบแรกก่อน (`packEarlyPeriods`)** — สวิตช์เปิด–ปิดจัดวางคาบเรียนชิดคาบ 1 (ช่วงเช้า) และคาบ 6 (หลังพักเที่ยง) โดยไม่ละเมิด Hard Constraints
- **ตัวตรวจเงื่อนไขแบบอิสระ (Independent Validator)** — ตรวจความถูกต้องทั้ง 10 เงื่อนไข + ความสมบูรณ์ของข้อมูล (`I0`) พร้อมเครื่องมือวิเคราะห์สาเหตุเมื่อจัดตารางไม่ได้ (Diagnose)
- **Offline AI Chatbot** — ผู้ช่วยภาษาไทยแบบออฟไลน์สำหรับสอบถามตารางเรียน หาห้องว่าง หาครูว่าง สั่งจัดตาราง หรือย้ายคาบ

### 🖐️ สตูดิโอจัดตารางสอนด้วยมือ (Manual Timetable Studio)
- ลาก–วาง หรือคลิกวางรายวิชาจากแถบรายวิชาฝั่งขวา พร้อมไฮไลต์ช่องสีเขียว/แดงแสดงข้อขัดแย้งแบบเรียลไทม์
- **Snapshot Seed แบบสด** — คำนวณและอัปเดตเลข Seed ใหม่ทันทีทุกครั้งที่มีการแก้ไข ย้าย หรือลบคาบ พร้อมระบบย้อนกลับ (Undo 30 ขั้นตอน)

### 👩‍🏫 ศูนย์บริการอาจารย์และคำขอย้ายคาบ (Teacher Portal & Hub)
- **มุมมองเฉพาะอาจารย์** — ภาพรวมกราฟภาระสอนรายวัน/รายกลุ่ม/รายวิชา, กลุ่มเรียนที่รับผิดชอบ และตารางสอนเฉพาะของตนเอง
- **ตารางขอย้าย / สลับ / หั่นคาบแบบโต้ตอบได้** — ลากวางทับเพื่อสลับวิชาหรือหั่นจำนวนคาบที่จะย้าย พร้อมดู **ตารางตัวอย่างหลังย้าย** และผลตรวจเงื่อนไขแบบสดก่อนส่งให้แอดมินอนุมัติ
- **บันทึกช่วยจำส่วนตัว** — แยกโหมด *บันทึกทั่วไป* และ *บันทึกรายวิชา* ตามวิชาที่อาจารย์สอน
- **ระบบสมัครสมาชิกอาจารย์** — แสดงขั้นตอนสถานะ 3 สเต็ป (*ส่งคำขอ → รอแอดมินอนุมัติ → ยืนยันเรียบร้อย*) พร้อมป้ายแจ้งเตือนจำนวนคำขอบนแถบ Sidebar ของผู้ดูแลระบบ

### 📊 การจัดการข้อมูล & การส่งออก (Data & Export)
- **นำเข้า/ส่งออกข้อมูลครบ 7 ตาราง** — รองรับ `.csv` และ `.xlsx`, ส่งออกชุดข้อมูลเดี่ยว (`.csv`), ส่งออกข้อมูลทั้งหมด (`.zip` แบ่งโฟลเดอร์ย่อย), ล้างข้อมูลเฉพาะตาราง/ทั้งหมด, จัดสรรครูที่ปรึกษาอัตโนมัติตามภาระสอนน้อยที่สุด
- **ส่งออกเอกสารครบวงจร** — **PDF** (ฟอนต์ Sarabun มาตรฐาน พร้อมตารางสรุปรายวิชา `น. บ. ป. ศ.` และช่องลงนาม), **Excel (`.xlsx`)**, **CSV**, **ปฏิทิน `.ics`**, และ **QR Code** สำหรับหน้าตารางเรียนสาธารณะ (`/p`)

### 🎨 สตูดิโอตกแต่งหน้าเว็บ (Appearance Studio)
- ปรับแต่งได้ทั้งระบบ 8 แท็บ พร้อม Live Preview: แบรนด์และ Sidebar, หน้า Login, หน้าสมัครสมาชิก, หน้าภาพรวม, หน้าสาธารณะ (`/p` พร้อม Hero Pattern และ Carousel ปรับขนาด/มุมมอง/พื้นหลังเบลอได้), ชุดสี & Dark Mode, ฟอนต์ & Custom CSS, และรูปแบบ PDF

---

## 📋 เงื่อนไขการจัดตารางที่รองรับ (10 Competition Rules)

| รหัส | ประเภท | รายละเอียดเงื่อนไข |
| :---: | :---: | :--- |
| **I0** | บังคับ | ความสมบูรณ์ของข้อมูล ห้ามกลุ่มเรียน อาจารย์ หรือห้องเรียนชนกัน และความจุห้องเพียงพอ |
| **C1** | พื้นฐาน (เปิดเสมอ) | คาบที่ 5 (12:00–13:00) ทุกวันเป็นเวลาพักเที่ยง ห้ามจัดเรียน |
| **C2** | พื้นฐาน (เปิดเสมอ) | วันพุธ คาบ 8 พบครูที่ปรึกษา และคาบ 9 คาบกิจกรรม (ผู้ควบคุมคือครูที่ปรึกษาประจำกลุ่ม) |
| **C3** | พื้นฐาน (เปิดเสมอ) | อาจารย์ฝ่ายบริหาร 7 ท่าน ห้ามจัดสอนวันอังคาร คาบ 1–4 (เวลาประชุมผู้บริหาร) |
| **C4** | พื้นฐาน (เปิดเสมอ) | จำนวนคาบต่อสัปดาห์ของแต่ละวิชาตรงตามชั่วโมงบรรยาย + ปฏิบัติ |
| **C5** | เปิด/ปิดได้ | วิชาภาษา สังคมศาสตร์ วิชาชีพครู วิชาบังคับ คณิตศาสตร์ และวิทยาศาสตร์ ใช้ห้องเรียนทฤษฎี |
| **C6** | เปิด/ปิดได้ | วิชานวัตกรรมและเทคโนโลยีสารสนเทศ ใช้ห้องปฏิบัติการคอมพิวเตอร์ |
| **C7** | เปิด/ปิดได้ | รายวิชาที่มีอาจารย์ผู้สอนร่วม 2 ท่าน ต้องจัดสอนพร้อมกันและนับภาระสอนทั้ง 2 ท่าน |
| **C8** | เปิด/ปิดได้ | กลุ่มวิชาทักษะและการสอนกีฬา ต้องจองห้องเรียนทฤษฎีและโรงยิม/สนามกีฬาคู่กัน |
| **C9** | เปิด/ปิดได้ | ชุดวิชาทางเลือกกีฬาในชั้นปีเดียวกัน ต้องจัดเวลาเรียนพร้อมกันทั้งชุด |
| **C10** | เปิด/ปิดได้ | ชั้นปีที่ 4 (`กศ 021037 ปฏิบัติการสอนในสถานศึกษา 4`) ไม่จัดลงตารางเรียน แต่แสดงในตารางสรุปรายวิชาของอาจารย์ผู้รับผิดชอบ |

---

## 🚀 การติดตั้งและใช้งาน (Quick Start)

### วิธีที่ 1: รันด้วย Docker (แนะนำ)

```bash
git clone https://github.com/mrjittipat/Timetable-Final.git
cd Timetable-Final
docker compose up -d --build
```

เปิดใช้งานได้ที่:
- **ระบบจัดการตาราง (Admin / Teacher)**: `http://localhost:3000`
- **ตารางเรียนสาธารณะ (ไม่ต้องเข้าสู่ระบบ)**: `http://localhost:3000/p`

> **บัญชีผู้ดูแลระบบเริ่มต้น**: `admin` / `admin1234`

---

### วิธีที่ 2: รันแบบพัฒนา (Local Development)

ต้องติดตั้ง **Node.js 22+** ขึ้นไป

```bash
# 1. ติดตั้งและรัน Backend (พอร์ต 3000)
cd backend
npm install
npm start

# 2. ติดตั้งและรัน Frontend (เปิดอีกเทอร์มินัล)
cd frontend
npm install
npx ng serve
```

---

## 🧪 การทดสอบระบบ (Testing)

```bash
cd backend
npm test
```

ครอบคลุมชุดทดสอบอัตโนมัติ **54 รายการ**:
- `test/validator.test.js` — ทดสอบตัวตรวจเงื่อนไข `I0` และ `C1–C10`
- `test/chatbot.test.js` — ทดสอบ Offline AI Chatbot ทุก Intent และบริบทต่อเนื่อง
- `test/run-solver.js --all` — ทดสอบ Solver ทุกโหมดเงื่อนไขและยืนยัน Determinism ของ Random Seed

---

## 🗂️ โครงสร้างโปรเจกต์ (Project Structure)

```text
Timetable/
├── backend/                  # Node.js ESM + Express 5 API & Solver
│   ├── src/
│   │   ├── routes/api.js     # REST API, Auth, Export, Teacher Hub, Public
│   │   └── services/
│   │       ├── solver.js     # CSP + Simulated Annealing Scheduler
│   │       ├── validator.js  # Independent 10-Rule Validator
│   │       ├── diagnose.js   # Conflict & Capacity Diagnostics
│   │       ├── editor.js     # Manual Move / Swap / Split Engine
│   │       ├── exporter.js   # PDF (Sarabun), Excel (.xlsx), CSV, QR PDF
│   │       ├── grid.js       # Timetable Grid & Subject Summary Builder
│   │       ├── zip.js        # Zero-dependency ZIP Archive Builder
│   │       └── chatbot/      # Offline Thai Timetable Assistant
│   └── test/                 # Automated Validator, Chatbot & Solver Tests
├── frontend/                 # Angular 22 Standalone SPA
│   └── src/app/
│       ├── core/             # Api, Auth, State, Theme, Confirm, Toasts
│       ├── layout/           # Responsive Shell & Sidebar with Live Badges
│       ├── pages/            # Dashboard, Data, Solve, Manual, Timetable,
│       │                     # Report, Export, Appearance, Teacher Hub,
│       │                     # My Groups, Users, Login, Public (/p)
│       └── shared/           # Timetable Sheet, PDF Preview, Chat Widget
├── csv/                      # ชุดข้อมูลตั้งต้นชั้นปีที่ 1–4
├── Dockerfile                # Multi-stage Production Build
└── docker-compose.yml        # Container Orchestration + Persistent Volumes
```

---

<div align="center">
  <sub>พัฒนาด้วย Node.js, Express 5, Angular 22 และ Docker</sub>
</div>
