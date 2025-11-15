# RetailCloudHQ

RetailCloudHQ is an end-to-end retail operations platform that unifies multi-store management, financial tracking, lottery reconciliation, handheld inventory, and scheduling tools into a single workflow. The repository is organised as a monorepo that powers the web admin portal, public REST API, and companion Android app.

## Monorepo Overview

```
RetailCloudHQ/
├── backend/                # Node.js + Express REST API backed by PostgreSQL
│   ├── config/             # SQL migrations, schema definitions, connection helpers
│   ├── middleware/         # Auth, audit logging, and error instrumentation
│   ├── models/             # Query builders and data access helpers
│   ├── routes/             # REST endpoints grouped by domain
│   ├── services/           # Integrations, notifications, reports, schedulers
│   └── scripts/            # Database bootstrap and maintenance tooling
├── frontend/               # React 19 + Vite admin console with Tailwind UI
│   ├── src/components/     # Reusable UI widgets (tables, forms, layouts)
│   ├── src/pages/          # Feature dashboards (revenue, lottery, billing, etc.)
│   ├── src/contexts/       # Auth + store selection providers
│   └── src/services/       # Axios API client covering every backend route
├── RetailCloudHQApp/       # React Native 0.73 handheld inventory/lottery app
│   ├── android/ios/        # Native platform projects
│   └── src/                # TypeScript screens, navigation, offline helpers
└── docs/                   # Deep-dive setup guides and integration playbooks
```

## Technology Stack

- **Core backend:** Node 18+, Express 4, PostgreSQL 14+, JWT auth, cron-based schedulers, Google APIs.
- **Web frontend:** React 19, Vite, Tailwind CSS, React Router, Recharts, Axios.
- **Mobile client:** React Native 0.73 (Android-first), AsyncStorage, Vision Camera (barcode), axios.
- **Automation & integrations:** Gmail monitoring, recurring expense engine, notification service, audit logging, XLSX import/export.
- **Deployment target:** Railway (API + Postgres) and Netlify (frontend). Production relies on `VITE_API_URL=https://retailcloudhq-production.up.railway.app` and `CORS_ORIGIN=https://retailcloudhq.netlify.app`.

## Feature Highlights

- **Hierarchical user & store management:** Super Admin → Admin → Manager → Employee roles with scoped data access and device registrations.
- **Financial operations:** Daily revenue, lottery (instant/draw), cash-on-hand, bank deposits, payroll, utilities, operating expenses, COGS, and journal entries.
- **Inventory & purchasing:** Product catalog, inventory orders, vendor invoices, barcode-ready handheld workflows, customer tabs, credit cards, and bank management.
- **Billing & subscriptions:** Store subscriptions, feature pricing, invoices, payment history, notifications, and license tracking with document uploads.
- **Automation:** Gmail parsing for lottery results, scheduled recurring expenses, notification digests, audit logging and reporting exports.
- **Observability:** Structured JSON error logging to `backend/logs/errors.json`, `/health` endpoint, and admin UI dashboards.

## Prerequisites

- Node.js 18+ (required for React 19 and React Native toolchains)
- npm (or pnpm/yarn) for dependency management
- PostgreSQL 14+ with a database named `retail_management`
- Android Studio + JDK 17 (only if you plan to run the mobile app)
- Optional: Google Cloud service account with Gmail API credentials for lottery email ingestion

## Local Development

### 1. Backend API

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Create environment variables (`create-env.sh` provides a starter template tailored for macOS usernames):
   ```bash
   ./create-env.sh  # or craft your own .env
   ```
   Essential keys:
   ```env
   NODE_ENV=development
   PORT=3000

   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=retail_management
   DB_USER=postgres
   DB_PASSWORD=your_password

   JWT_SECRET=generate-a-long-random-string
   JWT_EXPIRE=7d

   CORS_ORIGIN=http://localhost:5173
   ENABLE_EMAIL_MONITOR=false
   ```
3. Prepare the database:
   ```bash
   createdb retail_management
   node scripts/init-db.js
   ```
   The init script seeds base roles, default settings, and (optionally) a Super Admin user when `SUPER_ADMIN_*` variables are set.
4. Run the API:
   ```bash
   npm run dev     # nodemon-backed hot reload
   # or
   npm start       # production mode
   ```
   The server exposes `/` and `/health` for quick smoke tests. Background cron jobs (recurring expenses, notifications) start automatically unless disabled via env.

#### Useful backend scripts

- `node scripts/run-migration.js` – apply targeted SQL migrations stored in `config`.
- `node scripts/verify-db.js` – inspect schema health and connection.
- `node scripts/add-license-management-feature.js` and `add-audit-logs.js` – seed advanced feature toggles.

### 2. Web Frontend (Vite + React)

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Configure environment:
   ```env
   # frontend/.env
   VITE_API_URL=http://localhost:3000
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
   The admin console lives at `http://localhost:5173`. Authentication, store context, and all feature pages rely on the API client inside `src/services/api.js`.
4. Lint/build:
   ```bash
   npm run lint
   npm run build
   ```

### 3. React Native Handheld App

1. Install dependencies:
   ```bash
   cd RetailCloudHQApp
   npm install
   ```
2. Configure API base URL in `src/api/mobileDevicesAPI.ts` (development defaults to your LAN IP on port 3000). Ensure the backend `HOST` env is `0.0.0.0` for device access.
3. Start Metro and launch on Android:
   ```bash
   npm start        # Metro bundler
   npm run android  # requires emulator or device + USB debugging
   ```
   The app supports device registration (paired with admin-generated codes), live permission sync, locking, and inventory workflows. See `docs/ANDROID_APP_SETUP.md` for deeper instructions.

## Data & Integrations

- **Database schema:** Complete definitions live in `backend/config/database.sql` with supplemental migrations in the same directory.
- **Gmail lottery monitor:** When `ENABLE_EMAIL_MONITOR=true`, the cron defined in `services/emailMonitorCron.js` polls linked mailbox accounts to automate lottery report ingestion.
- **Recurring expenses:** `services/recurringExpensesService.js` generates expenses daily at 3 AM (America/New_York) and exposes manual triggers via `/api/recurring-expenses/process`.
- **Notifications:** Alerts for overdue invoices, payment reminders, device lock statuses, etc., are generated nightly at 4 AM and surfaced in the admin UI (`/notifications` routes).
- **Square POS auto-sync:** Provide production credentials via `SQUARE_CLIENT_ID`, `SQUARE_CLIENT_SECRET`, `SQUARE_REDIRECT_URI`, and scopes such as `SQUARE_SCOPES="MERCHANT_PROFILE_READ PAYMENTS_READ PAYOUTS_READ"`. Set `ENABLE_SQUARE_SYNC_CRON=true` (default) and optionally `SQUARE_SYNC_START_DATE=2025-11-01` to control the first day to ingest. Backfill historical card totals with `node scripts/square-backfill.js --all --start=2025-11-01`, then the cron defined in `services/squareSyncCron.js` keeps every connected store updated roughly every five minutes (tune `SQUARE_SYNC_CRON` if you need a different cadence).

## Deployment Notes

- **Backend (Railway):**
  - Set `CORS_ORIGIN=https://retailcloudhq.netlify.app` (comma-separate additional origins).
  - Run `node scripts/init-db.js` after provisioning the managed PostgreSQL instance.
  - Configure optional vars: `ENABLE_EMAIL_MONITOR`, `GOOGLE_APPLICATION_CREDENTIALS`, `SMTP_*` (if email dispatch is enabled).
- **Frontend (Netlify):**
  - Build command: `npm run build`
  - Publish directory: `dist`
  - Required env: `VITE_API_URL=https://retailcloudhq-production.up.railway.app`
- **Mobile:** Update `API_BASE_URL` to point at Railway (or internal reverse proxy) before generating a release APK with `./gradlew assembleRelease`.

## Documentation & Further Reading

- `backend/README.md` – exhaustive API surfaces, auth flows, and role matrix.
- `docs/QUICK_START.md` – onboarding checklist covering backend + frontend deployment.
- `docs/FRONTEND_INTEGRATION_SETUP.md` – device registration UX and end-to-end mobile handshake.
- `docs/ANDROID_APP_SETUP.md` – React Native environment, barcode scanning, and permission management.

## License & Support

RetailCloudHQ is proprietary and intended for internal use only. For questions, reach out to the RetailCloudHQ engineering team.

