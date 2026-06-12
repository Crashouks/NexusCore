# NexusCore

Game library web application for cloud gaming — C# API + React client.

## Prerequisites

Install these before running the app:

| Tool | Version | Download |
|------|---------|----------|
| [.NET SDK](https://dotnet.microsoft.com/download) | 10.x | Powers the API |
| [Node.js](https://nodejs.org/) | 18+ (LTS recommended) | Powers the React client |
| [MySQL](https://dev.mysql.com/downloads/) | 8.x | Database (or use XAMPP/WAMP) |

Make sure MySQL is running on port **3306** before starting the app.

## Quick start (Windows)

1. Clone the repository:
   ```powershell
   git clone https://github.com/Crashouks/NexusCore.git
   cd NexusCore
   ```

2. Start the app — double-click **`start.bat`** in the project root, or run:
   ```powershell
   .\start.ps1
   ```

   On first run, the launcher will:
   - Create `.env` files from templates (edit `nexuscore\.env` and set `DB_PASSWORD` if MySQL seed fails)
   - Install npm dependencies
   - Seed the database
   - Start the API and React client
   - Open **http://localhost:5173** in your browser

   Sign in with one of the [default accounts](#default-login-accounts) below.

## Quick start (macOS / Linux)

```bash
git clone https://github.com/Crashouks/NexusCore.git
cd NexusCore/nexuscore

cp .env.example .env
cp client/.env.example client/.env
# Edit .env and set DB_PASSWORD if needed

npm run setup
npm run seed
npm run dev
```

Open **http://localhost:5173** in your browser and sign in with one of the [default accounts](#default-login-accounts) below.

## URLs

| Service | URL |
|---------|-----|
| Web app | http://localhost:5173 |
| API | http://localhost:5000 |
| Swagger | http://localhost:5000/swagger |

## Default login accounts

These accounts are created when you run `npm run seed` (done automatically on first Windows start).

### Admin

| Field | Value |
|-------|-------|
| Username | `admin` |
| Email | `admin@nexuscore.com` |
| Password | `admin123` |
| Role | Admin |
| Balance | $1000.00 |
| Cloud plan | Ultimate |

Use this account to access admin features (user management, game moderation, etc.).

### Developer

| Field | Value |
|-------|-------|
| Username | `devuser` |
| Email | `dev@nexuscore.com` |
| Password | `dev123` |
| Role | Developer (approved) |
| Balance | $500.00 |
| Cloud plan | Pro |

Use this account to test the developer portal (submit and manage games).

**Quick copy — sign in with email + password:**

```
Admin:     admin@nexuscore.com  /  admin123
Developer: dev@nexuscore.com    /  dev123
```

## Manual start (separate terminals)

**Terminal 1 — API:**
```bash
cd nexuscore
dotnet run --project NexusCore.Api --urls http://localhost:5000
```

**Terminal 2 — React client:**
```bash
cd nexuscore/client
npm install
npm run dev
```

## Visual Studio

Open `nexuscore/NexusCore.Api/NexusCore.Api.sln` and press **F5**. Visual Studio starts the API and launches the Vite dev client automatically.

## Configuration

Database and API settings live in `nexuscore/.env`:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=          # your MySQL root password
DB_NAME=nexuscore
```

The React client uses `nexuscore/client/.env` only if you need to override the API URL. During local development, Vite proxies `/api` to the backend, so the default `/api` value works out of the box.

## Seed database

Creates the schema and sample games/users (safe to re-run):

```bash
cd nexuscore
npm run seed
```

## Stop the app

**Windows:** run `stop.bat` in the project root, or close the terminal running `start.ps1`.

**macOS / Linux:** press `Ctrl+C` in the terminal running `npm run dev`.

## Troubleshooting

- **API fails to connect to MySQL** — start MySQL (or XAMPP/WAMP), check `DB_PASSWORD` in `.env`, then run `npm run seed`.
- **Port 5000 or 5173 already in use** — run `stop.bat` (Windows) or kill the process using that port, then start again.
- **Empty store after login** — run `npm run seed` from the `nexuscore` folder.

## Project structure

```
NexusCore/
├── start.bat / start.ps1   # One-command launcher (Windows)
├── stop.bat                # Stop dev servers (Windows)
└── nexuscore/
    ├── NexusCore.Api/      # C# ASP.NET Core API
    ├── client/             # React + Vite frontend
    ├── schema.sql          # Database schema
    └── seed.js             # Sample data seeder
```
