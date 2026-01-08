# Indigo Express

A robust TypeScript-based Express API template with PostgreSQL database integration, featuring Knex migrations, Kysely query builder for type-safe database operations, and powerful code generation tools.

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g indigo-express

# Create a new project
indigo-express my-api-project
cd my-api-project

# Or create in current directory
mkdir my-project && cd my-project
indigo-express .
```

### Prerequisites

- Node.js (v18+)
- Docker and Docker Compose
- npm or yarn

### Environment Setup

1. After project creation, the `.env` file is automatically created with defaults:

```env
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=indigo_db
DB_PORT=5432
NODE_ENV=development
PORT=6969
API_VERSION=v1
```

2. Install dependencies:

```bash
npm install
```

### Running the Application

The application uses Docker for the PostgreSQL database only. The Node.js app runs locally with hot-reloading.

1. Fresh Start (Wipes DB and starts fresh):

```bash
npm run fresh
```

This will:

- Stop and remove all existing containers and volumes
- Rebuild and start PostgreSQL
- Start the application locally with hot-reloading

After running fresh, you need to run all migrations:

```bash
npm run migrate-up:all
```

2. Development Mode (Resume existing setup):

```bash
npm run dev
```

This will:

- Start PostgreSQL in a Docker container
- Start the Node.js app locally with hot-reloading

> ⚠️ Note: Docker is only required for the PostgreSQL database. The app runs natively on your machine.

## ⚡ Code Generation

Indigo Express includes powerful code generators to scaffold endpoints following best practices.

### Generate an Endpoint

```bash
npm run create:endpoint
```

This interactive CLI will:

1. Ask for HTTP method (GET, POST, PUT, PATCH, DELETE)
2. Let you select or create a scope (app, hub, admin, etc.)
3. Let you select or create a domain (users, products, etc.)
4. Let you customize controller, action, and query names
5. Ask if you need a Zod schema file
6. Show a preview and let you confirm or restart

**Example Flow:**

```
? Select HTTP method: GET
? Select or create a scope: app
? Select or create a domain: users
? Controller name: getAppUsers
? Action name: fetchAppUsers
? Query name: selectAppUsers
? Route path: /users
? Do you need a Zod schema file? Yes
```

**Generated Structure:**

```
src/
├── controllers/app/users/getAppUsers/
│   ├── index.ts
│   └── schema/getAppUsers.schema.ts
├── actions/app/users/fetchAppUsers/
│   ├── index.ts
│   └── queries/selectAppUsers.ts
└── routes/app.routes.ts (updated)
```

**Resulting Endpoint:** `GET /api/v1/app/users`

### Generate a Schema Helper

```bash
npm run create:helper
```

This creates reusable async validation helpers for Zod schemas:

```bash
? Enter helper name: select user by id
```

**Generated File:** `src/schemaHelpers/selectUserById.ts`

```typescript
import { db } from "@/database";
import { camelKeys } from "@/database/utils";

export const selectUserById = async ({}: {}) => {
  const result = await db
    .selectFrom("")
    .select([])
    .where("", "=", "")
    .executeTakeFirst();

  return result ? camelKeys(result) : null;
};
```

## 📚 Database Management

### Database Architecture

The project uses a dual-layer database approach:

- **Knex**: Handles database migrations and schema changes
- **Kysely**: Provides type-safe query building and execution

### Migrations

All migrations require Docker to be running. Make sure your Docker containers are up before running any migration commands.

#### Migration Workflow

1. Create a new migration:

```bash
npm run migrate:new -- migration_name
```

2. Run the new migration:

```bash
npm run migrate-up:once
```

3. To rollback (undo) the migration:

```bash
npm run migrate-down:once
```

> ⚠️ Note: All migration commands automatically regenerate TypeScript types for Kysely after execution.

### Database Types

TypeScript types are automatically generated from your database schema after each migration. The types are stored in `src/database/types.ts`.

To manually regenerate types:

```bash
npm run generate-types
```

### Query Examples

Using Kysely for type-safe queries:

```typescript
import { db } from "@/database";
import { camelKeys } from "@/database/utils";
import type { Row, InsertRow, UpdateRow } from "@/database/types";

// Select with camelCase transformation
const users = await db
  .selectFrom("users")
  .selectAll()
  .where("id", "=", userId)
  .execute();

const camelCasedUsers = camelKeys(users);

// Insert
const newUser: InsertRow<"users"> = {
  name: "John Doe",
  email: "john@example.com",
};
await db.insertInto("users").values(newUser).execute();

// Update
const updates: UpdateRow<"users"> = {
  name: "Jane Doe",
};
await db.updateTable("users").set(updates).where("id", "=", userId).execute();

// Transaction
await db.transaction().execute(async (trx) => {
  const user = await trx
    .insertInto("users")
    .values(newUser)
    .returning("id")
    .executeTakeFirst();

  await trx
    .insertInto("profiles")
    .values({
      userId: user.id,
      // ... other fields
    })
    .execute();
});
```

## 🏗️ Project Structure

```
my-api-project/
├── src/
│   ├── app.ts                 # Application entry point
│   ├── database/              # Database configuration and utilities
│   │   ├── index.ts           # Database module entry point
│   │   ├── kysely.ts          # Kysely configuration
│   │   ├── utils.ts           # camelKeys utility
│   │   └── types.ts           # Generated database types
│   ├── routes/                # API routes (auto-registered)
│   │   └── app.routes.ts      # Default app routes
│   ├── controllers/           # Route controllers (layered by scope/domain)
│   │   └── app/
│   │       └── users/
│   │           └── getAppUsers/
│   ├── actions/               # Business logic layer
│   │   └── app/
│   │       └── users/
│   │           └── fetchAppUsers/
│   ├── schemaHelpers/         # Reusable async validators
│   ├── constants/             # App constants
│   │   └── error_types.ts
│   ├── middlewares/           # Express middleware
│   └── utils/                 # Utility functions
│       ├── handleError/       # Error handling utility
│       ├── handleSuccess/     # Success response utility
│       ├── monitoring/        # Logging utility
│       └── camelize.ts        # Deep camelCase transformer
├── migrations/
│   ├── scripts/               # Migration files
│   └── queries/               # SQL migration queries
├── scripts/
│   ├── create-endpoint.ts     # Endpoint generator
│   ├── create-helper.ts       # Schema helper generator
│   ├── create-migration.ts    # Migration creation script
│   └── generate-db-types.ts   # Type generation script
├── docker/
│   └── postgres/
│       └── init.sql           # Database initialization
├── docker-compose.yml         # Docker configuration (PostgreSQL only)
├── knexfile.ts                # Knex configuration
└── package.json
```

## 🔧 Development Workflow

### Layered Architecture

Indigo Express follows a strict layered architecture:

1. **Routes** (`src/routes/*.routes.ts`): Define HTTP endpoints and wire to controllers
2. **Controllers** (`src/controllers/{scope}/{domain}/{operation}/`): Handle HTTP requests, validate input, call actions
3. **Actions** (`src/actions/{scope}/{domain}/{action}/`): Business logic orchestration
4. **Queries** (`src/actions/{scope}/{domain}/{action}/queries/`): Database operations with Kysely

### Naming Conventions

- **Controller**: `{verb}{Scope}{Operation}` (e.g., `getAppUsers`)
- **Action**: `{actionVerb}{Scope}{Operation}` (e.g., `fetchAppUsers`)
- **Query**: `{queryVerb}{Scope}{Operation}` (e.g., `selectAppUsers`)

**Verb Mapping:**

- POST → create/insert
- GET → fetch/select
- PUT/PATCH → modify/update
- DELETE → remove/delete

### API Versioning

All routes are automatically prefixed with `/api/{version}/{scope}`:

```
/api/v1/app/users
/api/v1/hub/products
```

Version is configurable via `API_VERSION` in `.env`.

## 📝 Features

- **Type-Safe Database Operations**: Fully typed database queries with Kysely
- **Code Generators**: Interactive CLI tools for scaffolding endpoints and helpers
- **Layered Architecture**: Clear separation of concerns (Routes → Controllers → Actions → Queries)
- **Automatic Key Transformation**: Snake_case DB columns → camelCase TypeScript
- **Migration System**: Easy database schema management with Knex migrations
- **Docker Integration**: PostgreSQL runs in Docker, app runs locally
- **Hot Reloading**: Fast development iterations with ts-node-dev
- **API Versioning**: Built-in versioning support
- **Error Handling**: Centralized error handling with detailed logging
- **Environment Configuration**: Simple environment variable management
- **Development Tooling**: Scripts for common development tasks

## 📋 Available Scripts

### Development

- `npm run dev`: Start development server with hot reloading
- `npm run fresh`: Fresh start (rebuild containers and database)
- `npm run build`: Build the project
- `npm run start`: Start the built project

### Code Generation

- `npm run create:endpoint`: Generate a new endpoint (controller, action, query)
- `npm run create:helper`: Generate a schema helper for async validation

### Database

- `npm run migrate:new -- name`: Create a new migration
- `npm run migrate-up:once`: Run the next pending migration
- `npm run migrate-up:all`: Run all pending migrations
- `npm run migrate-down:once`: Rollback the last migration
- `npm run migrate-down:all`: Rollback all migrations
- `npm run generate-types`: Generate database types

### Testing

- `npm run test`: Run tests
- `npm run lint`: Run ESLint

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## Mentions

Inspired by [Xest JS](https://xestjs.com/) and [Ersel Aker](https://github.com/ersel).
