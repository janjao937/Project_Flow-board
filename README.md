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

#### 1a) Full stack ใน Docker (hot reload — แนะนำตอนเทส)

รัน web + api + NATS ใน Docker แบบ `npm run dev` (tsx watch / next dev)  
build image ครั้งแรกครั้งเดียว แล้วแก้โค้ดเทสได้เลยโดยไม่ต้อง build ซ้ำ

```bash
npm run docker:local
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| NATS | `nats://localhost:4222` |

หยุด / ล้าง volumes (ถ้า deps ค้าง):

```bash
npm run docker:local:down
npm run docker:local:reset
```

#### 1b) Host `npm run dev` + NATS ใน Docker

```bash
# terminal 1 — NATS
npm run docker:dev

# terminal 2 — Next.js + Fastify
npm run dev
```

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

**Windows (กดใช้ในองค์กร):** ดับเบิลคลิกที่รากโปรเจกต์

- `start-trycloudflare.bat` — build/start ทั้ง stack แล้วพิมพ์ **Public + Local URL** (บันทึกใน `trycloudflare-url.txt`)
- `show-trycloudflare-url.bat` — แสดงลิงก์อีกครั้งถ้าหาไม่เจอในหน้าต่าง log
- `stop-trycloudflare-tunnel.bat` — **ปิดเฉพาะ Cloudflare** (แอพยังใช้ได้ที่ `http://127.0.0.1:3080`)
- `stop-trycloudflare.bat` — หยุด containers ทั้งหมด

หรือใช้ npm:

```bash
npm run trycloudflare
```

สคริปต์จะ build/start stack แล้วพิมพ์ **Public URL** + **Local URL**  
ส่งลิงก์ public ให้คนอื่นชั่วคราว → host กด Start session → ส่ง join code

**สำคัญ — ติดตั้งแอพในเครื่อง:**

| ใช้ลิงก์ | ผลเมื่อปิด Cloudflare |
|----------|------------------------|
| `*.trycloudflare.com` | **ใช้ไม่ได้** (URL ชั่วคราวตาย / รอบถัดไปได้ลิงก์ใหม่) |
| `http://127.0.0.1:3080` หรือ IP ใน LAN | **ยังใช้ได้** ถ้า stack ยังรันอยู่ |

แนะนำ: บุ๊กมาร์ก / Install จาก **LOCAL URL** เท่านั้น  
อย่า Install จากลิงก์ trycloudflare

หมายเหตุ:

- ต้องมี Docker Desktop (เปิดค้างไว้จน Ready)
- ไม่ต้องมี Cloudflare account / tunnel token
- Public URL เปลี่ยนทุกครั้งที่สร้าง tunnel ใหม่
- Local port เริ่มต้น `3080` (เปลี่ยนด้วย `FLOWBOARD_LOCAL_PORT`)
- API ถูก proxy ที่ path `/api`
- ครั้งแรกอาจใช้เวลา build นาน

หยุด:

- ปิดเฉพาะ public tunnel: `Ctrl+C` หรือ `stop-trycloudflare-tunnel.bat` / `npm run trycloudflare:stop-tunnel`
- หยุดทั้ง stack: `stop-trycloudflare.bat` / `npm run trycloudflare:stop`

```bash
npm run trycloudflare:stop-tunnel
npm run trycloudflare:stop
```

**Cloudflare Free web (Install คงที่) + trycloudflare API (Join ชั่วคราว)**

1. Deploy web ขึ้น Workers ด้วย OpenNext:

```bash
cp apps/web/.env.cloudflare.example apps/web/.env.production.local
# ตั้ง NEXT_PUBLIC_APP_URL และ NEXT_PUBLIC_REQUIRE_RUNTIME_API=1
# สร้าง KV: cd apps/web && npx wrangler kv namespace create RUNTIME_CONFIG
# ใส่ id จริงใน apps/web/wrangler.jsonc
npm run cf:deploy:web
```

2. ตั้ง `.env.trycloudflare` จาก `.env.trycloudflare.example` — `CORS_ORIGIN` = workers.dev ของคุณ + token/account/KV id สำหรับ publish runtime config

3. `npm run trycloudflare` — หลังได้ public URL สคริปต์จะเขียน `apiBaseUrl` เข้า KV  
   Client ที่ Install จาก Cloudflare อ่าน `/runtime-config.json` แล้ว Join ไปที่ trycloudflare API

อย่า Install จาก `*.trycloudflare.com` — Install จาก workers.dev เท่านั้น

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
| เทส/พัฒนา full stack (hot reload ใน Docker) | `npm run docker:local` |
| พัฒนาโค้ดบน host | `docker:dev` + `npm run dev` |
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
| `docker/docker-compose.local.yml` | Full stack local + hot reload (web/api/nats) |
| `docker/docker-compose.dev.yml` | NATS (+ optional trycloudflare → host:3000) |
| `docker/docker-compose.trycloudflare.yml` | Full stack + quick tunnel |
| `docker/docker-compose.staging.yml` | Staging/VPS (+ profile `tunnel` สำหรับ named tunnel) |
