# TyneBase Backend API

Fastify-based REST API server for TyneBase with RAG capabilities, authentication, and multi-tenant support.

## Features

- ⚡ **Fastify** - High-performance web framework
- 🔒 **Security** - Helmet for security headers, CORS configuration
- 🏢 **Multi-tenant** - Subdomain-based tenant isolation
- 📝 **Logging** - Pino logger with pretty printing in development
- ✅ **Validation** - Zod schemas for environment and request validation
- 🔐 **Authentication** - Supabase Auth integration
- 📊 **TypeScript** - Full type safety with strict mode

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Supabase project

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (development/production/test)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

## Development

Start the development server with hot reload:

```bash
npm run dev
```

Server will be available at `http://localhost:8080`

## Production

Build and start:

```bash
npm run build
npm start
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## API Endpoints

### Health Check
```
GET /health
```

Returns server status and uptime.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-25T07:55:22.698Z",
  "uptime": 13.577,
  "environment": "development"
}
```

### Root
```
GET /
```

Returns API information.

**Response:**
```json
{
  "name": "TyneBase API",
  "version": "1.0.0",
  "status": "running"
}
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── env.ts          # Environment configuration with Zod validation
│   └── server.ts           # Main server entry point
├── dist/                   # Compiled JavaScript (generated)
├── .env                    # Environment variables (not in git)
├── .env.example            # Example environment variables
├── package.json
├── tsconfig.json
└── README.md
```

## Security Features

- **Helmet** - Security headers (CSP, HSTS, etc.)
- **CORS** - Configurable origin whitelist
- **Environment Validation** - Zod schemas ensure required config is present
- **TypeScript Strict Mode** - Catch errors at compile time

## Next Steps

Phase 2 tasks will add:
- Tenant context middleware
- Authentication middleware
- Rate limiting
- Credit system integration
- Document and AI endpoints
