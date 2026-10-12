# Flowboard Deploy & Operations Guide

คู่มือการ deploy, update, restart และการใช้ CLI ของ Flowboard (คู่กับ README.md)

---

## 1. สถาปัตยกรรมการ Deploy

```
                    ┌─────────────────────────────────────┐
                    │   Cloudflare (Free plan)            │
                    │                                     │
   ผู้ใช้ ──────────▶│  Workers: flowboard-web (OpenNext)  │
   (browser/PWA)    │  - UI / board / PWA                 │
                    │  - GET /runtime-config.json         │
                    │           ↓ อ่าน                    │
                    │  KV namespace "RUNTIME_CONFIG"      │
                    │   key: apiBaseUrl, updatedAt        │
                    └──────────────┬──────────────────────┘
                                   │ (browser อ่านค่า → เรียก API ตรง)
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  *.trycloudflare.com (Quick Tunnel) │
                    │  cloudflared container              │
                    └──────────────┬──────────────────────┘
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  เครื่องของคุณ (Docker Compose)       │
                    │  caddy edge  ── /api/*  → api:4000  │
                    │  │              /realtime → api     │
                    │  │              อื่น ๆ → web:3000   │
                    │  api (Fastify + tsx, port 4000)     │
                    │  web (Next standalone, port 3000)   │
                    │  nats (in-memory JetStream)         │
                    └─────────────────────────────────────┘
```

| ส่วน | รันที่ไหน | อายุการใช้งาน |
|---|---|---|
| Frontend (UI/PWA) | Cloudflare Workers | ถาวร — deploy ครั้งเดียว |
| ที่อยู่ API | KV (`apiBaseUrl`) | เปลี่ยนทุกครั้งที่เปิด tunnel |
| API + NATS + tunnel | เครื่องของคุณ (Docker) | ใช้งานได้เมื่อเครื่องเปิด + รัน `npm run trycloudflare` ค้าง |
| Session/board data | ใน memory (NATS/API) | **หายเมื่อ restart stack** — ผู้ใช้ต้อง join ใหม่ |

**หลักการสำคัญ:** เว็บบน Workers จะดึง `GET /runtime-config.json` (no-store) ทุกครั้งที่เปิดหน้า → ได้ `apiBaseUrl` ล่าสุดจาก KV → ไม่ต้อง redeploy เมื่อ tunnel URL เปลี่ยน

**ห้ามลืม:** ค่า `apiBaseUrl` ที่ publish ลง KV ต้องมี `/api` ต่อท้ายเสมอ (เช่น `https://xxx.trycloudflare.com/api`) — เพราะ client ประกอบ URL เป็น `apiBaseUrl + "/sessions"` และ WebSocket `apiBaseUrl + "/realtime"`

### เลือกโหมดของ stack ของเครื่อง (full vs ไม่มี web)

เมื่อ frontend deploy บน Cloudflare Workers แล้ว container `web` ใน Docker **ไม่จำเป็น** — มี 2 โหมดให้เลือก (compose file คนละไฟล์, project name เดียวกัน, สลับไปมาได้):

| | **full** (default) | **noweb** (API-only) |
|---|---|---|
| คำสั่งเริ่ม | `npm run trycloudflare` | `npm run trycloudflare:noweb` / `start-trycloudflare-noweb.bat` |
| Services | web + api + nats + caddy + cloudflared | api + nats + caddy + cloudflared — **ไม่ build Dockerfile.web** |
| เวลา start | นาน (build web ครั้งแรก) | เร็ว (build เฉพาะ api) |
| เปิดเว็บที่ | LOCAL port 3080 **หรือ** URLs บน Workers | URLs บน Workers เท่านั้น (เปิด LOCAL port 3080 → ได้ JSON 404 แจ้งว่า api-only) |
| ใช้เมื่อ | อยากมี UI ให้ใช้ผ่าน LAN แม้ไม่ deploy Workers / debug UI ใน Docker | ใช้งานผ่าน Workers เป็นหลักแล้ว (แนะนำในชีวิตประจำวัน) |

> สลับโหมด: รันคำสั่งอีกโหมดได้เลย — สคริปต์จะลบ/สร้าง service ที่เกี่ยวข้องให้เอง (`--remove-orphans`) แต่ **api จะถูก restart → session หาย ต้อง Start/Join ใหม่** (nats container ใช้ต่อได้)

---

## 2. Pre-requisites

| สิ่งที่ต้องมี | เช็คด้วยคำสั่ง |
|---|---|
| Docker Desktop (เปิดอยู่) | `docker info` |
| Node.js | `node -v` |
| Cloudflare account (Free พอ) | — |
| Cloudflare API Token ที่มีสิทธิ์ครบ (ดู §3) | — |
| ไฟล์ `.env.trycloudflare` ที่ตั้งค่าครบ | `cat .env.trycloudflare` (อย่าแชร์/commit) |

---

## 3. ตั้งค่า Cloudflare ครั้งแรก (ทำครั้งเดียว)

### 3.1 สร้าง KV namespace

```bash
npx wrangler kv namespace create RUNTIME_CONFIG
```

ได้ `id` กลับมา แล้วใส่ id เดียวกันใน 2 ที่:
1. `apps/web/wrangler.jsonc` → `kv_namespaces[0].id` + `preview_id`
2. `.env.trycloudflare` → `FLOWBOARD_CF_KV_NAMESPACE_ID`

### 3.2 สร้าง API Token (Custom token)

[Cloudflare Dashboard](https://dash.cloudflare.com) → โปรไฟล์ → **API Tokens** → **Create Token** → Custom token

| Permission | Scope | ระดับ | ใช้ทำอะไร |
|---|---|---|---|
| Workers KV Storage | Account | **Edit** | publish `apiBaseUrl` ลง KV ตอนเปิด tunnel (**บังคับ**) |
| Workers Scripts | Account | Edit | redeploy เว็บด้วย `cf:deploy` (ถ้าจะ deploy จาก CLI) |

> ⚠️ แก้ permission ของ token ที่มีอยู่ได้โดยกด Edit (ไม่ต้อง Roll → ค่า token เดิมใช้ต่อได้)
> ถ้าจำเป็นต้อง Roll จะได้ค่าใหม่ → ต้องแก้ `CLOUDFLARE_API_TOKEN` ใน `.env.trycloudflare` ด้วย

### 3.3 ตั้งค่า `.env.trycloudflare` (gitignored)

```env
CLOUDFLARE_API_TOKEN=<token จาก 3.2>
CLOUDFLARE_ACCOUNT_ID=<account id>
FLOWBOARD_CF_KV_NAMESPACE_ID=<namespace id จาก 3.1>

# URL จริงของเว็บบน Workers — ต้องตรงเป๊ะ (ใช้สำหรับ CORS ฝั่ง API)
CORS_ORIGIN=https://flowboard-web.<your-subdomain>.workers.dev

JWT_SECRET=<สุ่มเอง ยาว ๆ>
```

---

## 4. Deploy Frontend ไปที่ Cloudflare Workers

```bash
# deploy จริง
npm run cf:deploy:web

# หรือ preview ก่อน deploy (รัน workerd ในเครื่อง)
npm run cf:preview:web
```

สิ่งที่เกิด: `scripts/cf-build-web.mjs` (build Next + flatten) → `opennextjs-cloudflare deploy` → push ขึ้น Workers

ตรวจหลัง deploy:

```bash
curl -o /dev/null -w "%{http_code}\n" https://flowboard-web.<subdomain>.workers.dev    # 200/307
curl https://flowboard-web.<subdomain>.workers.dev/runtime-config.json                 # ดู apiBaseUrl ปัจจุบัน
```

> หลัง deploy ผู้ใช้เก่าที่ Install PWA ไว้อาจได้ chunk เก่าจาก service worker cache →
> sw.js v2 จะ clear cache เก่าให้เองหลัง reload (ถ้ายังใช้ sw เก่า: DevTools → Application → Clear site data)

---

## 5. รัน Backend + Tunnel (คำสั่งหลักของทุกวัน)

เลือกโหมดเดียวที่ต้องการ (ความต่างดูตารางใน §1):

```bash
npm run trycloudflare            # โหมด full: web + api + nats + caddy + tunnel
# หรือดับเบิลคลิก start-trycloudflare.bat

npm run trycloudflare:noweb      # โหมด API-only: ไม่มี web (frontend อยู่บน Workers)
# หรือดับเบิลคลิก start-trycloudflare-noweb.bat
```

สิ่งที่สคริปต์ทำให้**อัตโนมัติทีละขั้น** (ทั้งสองโหมด):

| ขั้น | สิ่งที่เกิด |
|---|---|
| 1 | เช็ค Docker พร้อม (`docker compose version`) |
| 2 | `up --build -d` ขึ้น nats → api (รอ healthy) → [web ใน full] (รอ healthy) → caddy; noweb จะลบ container `web` เก่าให้เอง (`--remove-orphans`) |
| 3 | force-recreate container `cloudflared` → ได้ **URL ใหม่ทุกครั้ง** |
| 4 | อ่าน log cloudflared จนเจอ URL (รอสูงสุด 3 นาที) |
| 5 | save URL ลง `trycloudflare-url.txt` (มี `mode=noweb/full` บอกโหมดที่รัน) |
| 6 | **publish `apiBaseUrl = <url>/api` ลง Cloudflare KV** (retry 3 ครั้ง + ตรวจสอบกลับหลังเขียน — ถ้าล้มเหลวสคริปต์จะบอกวิธี fix) |
| 7 | `docker compose logs -f` ตามดู log — กด Ctrl+C = ปิด**เฉพาะ tunnel** |

ผลลัพธ์ที่ประสบความสำเร็จจะเห็น:

```
Runtime config published to Cloudflare KV: apiBaseUrl=https://xxx.trycloudflare.com/api
```

> ⚠️ **ห้าม**รัน `docker compose up` เองโดยไม่ผ่านสคริปต์ — จะได้ tunnel ใหม่แต่ **KV ไม่ถูก publish → เว็บหา API ไม่เจอ**

### ค่า environment ที่ใช้

- API: `NODE_ENV=staging`, `CORS_ORIGIN`, `NATS_URL`, `JWT_SECRET` — มาจาก compose + `.env.trycloudflare`
- Web (Docker): `NODE_ENV=production`, `NEXT_PUBLIC_API_URL=/api` (baked ตอน build — ใช้เป็น fallback เมื่อ runtime config ว่าง เช่น เข้าผ่าน LAN)

---

## 6. การ Update ทีละส่วน

| ทำอะไร | คำสั่ง | ต้อง restart อะไรไหม |
|---|---|---|
| โค้ด frontend (UI, board, join UX) | `npm run cf:deploy:web` | ไม่ต้องแตะ backend เลย |
| โค้ด API (`apps/api`) | รัน `npm run trycloudflare` จะ rebuild + restart ให้เอง | session เก่าหาย (รู้ล่วงหน้า) |
| โค้ด web ใน Docker (LAN เวอร์ชัน) | `npm run trycloudflare` (มี `up --build` อยู่แล้ว) | ตามข้างบน |
| env ของ API (CORS, JWT, token) | แก้ `.env.trycloudflare` → รันใหม่ `npm run trycloudflare` | — |
| แค่ URL tunnel หลุด/อยากรอบใหม่ | `npm run trycloudflare` — KV อัปเดตให้เอง | **ไม่ต้อง redeploy เว็บ** |

> โค้ด API อยู่ใน image → update = rebuild image ผ่านสคริปต์เริ่มเดียวจบ ไม่ต้อง build เอง
> (รันโหมดไหนอยู่ก็ใช้คำสั่งโหมดนั้นรันใหม่: `trycloudflare` หรือ `trycloudflare:noweb`)

---

## 7. การ Restart / Stop — เลือกตามสถานการณ์

### 7.1 ปิดเฉพาะ tunnel (เครื่องยังใช้งาน local/LAN ได้)

```bash
# ใน terminal ที่รัน npm run trycloudflare อยู่: กด Ctrl+C → สคริปต์จะปิดเฉพาะ tunnel
```
หรือ

```bash
npm run trycloudflare:stop-tunnel        # docker compose stop cloudflared
# Windows: stop-trycloudflare-tunnel.bat
```
สคริปต์จะคลียร์ `apiBaseUrl` ออกจาก KV ให้เอง — ผู้ใช้ที่เปิดเว็บตอนนั้นจะเห็นสถานะ API offline สวย ๆ ไม่พัง (ไม่ชี้ไปที่ URL ตาย) และคนที่อยู่ใน LAN (`http://<ip>:3080`) ยังใช้ได้ปกติ

### 7.2 Stop ทั้ง stack แล้วเปิดใหม่ (ได้ URL ใหม่ / session หาย)

```bash
npm run trycloudflare:stop               # down ทั้ง project
# Windows: stop-trycloudflare.bat
npm run trycloudflare                    # ขึ้นใหม่ + tunnel ใหม่ + publish KV
```
**ผลของการ restart:** session เก่าหายหมด (สถานะในหน่วยความจำ) — ผู้ใช้ต้อง Start/Join ใหม่ด้วยโค้ดใหม่

### 7.3 restart เฉพาะ service ตัวใดตัวหนึ่ง (debug) — ใช้ได้ทั้งสองโหมด

```bash
docker compose -p flowboard-trycloudflare -f docker/docker-compose.trycloudflare.yml restart api
docker compose -p flowboard-trycloudflare -f docker/docker-compose.trycloudflare.yml restart web
```
(การ restart แบบนี้ไม่ได้ publish KV — สำหรับ debug ที่ไม่กระทบ config)

### 7.4 ล้างของทิ้งทั้งหมด (แก้ปัญหาเรื้อรัง)

```bash
docker compose -p flowboard-trycloudflare -f docker/docker-compose.trycloudflare.yml down --remove-orphans
docker compose -p flowboard-trycloudflare -f docker/docker-compose.trycloudflare.yml build --no-cache web api
npm run trycloudflare
```

### สรุป: ปิดแล้วเปิดใหม่ เชื่อมได้ไหม?

| สถานการณ์ | ผล |
|---|---|
| ปิด stack แล้วเปิดใหม่ด้วย `npm run trycloudflare` | ✅ เชื่อมได้ทันที — URL ใหม่ + KV อัปเดตเอง ผู้ใช้แค่ reload หน้าเว็บ (session เก่าหาย ต้อง join ใหม่) |
| เปิดใหม่ด้วย `docker compose up` **ตรง ๆ** (ไม่ผ่านสคริปต์) | ❌ tunnel ใหม่แต่ KV ไม่อัปเดต → เว็บหา API ไม่เจอ (ต้องรัน publish เองหรือกลับไปใช้สคริปต์) |

---

## 8. CLI Reference

### 8.1 สคริปต์หลัก (root `package.json`)

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run trycloudflare` / `start-trycloudflare.bat` | **โหมด full** — up stack (มี web) + tunnel + publish KV (รายละเอียด §5) |
| `npm run trycloudflare:noweb` / `start-trycloudflare-noweb.bat` | **โหมด API-only** — ไม่มี web (frontend บน Workers), build ไว สลับโหมดย้อนกลับได้ทันทีด้วยคำสั่งข้างบน |
| `npm run trycloudflare:stop` / `stop-trycloudflare.bat` | หยุดทั้ง stack (down --remove-orphans) |
| `npm run trycloudflare:stop-tunnel` / `stop-trycloudflare-tunnel.bat` | หยุดเฉพาะ cloudflared + คลียร์ KV |
| `show-trycloudflare-url.bat` | แสดง URL ปัจจุบัน (จาก txt + log ล่าสุด) |
| `npm run cf:deploy:web` | build + deploy frontend ขึ้น Workers |
| `npm run cf:preview:web` | รัน OpenNext worker ในเครื่อง (ทดสอบก่อน deploy จริง) |
| `node scripts/publish-runtime-config.mjs https://<tunnel>/api` | เขียน `apiBaseUrl` ลง KV ด้วยตัวเอง — ไม่ต้อง restart stack |
| `node scripts/publish-runtime-config.mjs --clear` | คลียร์ `apiBaseUrl` ออกจาก KV |
| `npm run build` / `typecheck` / `lint` / `test` | ตรวจโครงการว่าแก้แล้วไม่พัง (ทุก package) |
| `npm run test:ci` | typecheck + lint + test — รันก่อน push |
| `npm run docker:local` | รัน stack แบบ local แท้ ๆ (ไม่มี tunnel) อยู่ที่ docker-compose.local.yml |

### 8.2 Docker Compose ใช้เอง (debug เท่านั้น)

```bash
docker compose -p flowboard-trycloudflare -f docker/docker-compose.trycloudflare.yml ps        # ดูสถานะ service
docker compose -p flowboard-trycloudflare -f docker/docker-compose.trycloudflare.yml logs -f api
docker compose -p flowboard-trycloudflare -f docker/docker-compose.trycloudflare.yml logs -f cloudflared
docker compose ... build web      # บังคับ build ใหม่ (ไม่ใช้ cache ข้าม .dockerignore)
docker compose ... stop cloudflared
docker compose ... down --remove-orphans
```

### 8.3 publish runtime config เอง (ไม่ต้องรีสตาร์ทอะไร)

```bash
node scripts/publish-runtime-config.mjs https://<tunnel-url>/api    # เขียนมือ 1 ครั้ง (auto-retry 3 ครั้งมีเฉพาะสคริปต์หลัก)
node scripts/publish-runtime-config.mjs --clear                     # คลียร์
```
> ใช้เมื่อ: tunnel ขึ้นแล้วแต่ publish ล้มเหลว / เปลี่ยน origin → รันคำสั่งนี้จบเลย เว็บจะได้ URL ใหม่ทันที (รอ KV propagate ≤ 1 นาที)

---

## 9. Checklist ตรวจว่าใช้งานได้ (รันหลัง deploy/restart)

```bash
# (เปลี่ยน <TUNNEL> เป็น URL จริง, <WEB> เป็น workers.dev ของคุณ)

# 1. API ปลายทางผ่าน tunnel
curl -s https://<TUNNEL>/ready                                    # {"status":"ready",...}

# 2. เว็บ deploy ขึ้นจริง
curl -s -o /dev/null -w "%{http_code}\n" https://<WEB>/en          # 200

# 3. runtime-config บนเว็บต้องอ่านค่าจาก KV ได้แล้วและชี้มาที่ tunnel /api
curl -s https://<WEB>/runtime-config.json                          # {"apiBaseUrl":"https://<TUNNEL>/api",...}

# 4. CORS preflight ด้วย origin เว็บจริง ต้อง 204 + Allow-Origin ตรง
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  -H "Origin: https://<WEB>" -H "Access-Control-Request-Method: POST" \
  https://<TUNNEL>/api/sessions

# 5. สร้าง session จริง ต้องได้ sessionId + joinCode
curl -s -X POST -H "Content-Type: application/json" -H "Origin: https://<WEB>" \
  -d '{"workflowId":"smoke","workflowName":"Smoke","displayName":"test"}' \
  https://<TUNNEL>/api/sessions
```

> ถ้าข้อ (3) ยังได้ค่าเก่า → รอ ≤ 60 วินาที (KV propagate ไปยัง edge ช้าสุด 1 นาที) แล้วรันซ้ำ

---

## 10. Troubleshooting จากปัญหาจริง

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| Publish KV โดน `HTTP 401 code 10000` | Token ไม่มีสิทธิ์ KV / หมดอายุ | เพิ่ม `Account → Workers KV Storage → Edit` ใน token (§3.2) — แก้ permission ไม่ต้อง Roll |
| สคริปต์รันจบแล้วเว็บยังเรียก URL เก่า | publish ล้มเหลวชั่วคราว (ไม่ได้ตรวจย้อนหลังเขียน) | รัน `node scripts/publish-runtime-config.mjs <url>/api` ซ้ำ — ตั้งแต่วันนี้ publish script **ตรวจอ่านกลับหลังเขียนเสมอ** ถ้าไม่ตรงจะดังเป็น Error + วิธี fix ทันอันนี้ |
| publish ผ่านแต่ `/runtime-config.json` ยังค่าเก่า | KV propagate บน edge | รอ ≤ 60 วิ แล้วดึงซ้ำ |
| เรียก API จากเว็บโดน **CORS** (preflight fail) และ/หรือ fetch URL ไม่มี `/api` | `apiBaseUrl` ใน KV ไม่มี `/api` ต่อท้าย | `node scripts/publish-runtime-config.mjs https://<TUNNEL>/api` |
| เรียก tunnel แล้วเจอ `HTTP 530` | Stack หรือ cloudflared ยังไม่รัน (down ไปแล้ว) | `docker compose ps` ดูสถานะ แล้ว restart ตาม §7 |
| เปิด URL tunnel ใน browser ได้ JSON `{"error":"api-only",...}` | รันอยู่ในโหมด **noweb** — เป็นพฤติกรรมถูกต้อง (ไม่ใช่บั๊ก): tunnel ให้บริการ API เท่านั้น | เปิดเว็บจากลิงก์ workers.dev ที่ deploy ไว้; ถ้าอยากมีหน้าเว็บที่ LOCAL port → สลับกลับ full mode (`npm run trycloudflare`) |
| เริ่ม stack ไม่ได้: `container web is unhealthy` / crash loop | ดู log ตัวนั้น (`docker logs flowboard-trycloudflare-web-1`) + แก้ตามสาเหตุ | build ใหม่: `docker compose ... build --no-cache web` |
| tunnel ได้ 429 / error 1015 | ถูก rate limit (Cloudflare Quick Tunnel) | สคริปต์จะ stop cloudflared ให้เอง — รอ 15–30 นาที แล้วรันใหม่ ใช้ LOCAL URL (LAN) ชั่วคราวระหว่างนี้ |
| เจอ `__name is not defined` บน browser | Browser ยังใช้ JS chunk เก่าจาก SW cache (cache-first) | DevTools → Application → Clear site data (ติ๊ก Unregister service workers) — sw v2 จะแก้ให้อัตโนมัติหลัง deploy ถัดไป |
| `docker info` ต่อไม่ได้ | Docker Desktop ยังไม่ได้เปิด | เปิด Docker Desktop แล้วรันใหม่ |
| publish: `Failed to put KV key` / ค่าใน namespace คนละอันกับเว็บ | `FLOWBOARD_CF_KV_NAMESPACE_ID` ไม่ตรงกับ id ใน `wrangler.jsonc` | ให้ ID ตรงกันทั้ง 2 ที่ (§3.1) |
| Deploy เว็บไม่ผ่าน (403) | Token ไม่มี `Workers Scripts: Edit` | เพิ่ม permission (§3.2) |

---

## 11. ข้อควรจำสุดท้าย

- `.env.trycloudflare` มี token + JWT secret — **gitignored แล้ว ห้ามแชร์ / ห้าม commit**
- `trycloudflare-url.txt` / `runtime-config.published.json` เป็นไฟล์ runtime (gitignored) — เช็คสถานะล่าสุดได้จากไฟล์
- URL ของ Quick Tunnel จะสุ่มใหม่ทุกครั้งที่เริ่ม → สคริปต์ (หรือ publish เอง) ต้องอัปเดต KV อัตโนมัติ
- ผู้ใช้ควร **Install PWA จาก URL บน Workers** ไม่ใช่ จาก URL trycloudflare (URL นั้นไม่ถาวร)
- อยากแบบถาวรกว่านี้ (ไม่ต้องเปิดเครื่อง) — รอย้าย backend ขึ้นโฮสต์จริง (เช่น VPS + Cloudflare named tunnel) โครงสร้าง deploy เดิมใช้ได้ยกมา
