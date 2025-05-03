# Indigo Express

A robust TypeScript-based Express API template with PostgreSQL database integration, featuring Knex migrations and Kysely query builder for type-safe database operations.

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

1. After project creation, review the `.env` file in your project root:

```env
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=indigo_db
DB_PORT=5432
```

2. Install dependencies:

```bash
npm install
```

### Running the Application

The application utilizes Docker for consistent development environments:

1. Fresh Start (Wipes DB and starts fresh):

```bash
npm run fresh
```

This will:
- Stop and remove all existing containers and volumes
- Rebuild and start the containers
- Start the application with hot-reloading

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
- Build and start the API container
- Enable hot-reloading for development

> ⚠️ Note: The application requires Docker to run. Make sure Docker is installed and running on your system.

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
import { db } from "@/database/kysely";
import type { Row, InsertRow, UpdateRow } from "@/database/types";

// Select
const users = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", userId)
    .execute();

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
│   ├── app.ts              # Application entry point
│   ├── database/           # Database configuration and utilities
│   │   ├── index.ts        # Database module entry point
│   │   ├── kysely.ts       # Kysely configuration
│   │   └── types.ts        # Generated database types
│   ├── routes/             # API routes
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Express middleware
│   └── utils/              # Utility functions
├── migrations/
│   ├── scripts/            # Migration files
│   └── hooks.ts            # Migration hooks
├── scripts/
│   ├── create-migration.ts # Migration creation script
│   └── generate-db-types.ts # Type generation script
├── docker-compose.yml      # Docker configuration
├── Dockerfile.dev          # Development Dockerfile
├── knexfile.ts             # Knex configuration
└── package.json
```

## 🔧 Development Workflow

1. Create a new feature branch:

```bash
git switch -c feature/your-feature
```

2. Make your changes

3. Test your changes:

```bash
npm run test
```

4. Start the application in development mode:

```bash
npm run dev
```

## 📝 Features

- **Type-Safe Database Operations**: Fully typed database queries with Kysely
- **Migration System**: Easy database schema management with Knex migrations
- **Docker Integration**: Consistent development environments
- **Hot Reloading**: Fast development iterations
- **Express Middleware Structure**: Organized middleware architecture
- **Environment Configuration**: Simple environment variable management
- **Development Tooling**: Scripts for common development tasks

## 📋 Available Scripts

- `npm run dev`: Start development server with hot reloading
- `npm run fresh`: Fresh start (rebuild containers and database)
- `npm run build`: Build the project
- `npm run start`: Start the built project
- `npm run migrate:new -- name`: Create a new migration
- `npm run migrate-up:once`: Run the next pending migration
- `npm run migrate-up:all`: Run all pending migrations
- `npm run migrate-down:once`: Rollback the last migration
- `npm run generate-types`: Generate database types
- `npm run test`: Run tests

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.