# Flowboard

PWA สำหรับออกแบบ workflow (board / tasks / roadmap / plan) เก็บเป็นไฟล์ `.flowpkg`  
รองรับ live session ผ่าน join code + Cloudflare Tunnel

สเปกเต็ม: [`FEATURES.md`](./FEATURES.md)

## Prerequisites

- Node.js 22+
- npm
- Docker + Docker Compose (สำหรับโหมด infra / staging / tunnel)

> ไดรฟ์บางชนิด (เช่น `D:\` ที่ไม่รองรับ symlink) ใช้ `npm run install:all` แทน workspaces

## Setup

```bash
npm run install:all
cp .env.example .env.development
```

แก้ค่าใน `.env.development` ตามต้องการ จากนั้นคัดลอกตัวแปรที่เกี่ยวข้องไปที่ `apps/api` / `apps/web` ถ้าคุณรันแยกด้วย env ของแต่ละแอป

---

## วิธีรันแบบต่างๆ

### 1) Local development (แนะนำตอนเขียนโค้ด)

รัน web + api บน host, NATS ใน Docker

```bash
# terminal 1 — NATS
npm run docker:dev

# terminal 2 — Next.js + Fastify
npm run dev
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| NATS | `nats://localhost:4222` |

แยกรัน:

```bash
npm run dev:web
npm run dev:api
```

---

### 2) Local + trycloudflare (เฉพาะหน้า web)

ใช้ตอนอยากโชว์ UI จาก `npm run dev` ผ่าน URL สาธารณะชั่วคราว  
tunnel ชี้ไปที่ `localhost:3000` เท่านั้น — join session / API จากภายนอกอาจใช้ไม่ได้เต็มรูปแบบ

```bash
npm run docker:dev
npm run dev
npm run docker:dev:tunnel
```

ดู URL จาก log ของ `cloudflared` (เช่น `https://xxxx.trycloudflare.com`)

---

### 3) Full stack + trycloudflare (แนะนำสำหรับ demo / ทดสอบ join จากมือถือ)

รัน web + api + nats + Caddy + quick tunnel ใน Docker ด้วยคำสั่งเดียว  
เปิดผ่าน `*.trycloudflare.com` ได้ทั้ง UI, API (`/api`), และ realtime websocket

```bash
npm run trycloudflare
```

สคริปต์จะ build/start stack แล้วพิมพ์ **Public URL** ให้เมื่อ tunnel พร้อม  
ส่งลิงก์นั้นให้คนอื่น → host กด Start session → ส่ง join code

หมายเหตุ:

- ต้องมี Docker Desktop
- ไม่ต้องมี Cloudflare account / tunnel token
- URL เปลี่ยนทุกครั้งที่สร้าง tunnel ใหม่
- API ถูก proxy ที่ path `/api`
- ครั้งแรกอาจใช้เวลา build นาน

หยุด:

```bash
npm run trycloudflare:stop
```

หรือกด `Ctrl+C` ในเทอร์มินัลที่รันอยู่

---

### 4) Staging stack (VPS / pre-prod) ไม่มี tunnel

```bash
cp .env.staging.example .env.staging
# ตั้ง JWT_SECRET และ URL จริง

npm run docker:staging
```

เทียบเท่า:

```bash
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging up --build -d
```

---

### 5) Staging + Cloudflare named tunnel (โดเมนจริง)

ต้องมี Cloudflare Tunnel ที่สร้างไว้แล้ว และใส่ token ใน `.env.staging`:

```env
CLOUDFLARE_TUNNEL_TOKEN=...
CORS_ORIGIN=https://your-domain.example
NEXT_PUBLIC_APP_URL=https://your-domain.example
NEXT_PUBLIC_API_URL=https://your-domain.example/api
JWT_SECRET=strong-secret
```

```bash
npm run docker:staging:tunnel
```

เทียบเท่า:

```bash
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging --profile tunnel up --build -d
```

ตั้ง public hostname ของ tunnel ให้ชี้ไปยัง service ใน Docker network ตามที่คุณ config ใน Cloudflare Zero Trust

---

## เลือกโหมดไหนดี

| เป้าหมาย | คำสั่ง |
|----------|--------|
| พัฒนาโค้ดบนเครื่อง | `docker:dev` + `npm run dev` |
| แชร์ UI ชั่วคราวจาก `npm run dev` | + `docker:dev:tunnel` |
| Demo เต็มระบบผ่านเน็ต (ไม่ต้องมีโดเมน) | `npm run trycloudflare` |
| Deploy บน VPS | `docker:staging` |
| Deploy บน VPS + โดเมน Cloudflare | `docker:staging:tunnel` |

---

## ทดสอบ / คุณภาพโค้ด

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

CI: `.github/workflows/ci.yml` (lint, typecheck, unit, docker build, e2e)

---

## โครงสร้างหลัก

```
apps/web          Next.js PWA
apps/api          Fastify (sessions, realtime)
packages/*        errors, permissions, workflow-schema, flowpkg
docker/           compose files + Dockerfiles + Caddy
```

Compose files:

| ไฟล์ | ใช้ทำอะไร |
|------|-----------|
| `docker/docker-compose.dev.yml` | NATS (+ optional trycloudflare → host:3000) |
| `docker/docker-compose.trycloudflare.yml` | Full stack + quick tunnel |
| `docker/docker-compose.staging.yml` | Staging/VPS (+ profile `tunnel` สำหรับ named tunnel) |
