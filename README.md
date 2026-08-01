# Flowboard

PWA สำหรับออกแบบ workflow (board / tasks / roadmap / plan) เก็บเป็นไฟล์ `.flowpkg`  
รองรับ live session ผ่าน join code

สเปกเต็ม: [`FEATURES.md`](./FEATURES.md)

## Prerequisites

- Node.js 22+
- npm
- Docker + Docker Compose (สำหรับ infra / trycloudflare / staging)
- Cloudflare account (Free พอ) — สำหรับโหมด Install คงที่ + Join ผ่าน tunnel

> ไดรฟ์บางชนิด (เช่น `D:\` ที่ไม่รองรับ symlink) ใช้ `npm run install:all` แทน workspaces

## Setup พื้นฐาน (ครั้งแรกบนเครื่อง)

```bash
npm run install:all
cp .env.example .env.development
```

แก้ค่าใน `.env.development` ตามต้องการ

---

## โหมดแนะนำ: Cloudflare Workers (เว็บคงที่) + trycloudflare (API ชั่วคราว)

ใช้เมื่ออยากให้คนนอก **Install แอปจาก URL คงที่** แล้วยัง **Join ได้** ตอนคุณเปิด tunnel

| ส่วน | ที่อยู่ | หน้าที่ |
|------|---------|---------|
| เว็บ / PWA | `https://flowboard-web.<subdomain>.workers.dev` | UI, Install, offline ไฟล์ |
| API + NATS | เครื่องคุณผ่าน `*.trycloudflare.com` | Start session / Join / realtime |

Client เปิดแค่ **workers.dev** — ไม่ต้องใส่ URL tunnel เอง  
แอปอ่าน `GET /runtime-config.json` แล้วได้ `apiBaseUrl` ที่สคริปต์ publish เข้า KV ตอนเปิด tunnel

> โปรเจกต์นี้ deploy เว็บด้วย **Cloudflare Workers (OpenNext)** ไม่ใช่ classic Pages  
> URL จะเป็น `*.workers.dev`

---

### A) Setup Cloudflare ครั้งแรก (ทำครั้งเดียว)

#### 1. Login Wrangler

```bash
cd apps/web
npx wrangler login
```

กดอนุญาตในเบราว์เซอร์

#### 2. สร้าง KV (เก็บ API URL ตอนเปิด tunnel)

```bash
cd apps/web
npx wrangler kv namespace create RUNTIME_CONFIG
```

- ตอบ **Yes** ถ้าถามให้เขียนลง `wrangler.jsonc`
- ตอบ **No** ถ้าถามเรื่อง remote resource สำหรับ local dev
- จด `id` ไว้ (หรืออ่านจาก `apps/web/wrangler.jsonc` ภายใต้ binding `RUNTIME_CONFIG`)

#### 3. สร้าง API Token + หา Account ID

ใน [Cloudflare Dashboard](https://dash.cloudflare.com) → โปรไฟล์ → **API Tokens** → **Create Token**

- Token name: เช่น `flowboard-runtime-config`
- Permissions: **Account** → **Workers KV Storage** → **Edit**
- Account Resources: Include → All accounts
- สร้างแล้ว **คัดลอก token ทันที**

Account ID: หน้า Overview ของ account (ด้านขวา)

#### 4. ตั้ง workers.dev subdomain (ถ้ายังไม่มี)

Dashboard → **Workers & Pages** → **Create** → **Start with Hello World!**  
ตั้ง subdomain เมื่อถูกถาม (เช่น `janjao937`)  
Worker ทดสอบชื่ออื่น (เช่น `flowboard`) ลบได้ทีหลัง — เก็บแค่ `flowboard-web`

หรือใน terminal:

```bash
cd apps/web
npx wrangler subdomain create <ชื่อที่ต้องการ>
```

#### 5. สร้างไฟล์ env

ที่รากโปรเจกต์:

```bash
cp .env.trycloudflare.example .env.trycloudflare
```

แก้ `.env.trycloudflare`:

```env
CORS_ORIGIN=https://flowboard-web.<subdomain>.workers.dev
JWT_SECRET=ใส่รหัสยาวๆเอง
CLOUDFLARE_API_TOKEN=แปะtoken
CLOUDFLARE_ACCOUNT_ID=แปะaccount-id
FLOWBOARD_CF_KV_NAMESPACE_ID=แปะkv-idจากข้อ2
```

ฝั่งเว็บ:

```bash
cp apps/web/.env.cloudflare.example apps/web/.env.production.local
```

แก้ `apps/web/.env.production.local`:

```env
NEXT_PUBLIC_APP_URL=https://flowboard-web.<subdomain>.workers.dev
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_REQUIRE_RUNTIME_API=1
```

#### 6. Deploy เว็บครั้งแรก

```bash
npm run cf:deploy:web
```

ได้ URL จริงจาก log เช่น `https://flowboard-web.janjao937.workers.dev`  
ถ้ายังไม่ตรงใน env ให้แก้ `NEXT_PUBLIC_APP_URL` + `CORS_ORIGIN` แล้ว deploy ซ้ำ:

```bash
npm run cf:deploy:web
```

**ลิงก์นี้คือลิงก์ให้เพื่อน Install / เปิดใช้** — อย่า Install จาก `*.trycloudflare.com`

---

### B) รันใช้งานแต่ละครั้ง (demo / Join)

1. เปิด Docker Desktop
2. รัน tunnel + API:

```bash
npm run trycloudflare
```

หรือดับเบิลคลิก `start-trycloudflare.bat`

3. รอจนมี public URL และข้อความ publish runtime config (เขียน `apiBaseUrl` เข้า KV)
4. **Host:** เปิด `https://flowboard-web.<subdomain>.workers.dev` → สร้าง/เปิด workflow → **Start session** → ส่งรหัส 6 ตัว
5. **Guest:** เปิด workers.dev **เดียวกัน** → **Join** → ใส่รหัส + ชื่อ  
   (ไม่ต้องใส่ endpoint สุ่ม)

หยุด:

```bash
# ปิดเฉพาะ tunnel (local stack ยังอยู่ที่ :3080)
npm run trycloudflare:stop-tunnel

# หยุดทั้ง stack
npm run trycloudflare:stop
```

Windows: `stop-trycloudflare-tunnel.bat` / `stop-trycloudflare.bat`

หมายเหตุ:

- ช่วงที่มีคน Join ต้องเปิด `trycloudflare` ค้างไว้
- KV มี `apiBaseUrl` **อันเดียว** — host ได้ทีละเครื่อง (คนที่ publish ทีหลังจะทับค่า)
- Local URL `http://127.0.0.1:3080` ยังใช้ในเครื่อง/LAN ได้แม้ปิด tunnel

---

### C) เมื่ออัปเดตโค้ด

| แก้อะไร | ต้องทำอะไร |
|---------|------------|
| เว็บ (UI, Join UX, PWA, runtime-config ฝั่ง client) | `npm run cf:deploy:web` |
| API / session / NATS / docker compose | รัน `npm run trycloudflare` ใหม่ (ไม่บังคับ redeploy เว็บ) |
| `apps/web/.env.production.local` (`NEXT_PUBLIC_*`) | แก้แล้ว `npm run cf:deploy:web` |
| `.env.trycloudflare` (CORS, JWT, token) | รีสตาร์ท `npm run trycloudflare` |
| แค่เปิด tunnel รอบใหม่ (โค้ดไม่เปลี่ยน) | `npm run trycloudflare` — KV ได้ URL ใหม่เอง ไม่ต้อง deploy เว็บ |

หลัง deploy เว็บ คนที่ Install PWA ไว้ อาจต้องรีเฟรชแรงๆ / เปิดแอปใหม่เพื่อดึง SW เวอร์ชันใหม่

---

## โหมดรันอื่นๆ

### 1) Local development

#### 1a) Full stack ใน Docker (hot reload)

```bash
npm run docker:local
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| NATS | `nats://localhost:4222` |

```bash
npm run docker:local:down
npm run docker:local:reset
```

#### 1b) Host `npm run dev` + NATS ใน Docker

```bash
npm run docker:dev   # terminal 1
npm run dev          # terminal 2
```

### 2) trycloudflare แบบเต็ม stack (ไม่ใช้ Workers)

รัน web+api ใน Docker แล้วแชร์ผ่าน `*.trycloudflare.com` โดยตรง  
เหมาะเทสเร็ว แต่ **อย่า Install จากลิงก์นี้** (URL เปลี่ยนทุกครั้ง)

```bash
npm run trycloudflare
```

| ใช้ลิงก์ | ผลเมื่อปิด Cloudflare |
|----------|------------------------|
| `*.trycloudflare.com` | ใช้ไม่ได้ |
| `http://127.0.0.1:3080` / LAN | ยังใช้ได้ถ้า stack ยังรัน |

### 3) Deploy ทั้งก้อนบน VPS (staging compose)

รัน **web + api + NATS** บน VPS ด้วย Docker Compose  
เข้าเน็ตผ่าน **Cloudflare Named Tunnel** (ไม่ต้องเปิดพอร์ต 80/443 บน firewall — ใช้ outbound จาก VPS พอ)

```text
Browser / PWA
    → https://app.yourdomain.com     (Cloudflare)
    → cloudflared (บน VPS)
    → web:3000  /  api:4000  /  nats (ภายใน Docker network)
```

Compose: [`docker/docker-compose.staging.yml`](docker/docker-compose.staging.yml)  
Env ตัวอย่าง: [`.env.staging.example`](.env.staging.example)

#### 3.1 สิ่งที่ต้องมี

- VPS (Ubuntu 22.04+ แนะนำ) + SSH
- Docker Engine + Docker Compose plugin
- โดเมนที่ชี้ nameserver ไป Cloudflare แล้ว
- Cloudflare account (สร้าง Named Tunnel)

#### 3.2 เตรียม VPS

```bash
# ตัวอย่าง Ubuntu
sudo apt update && sudo apt upgrade -y
# ติดตั้ง Docker ตามเอกสารทางการ: https://docs.docker.com/engine/install/
sudo usermod -aG docker $USER   # แล้ว logout/login ใหม่

git clone <repo-url> flowboard
cd flowboard
```

#### 3.3 สร้าง Cloudflare Named Tunnel + โดเมน

1. Dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**
2. เลือก **Cloudflared** → ตั้งชื่อ เช่น `flowboard-vps`
3. คัดลอก **Tunnel token** (ใช้ใน `.env.staging`)
4. เพิ่ม **Public hostnames** (แนะนำแยก web / api เพราะ staging compose ไม่มี reverse proxy `/api`):

| Public hostname | Path | Service (ใน Docker network) |
|-----------------|------|-------------------------------|
| `app.yourdomain.com` | (ว่าง) | `http://web:3000` |
| `api.yourdomain.com` | (ว่าง) | `http://api:4000` |

5. DNS: ให้ Cloudflare proxy (เมฆส้ม) ชี้ CNAME โดเมนเหล่านี้ไปที่ tunnel (Dashboard มักสร้างให้อัตโนมัติ)

> WebSocket (`/realtime`) ไปที่ API hostname — client สร้างจาก `NEXT_PUBLIC_API_URL` อัตโนมัติ

#### 3.4 ตั้ง `.env.staging` บน VPS

```bash
cp .env.staging.example .env.staging
nano .env.staging   # หรือ editor ที่ถนัด
```

ตัวอย่างค่าจริง:

```env
NODE_ENV=staging
JWT_SECRET=ใส่รหัสยาวสุ่มอย่างน้อย-32-ตัว

CORS_ORIGIN=https://app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

CLOUDFLARE_TUNNEL_TOKEN=eyJ...tokenจากข้อ3.3...
```

หมายเหตุ:

- `NEXT_PUBLIC_*` ถูก bake ตอน **build image web** — เปลี่ยนค่าแล้วต้อง `up --build` ใหม่
- `JWT_SECRET` บังคับ (compose จะไม่ขึ้นถ้าไม่ใส่)
- อย่า commit `.env.staging`

#### 3.5 รันทั้งก้อนครั้งแรก

แนะนำใช้ `--env-file .env.staging` ชัดเจน (สคริปต์ `npm run docker:staging:tunnel` อ่านจากไฟล์ `.env` เป็นหลัก ไม่ใช่ `.env.staging`):

```bash
# ที่รากโปรเจกต์บน VPS
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging --profile tunnel up --build -d
```

ทางเลือก: `cp .env.staging .env` แล้วค่อย `npm run docker:staging:tunnel`

ตรวจสถานะ:

```bash
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging ps
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging logs -f --tail=100
```

เปิดเบราว์เซอร์ที่ `https://app.yourdomain.com` → Start session / Join ควรคุยกับ `https://api.yourdomain.com`

#### 3.6 อัปเดตโค้ดบน VPS

```bash
cd flowboard
git pull

# rebuild + รีสตาร์ททั้งก้อน (web ต้อง build ใหม่ถ้าแก้ frontend หรือ NEXT_PUBLIC_*)
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging --profile tunnel up --build -d
```

อัปเดตเฉพาะบาง service:

```bash
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging --profile tunnel up --build -d api
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging --profile tunnel up --build -d web
```

#### 3.7 หยุด / ลบ

```bash
# หยุด containers (เก็บ volumes)
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging --profile tunnel down

# หยุดและลบ volumes (NATS data หาย)
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging --profile tunnel down -v
```

#### 3.8 รันบน VPS แบบไม่มี tunnel (เข้าได้แค่ในเครือข่าย VPS)

```bash
docker compose -f docker/docker-compose.staging.yml --env-file .env.staging up --build -d
```

compose นี้ **ไม่ได้ publish พอร์ต** ออก host — เหมาะกับ tunnel เป็นทางเข้าหลัก  
ถ้าจะเปิดพอร์ตเอง / ใส่ Nginx-Caddy บน host ต้องแก้ compose เพิ่มเอง (ดูแนวทาง proxy จาก `docker/caddy/Caddyfile.trycloudflare`)

#### 3.9 Checklist หลังขึ้น VPS

- [ ] `https://app.yourdomain.com` โหลด UI ได้
- [ ] `https://api.yourdomain.com/ready` ตอบ OK
- [ ] Start session ได้ join code
- [ ] เครื่องอื่น Join ด้วยรหัสได้ (CORS ต้องเป็น origin ของแอป)
- [ ] รีเฟรช / Install PWA จาก **โดเมนจริง** (ไม่ใช่ trycloudflare)
- [ ] `JWT_SECRET` ไม่ใช่ค่า example
- [ ] Firewall VPS: เปิด SSH; **ไม่จำเป็น** เปิด 80/443 ถ้าใช้ tunnel อย่างเดียว

#### 3.10 ต่างจากโหมด Workers + trycloudflare ยังไง

| | Workers + trycloudflare | VPS ทั้งก้อน |
|--|-------------------------|---------------|
| เว็บ | Cloudflare Workers | container `web` บน VPS |
| API | เครื่องคุณ / tunnel ชั่วคราว | container `api` บน VPS (โดเมนคงที่) |
| Join ตอนปิดเครื่องคุณ | ไม่ได้ | ได้ ถ้ารัน VPS ค้าง |
| ต้องมีโดเมน | ไม่บังคับ (`*.workers.dev`) | แนะนำมีโดเมน + Named Tunnel |

---

## เลือกโหมดไหนดี

| เป้าหมาย | ทำอะไร |
|----------|--------|
| พัฒนาโค้ด (hot reload) | `npm run docker:local` หรือ `docker:dev` + `npm run dev` |
| Demo ให้คนนอก Install คงที่ + Join ได้ (ไม่เช่า VPS) | Setup Cloudflare Workers (§A) แล้วใช้ §B ทุกครั้ง |
| Demo เร็วผ่านเน็ตโดยไม่ deploy Workers | `npm run trycloudflare` (อย่า Install จาก trycloudflare) |
| รันทั้งก้อนบน VPS / โดเมนจริง | §3 Deploy VPS (`docker:staging:tunnel`) |

---

## ทดสอบ / คุณภาพโค้ด

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

CI: `.github/workflows/ci.yml`

---

## โครงสร้างหลัก

```
apps/web          Next.js PWA (+ OpenNext Cloudflare)
apps/api          Fastify (sessions, realtime)
packages/*        errors, permissions, workflow-schema, flowpkg
docker/           compose files + Dockerfiles + Caddy
scripts/          trycloudflare, publish-runtime-config, cf-build-web
```

| ไฟล์ | ใช้ทำอะไร |
|------|-----------|
| `docker/docker-compose.local.yml` | Full stack local + hot reload |
| `docker/docker-compose.dev.yml` | NATS (+ optional tunnel → host:3000) |
| `docker/docker-compose.trycloudflare.yml` | Full stack + quick tunnel |
| `docker/docker-compose.staging.yml` | Staging/VPS ทั้งก้อน (+ profile `tunnel` = Named Tunnel) |
| `.env.staging` | Env บน VPS (gitignored) — ใช้กับ `--env-file .env.staging` |
| `apps/web/wrangler.jsonc` | Cloudflare Worker + KV `RUNTIME_CONFIG` |
| `.env.trycloudflare` | CORS + credentials publish KV (gitignored) |
| `apps/web/.env.production.local` | Build env สำหรับ `cf:deploy:web` (gitignored) |
