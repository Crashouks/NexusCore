# NexusCore

Game library web application with cloud gaming — C# API + React client + Windows cloud agent.

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| [.NET SDK](https://dotnet.microsoft.com/download) | 10.x | API |
| [Node.js](https://nodejs.org/) | 18+ (LTS) | React client + agent |
| [MySQL](https://dev.mysql.com/downloads/) | 8.x | Database (XAMPP/WAMP works) |

MySQL must be running on port **3306** before you start the app.

## Quick start (Windows)

1. Clone and enter the repo:
   ```powershell
   git clone https://github.com/Crashouks/NexusCore.git
   cd NexusCore
   ```

2. Start **MySQL**, then double-click **`start-site-network.bat`** (website + API).

3. Open **http://localhost:5173** and sign in with a [default account](#default-login-accounts).

For **two-PC** or **three-PC** testing over Tailscale or split networks, see **[Three ways to test NexusCore](#three-ways-to-test-nexuscore)**.

On first run the launcher will create `.env` files, install dependencies, seed the database, and start the API + Vite client. Edit `nexuscore\.env` and set `DB_PASSWORD` if seed fails.

### Launchers

| File | Purpose |
|------|---------|
| **`start-site-network.bat`** | Website + API over HTTP (binds `0.0.0.0` — localhost, Tailscale IP, or LAN) |
| **`start-site-https.bat`** | Same as above + **HTTPS** via Tailscale Serve (recommended for remote play) |
| **`start-cloud-gaming.bat`** | Cloud agent (screen stream + game launch on your PC) |
| **`stop.bat`** | Stop processes on ports 5000 / 5173 |

Run the site first, then the cloud agent in a **second window**.

### Cloud gaming setup (one time)

1. **Admin → Cloud → Add Machine** — tier **Real**, set **Agent password** and optional **Player password**.
2. Click **Games** on the server row (or use the games table when editing) — check which titles this server provides and set each **`.exe` path`** for real PCs.
3. **Save** — `config.json` downloads automatically. Save it as `nexuscore/agent/config.json`.
4. Run **`start-cloud-gaming.bat`**. Admin → Cloud should show **Agent: Connected**.

Enable **Cloud** on a game first: **Admin → Games → Edit → Cloud**.

---

## Three ways to test NexusCore

Pick the setup that matches your hardware. All three use the same launchers; only **where** each piece runs changes.

| Mode | PCs | Networks | Best for |
|------|-----|----------|----------|
| **[1) One PC](#1-one-pc-local)** | 1 | Same machine | Development, trying the store and cloud stream locally |
| **[2) Two PCs](#2-two-pcs-different-networks-tailscale)** | 2 | Different networks (joined with Tailscale) | Windows server + Kali/player laptop — most common demo |
| **[3) Three PCs](#3-three-pcs-three-networks-split)** | 3 | Three separate networks | Site host, gaming PC, and player are all different machines |

---

### 1) One PC (local)

Everything runs on a **single Windows PC**: MySQL, website, API, cloud agent, and the game.

| Component | Where | How |
|-----------|-------|-----|
| MySQL | This PC | XAMPP / WAMP / MySQL on port 3306 |
| Website + API | This PC | **`start-site-network.bat`** |
| Cloud agent | This PC | **`start-cloud-gaming.bat`** (second window) |
| Browser | This PC | **http://localhost:5173** |

**Steps**

1. Start **MySQL**.
2. Run **`start-site-network.bat`**.
3. Complete [cloud gaming setup](#cloud-gaming-setup-one-time) — save `config.json` to `nexuscore/agent/config.json` with:
   ```json
   "apiUrl": "http://localhost:5000/api"
   ```
4. Run **`start-cloud-gaming.bat`**.
5. Open **http://localhost:5173**, log in, go to **Cloud → Stream Now**, pick your **Real** server.

**Notes**

- No Tailscale required. You can leave `PUBLIC_API_URL` / `PUBLIC_WEB_URL` empty in `.env`.
- `NETWORK_MODE=1` still works; localhost is always allowed.

---

### 2) Two PCs, different networks (Tailscale)

**PC A (Windows)** = cloud server: site, API, MySQL, agent, and game.  
**PC B (e.g. Kali)** = player only: Tailscale + browser. No NexusCore install on PC B.

Both PCs must be on the **same Tailscale account** (tailnet), even if they are on different Wi‑Fi / countries.

```
  PC A (Windows)                         PC B (Kali / any OS)
  ┌─────────────────────┐                ┌──────────────────┐
  │ MySQL               │   Tailscale    │ tailscale up     │
  │ start-site-network  │◄──────────────►│ browser only     │
  │ start-cloud-gaming  │   100.x.x.x    │                  │
  │ game + agent        │                │ open player URL  │
  └─────────────────────┘                └──────────────────┘
```

**On PC A (Windows server)**

1. Install and connect **Tailscale** (`tailscale up`). Note your Tailscale IP (e.g. `100.69.4.120`) or use **`start-site-https.bat`** for `https://your-pc.tailXXXX.ts.net`.
2. Edit `nexuscore/.env`:
   ```env
   NETWORK_MODE=1
   PUBLIC_API_URL=http://100.69.4.120:5000/api
   PUBLIC_WEB_URL=http://100.69.4.120:5173
   ```
   (Replace with your Tailscale IP.)
3. Run **`stop.bat`**, then **`start-site-network.bat`**.
4. Allow **Windows Firewall** inbound on **TCP 5000** and **5173**.
5. Complete [cloud gaming setup](#cloud-gaming-setup-one-time). Agent on the same PC uses `"apiUrl": "http://localhost:5000/api"`.
6. Run **`start-cloud-gaming.bat`**.

**On PC B (player)**

```bash
sudo tailscale up
tailscale status    # must list the Windows machine
```

Open **`http://100.69.4.120:5173`** (Tailscale IP — **not** `localhost`).  
For HTTPS: **`https://your-windows-pc.tailXXXX.ts.net`** after using `start-site-https.bat` on PC A.

Log in → **Stream Now** → **Real** server → click the game view for keyboard/mouse.

**Optional: HTTPS on PC A**

Run **`start-site-https.bat`** instead of step 3. It configures Tailscale Serve and sets `https://` URLs in `.env` automatically.

---

### 3) Three PCs, three networks (split)

Split the stack so **site**, **gaming agent**, and **player** are on separate machines — each can be on a different network (home, school, mobile hotspot, etc.). They still need a **reachable URL** between them (Tailscale or a tunnel like ngrok).

| PC | Role | Runs | Network |
|----|------|------|---------|
| **1 — Host** | Website + API + MySQL | `start-site-network.bat` | Any |
| **2 — Gaming** | Cloud agent + games (Windows) | `start-cloud-gaming.bat` only | Any |
| **3 — Player** | Browser only | Nothing from repo | Any |

```
  PC 1 (Host)              PC 2 (Gaming PC)           PC 3 (Player)
  ┌──────────────┐         ┌─────────────────┐        ┌─────────────┐
  │ MySQL        │         │ agent + games   │        │ browser     │
  │ site + API   │◄────────│ apiUrl = PUBLIC │        │ open PUBLIC │
  │ PUBLIC_* URLs│  API    │ _API_URL        │        │ _WEB_URL    │
  └──────┬───────┘         └─────────────────┘        └──────▲──────┘
         │                                                    │
         └──────────────── PUBLIC_WEB_URL ────────────────────┘
                    (Tailscale / ngrok — all PCs must reach host)
```

**On PC 1 (host)**

1. Connect **Tailscale** (or set up **ngrok** / Cloudflare Tunnel for public HTTPS URLs).
2. Set `nexuscore/.env`:
   ```env
   NETWORK_MODE=1
   PUBLIC_API_URL=http://100.x.x.x:5000/api
   PUBLIC_WEB_URL=http://100.x.x.x:5173
   ```
   Use your Tailscale IP or tunnel URL (e.g. `https://abc.ngrok-free.app/api`).
3. Run **`start-site-network.bat`**. Open firewall ports **5000** and **5173** if using Tailscale IP.
4. **Admin → Cloud** — note the **Player website** and **Agent API** URLs shown in the admin panel.

**On PC 2 (gaming PC — Windows only)**

1. Clone repo (or copy only `nexuscore/agent/`).
2. **Admin → Cloud → Save** on PC 1’s admin UI downloads `config.json`. Set:
   ```json
   "apiUrl": "http://100.x.x.x:5000/api"
   ```
   Must be PC 1’s **`PUBLIC_API_URL`** — not `localhost` unless the agent runs on PC 1.
3. Install agent deps: `cd nexuscore/agent && npm install`.
4. Run **`start-cloud-gaming.bat`**. Admin on PC 1 should show **Agent: Connected**.

**On PC 3 (player)**

1. Join the **same Tailscale tailnet** as PC 1 (or use the ngrok/tunnel web URL).
2. Open **`PUBLIC_WEB_URL`** from PC 1’s `.env` (e.g. `http://100.x.x.x:5173`).
3. Log in → **Stream Now** → pick the **Real** server tied to PC 2’s agent.

**Reachability options for 3-network setups**

| Method | PC 1 exposes | PC 2 agent `apiUrl` | PC 3 browser |
|--------|--------------|---------------------|--------------|
| **Tailscale** (recommended) | Tailscale IP or `*.ts.net` | `http://100.x.x.x:5000/api` | `http://100.x.x.x:5173` |
| **ngrok / tunnel** | `https://xyz.ngrok.app` | `https://xyz.ngrok.app/api` | `https://xyz.ngrok.app` |

All three machines must be able to **reach PC 1’s host URL**. PC 2 does not need to reach PC 3; the player connects to PC 1’s website, which coordinates streaming via PC 2’s agent.

---

### Troubleshooting (remote / multi-PC)

| Problem | Fix |
|---------|-----|
| Site won't load on player PC | Firewall on host; confirm `start-site-network.bat` is running; use Tailscale IP or `*.ts.net`, not host's LAN IP from another network |
| HTTPS certificate errors | Use Tailscale hostname from `start-site-https.bat`; run `tailscale serve reset` to revert to HTTP |
| `ping` / Tailscale fails | Both sides on same Tailscale account; run `tailscale up` |
| Agent Offline (split setup) | `config.json` `apiUrl` must be PC 1's `PUBLIC_API_URL`; correct `serverId` and agent password |
| "Cannot reach game server" | Hard refresh on player; `client/.env` must have `VITE_API_URL=/api` |
| Port already in use | **`stop.bat`**, wait a few seconds, start again |
| Stream fails | Choose **Real** server mapped to the connected agent, not fake Free/Pro servers |

---

## Quick start (macOS / Linux — server only)

The cloud **agent** is Windows-only. Linux/macOS can run the API + website:

```bash
git clone https://github.com/Crashouks/NexusCore.git
cd NexusCore/nexuscore

cp .env.example .env
cp client/.env.example client/.env
# Edit .env — set DB_PASSWORD if needed

npm run setup
npm run seed
npm run dev
```

Open **http://localhost:5173**.

---

## URLs

| Service | URL |
|---------|-----|
| Web app (local) | http://localhost:5173 |
| API (local) | http://localhost:5000 |
| Swagger | http://localhost:5000/swagger |

| Testing mode | Player opens |
|--------------|--------------|
| 1 PC | http://localhost:5173 |
| 2 / 3 PCs (Tailscale) | `PUBLIC_WEB_URL` from host `.env` (e.g. http://100.x.x.x:5173) |
| HTTPS (optional) | https://your-pc.tailXXXX.ts.net via `start-site-https.bat` |

---

## Default login accounts

Created by `npm run seed` (automatic on first Windows start).

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@nexuscore.com` | `admin123` |
| Developer | `dev@nexuscore.com` | `dev123` |

---

## Configuration

### `nexuscore/.env`

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=          # MySQL password
DB_NAME=nexuscore

# Remote / Tailscale (set before start-site-network.bat)
NETWORK_MODE=1
PUBLIC_API_URL=http://100.69.4.120:5000/api
PUBLIC_WEB_URL=http://100.69.4.120:5173
```

Leave `PUBLIC_*` empty for same-LAN only — the network launcher auto-detects your IP.

### `nexuscore/client/.env`

Use **`VITE_API_URL=/api`** so remote browsers (Kali, etc.) reach the API through the Vite proxy. `start-site-network.bat` syncs this automatically.

### `nexuscore/agent/config.json`

See `nexuscore/agent/config.example.json`. Download from **Admin → Cloud → Save** or **Agent** button.

---

## Manual start (terminals)

**Network mode (recommended on Windows):**
```powershell
cd nexuscore
npm run dev:network
```

**Localhost only:**
```bash
cd nexuscore
dotnet run --project NexusCore.Api --urls http://localhost:5000   # terminal 1
cd client && npm run dev                                           # terminal 2
```

**Cloud agent:**
```powershell
cd nexuscore\agent
npm install
npm start
```

---

## Visual Studio

Open `nexuscore/NexusCore.Api/NexusCore.Api.sln` and press **F5**.

---

## Stop the app

- **Windows:** `stop.bat` in the project root
- **Terminal:** `Ctrl+C`

---

## Troubleshooting

- **MySQL connection failed** — start MySQL, set `DB_PASSWORD` in `.env`, run `npm run seed`
- **Port 5000 or 5173 in use** — run `stop.bat`, then start again
- **Empty store** — `npm run seed` from `nexuscore`
- **Agent logs** — `nexuscore/agent/logs/agent.log`

---

## Project structure

```
NexusCore/
├── start-site-network.bat    # Website + API
├── start-cloud-gaming.bat    # Cloud agent (Windows)
├── stop.bat
└── nexuscore/
    ├── NexusCore.Api/        # C# ASP.NET Core API
    ├── client/               # React + Vite frontend
    ├── agent/                # Cloud agent (stream + input + game launch)
    ├── schema.sql
    └── seed.js
```
