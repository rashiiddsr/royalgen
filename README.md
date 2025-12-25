# RGI NexaProc

RGI NexaProc is a procurement management platform for handling suppliers, goods, RFQs, quotations, orders, and financing workflows in one place. The frontend is a Vite + React application and the backend is an Express API backed by MySQL.

## Highlights

- **Authentication**: Email/username + password login, optional Google sign-in, password reset flows.
- **Suppliers**: Manage supplier profiles, contacts, payment terms, and status.
- **Goods Catalog**: Track SKU, category, unit, pricing, MOQ, and linked suppliers.
- **RFQ Management**: Create RFQs, attach documents, and track requester details.
- **Quotation Workflow**: Build quotations with multiple goods and track negotiation status.
- **Operational Modules**: Sales orders, invoices, and financing screens for procurement operations.
- **Activity Logging**: User actions are recorded in activity logs.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, Lucide icons
- **Backend**: Node.js (Express), MySQL (`mysql2`)
- **Tooling**: ESLint, TypeScript

## Repository Layout

```
.
├── api/                # Express API server
├── database/           # SQL schema
├── src/                # React frontend
├── public/             # Static assets (if any)
├── package.json        # Frontend scripts/dependencies
└── vite.config.ts      # Vite configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8+

### 1) Configure the Database

1. Create a database (example name: `rgi_nexaproc`).
2. Run the schema:

```
mysql -u <user> -p <database_name> < database/schema.sql
```

### 2) Configure Environment Variables

Create `api/.env` with your database and optional integration settings.

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=rgi_nexaproc

# Optional
PORT=4000
APP_BASE_URL=http://localhost:5173
GOOGLE_CLIENT_ID=
MAIL_HOST=
MAIL_PORT=
MAIL_ENCRYPTION=
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=
MAIL_FROM_NAME=RGI NexaProc
```

For the frontend, create a `.env` file in the repository root if you need to override defaults:

```
VITE_API_BASE_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=
```

### 3) Install Dependencies

Frontend:

```
npm install
```

Backend:

```
cd api
npm install
```

### 4) Run the Application

Start the API server:

```
cd api
npm start
```

Start the frontend:

```
npm run dev
```

Open `http://localhost:5173` in your browser.

## Common Scripts

### Frontend (root)

- `npm run dev` — start Vite dev server
- `npm run build` — build production assets
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript checks

### Backend (`api/`)

- `npm start` — start the Express server

## API Overview

The API exposes RESTful endpoints for core entities:

- `GET /api/:table` — list records
- `GET /api/:table/:id` — get a record by ID
- `POST /api/:table` — create a record
- `PUT /api/:table/:id` — update a record
- `DELETE /api/:table/:id` — delete a record

Authentication endpoints live under `/api/auth`:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/google`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/complete-setup`

## Operational Notes

- Uploaded files are stored in `api/uploads` and served from `/uploads`.
- Phone numbers are normalized to the `+62` format on the backend.
- Quotation totals and taxes are computed on the frontend before submission.

## UI Modules

- **Dashboard**: High-level summary and navigation
- **Suppliers**: Supplier profiles and contact information
- **Goods**: SKU-based goods catalog with MOQ and supplier linkage
- **RFQ**: Request for Quotation creation and tracking
- **Quotations**: Quotation creation, pricing, and status updates
- **Orders**: Sales orders overview
- **Invoices**: Invoice tracking
- **Financing**: Financing entries
- **Users**: User management and roles
- **Profile**: User profile settings

## Troubleshooting

- If the frontend cannot reach the API, verify `VITE_API_BASE_URL` and that the API server is running.
- If database queries fail, confirm your MySQL credentials and that the schema has been imported.
- For email/Google login issues, ensure the related environment variables are set in `api/.env` and `.env`.
