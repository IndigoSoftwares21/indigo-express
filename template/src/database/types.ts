/**
 * This file was automatically generated.
 * DO NOT MODIFY IT MANUALLY.
 *
 * Column names are camelCase (DB_TYPES_CASE=camel).
 * Table names always match the real DB table names.
 */

import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

// Database interface with auto-generated fields marked as optional
export interface Database {
  demo: {
    id?: ColumnType<number>;
    name: ColumnType<string>;
    createdAt?: ColumnType<Date | null>;
  };

  knex_migrations: {
    id?: ColumnType<number>;
    name: ColumnType<string | null>;
    batch: ColumnType<number | null>;
    migrationTime: ColumnType<Date | null>;
  };

  knex_migrations_lock: {
    index?: ColumnType<number>;
    isLocked: ColumnType<number | null>;
  };

}

// Utility types for better type safety
export type Row<Table extends keyof Database> = Selectable<Database[Table]>;
export type InsertRow<Table extends keyof Database> = Insertable<Database[Table]>;
export type UpdateRow<Table extends keyof Database> = Updateable<Database[Table]>;
