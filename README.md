# CRM Project

A modern CRM application built with Next.js, TypeScript, Tailwind CSS, Drizzle ORM, Neon Database, and Stack Auth.

## Features

- 🎯 **ChatGPT-style Projects Page** - Clean and intuitive project management interface
- 🔐 **Authentication** - Powered by Stack Auth
- 💾 **Database** - PostgreSQL with Neon serverless database
- 🎨 **Modern UI** - Built with Tailwind CSS
- ⚡ **Type-safe** - Full TypeScript support
- 🏗️ **Clean Architecture** - Layered backend structure

## Architecture

The project follows a clean, layered architecture:

### Backend Structure

- **API routes / server actions**: Thin HTTP/auth boundary. Do request validation/auth and delegate.
- **server/modules/**: Feature orchestrators. Compose DB, services, validation, and business rules. No direct external HTTP except through services.
- **lib/services/**: Thin, stateless adapters to external systems (OpenAI, Jira, Mailchimp, Stack Auth client, etc.). No business logic or permission checks—just config + HTTP calls. Safe to reuse across modules.

### Guidelines

- Keep per-vendor clients in `lib/services/` (e.g., `services/jira/client.ts`, `services/mailchimp/*`, `services/openai/*`).
- Keep feature rules and sequencing in `server/modules/<feature>` (e.g., project creation logic).
- Routes should import module functions, not call services directly.
- Services should not reach into the DB or check permissions.
- Use Zod at the API boundary to validate inputs before they reach modules.
- Services are pure adapters—no `NextResponse`, no request/response objects, no use of `cookies()`/`headers()`; keep them runtime-agnostic.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Neon Database account (https://neon.tech)
- A Stack Auth account (https://stack-auth.com)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/scottypann18/us-chatgpt.git
cd us-chatgpt
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:
- `DATABASE_URL`: Your Neon database connection string
- `NEXT_PUBLIC_STACK_PROJECT_ID`: Your Stack Auth project ID
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`: Your Stack Auth publishable key
- `STACK_SECRET_SERVER_KEY`: Your Stack Auth secret key

4. Run database migrations:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm start` - Run the production build
- `npm run lint` - Run ESLint
- `npm run db:push` - Push database schema changes
- `npm run db:studio` - Open Drizzle Studio

## Project Structure

```
├── app/
│   ├── actions/          # Server actions (API boundary)
│   ├── components/       # React components
│   ├── projects/         # Projects page
│   └── layout.tsx        # Root layout
├── lib/
│   └── services/         # External service adapters
├── server/
│   ├── db/              # Database configuration and schema
│   └── modules/         # Business logic modules
│       └── projects/    # Projects feature module
├── drizzle.config.ts    # Drizzle ORM configuration
└── package.json
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle
- **Authentication**: Stack Auth
- **Validation**: Zod

## Database Schema

The project includes a `projects` table with the following fields:

- `id` (UUID) - Primary key
- `name` (VARCHAR) - Project name
- `description` (TEXT) - Project description
- `userId` (VARCHAR) - User ID from Stack Auth
- `createdAt` (TIMESTAMP) - Creation timestamp
- `updatedAt` (TIMESTAMP) - Last update timestamp

## Adding New Features

When adding a new integration or feature:

1. Add a thin client in `lib/services/<service>/` for raw API calls
2. Add a module under `server/modules/<feature>` to apply business rules and call the client
3. Expose via server actions in `app/actions/<feature>.ts` that handle auth/HTTP
4. Create UI components in `app/components/` and pages in `app/<feature>/`

## License

MIT
