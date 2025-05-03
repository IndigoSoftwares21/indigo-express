import { promises as fs } from "fs";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { Kysely, PostgresDialect } from "kysely";

dotenv.config();

interface TableColumn {
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    udt_name: string;
}

interface TableGroups {
    [tableName: string]: TableColumn[];
}

async function main() {
    // Database connection details
    const connectionDetails = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    };

    const pool = new Pool(connectionDetails);

    try {
        // Query to get all tables and their columns
        const result = await pool.query(`
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.udt_name
      FROM 
        information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE 
        t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY 
        t.table_name,
        c.ordinal_position
    `);

        const tables = result.rows as TableColumn[];

        // Generate TypeScript interfaces
        let typeDefinitions = `/**
 * This file was automatically generated.
 * DO NOT MODIFY IT MANUALLY.
 */

import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

// Database interface with auto-generated fields marked as optional
export interface Database {
`;

        const tableGroups: TableGroups = tables.reduce((acc, row) => {
            if (!acc[row.table_name]) {
                acc[row.table_name] = [];
            }
            acc[row.table_name].push(row);
            return acc;
        }, {} as TableGroups);

        // PostgreSQL to TypeScript type mapping
        const typeMap: Record<string, string> = {
            integer: "number",
            bigint: "number",
            numeric: "number",
            decimal: "number",
            real: "number",
            "double precision": "number",
            smallint: "number",
            text: "string",
            "character varying": "string",
            varchar: "string",
            char: "string",
            boolean: "boolean",
            timestamp: "Date",
            "timestamp with time zone": "Date",
            "timestamp without time zone": "Date",
            date: "Date",
            time: "string",
            json: "unknown",
            jsonb: "unknown",
            uuid: "string",
        };

        // Generate interface for each table
        Object.entries(tableGroups).forEach(([tableName, columns]) => {
            typeDefinitions += `  ${tableName}: {
`;

            columns.forEach((column) => {
                const isNullable =
                    column.is_nullable === "YES" ? " | null" : "";
                const hasDefault = column.column_default !== null;
                const isGenerated =
                    hasDefault &&
                    column.column_default !== null &&
                    (column.column_default.startsWith("nextval") ||
                        column.column_default.includes("uuid_generate") ||
                        column.column_default.includes("now()") ||
                        column.column_default.includes("CURRENT_TIMESTAMP") ||
                        column.column_default.includes("CURRENT_DATE") ||
                        column.column_default.includes("gen_random_uuid()") ||
                        column.column_default.includes("uuid()") ||
                        column.column_name === "id" || // Most IDs are auto-generated
                        column.column_name === "created_at" || // Timestamps are often auto-generated
                        column.column_name === "updated_at");

                let tsType = typeMap[column.data_type] || "unknown";

                // Handle arrays
                if (column.data_type === "ARRAY") {
                    const elementType =
                        typeMap[column.udt_name.replace("_", "")] || "unknown";
                    tsType = `${elementType}[]`;
                }

                // Make auto-generated fields optional
                if (isGenerated) {
                    typeDefinitions += `    ${column.column_name}?: ColumnType<${tsType}${isNullable}>;
`;
                } else {
                    typeDefinitions += `    ${column.column_name}: ColumnType<${tsType}${isNullable}>;
`;
                }
            });

            typeDefinitions += `  };

`;
        });

        typeDefinitions += `}

// Utility types for better type safety
export type Row<Table extends keyof Database> = Selectable<Database[Table]>;
export type InsertRow<Table extends keyof Database> = Insertable<Database[Table]>;
export type UpdateRow<Table extends keyof Database> = Updateable<Database[Table]>;
`;

        // Write the generated types to a file
        await fs.writeFile("src/database/types.ts", typeDefinitions);

        console.log("✨ Database types generated successfully!");
    } finally {
        await pool.end();
    }
}

main().catch(console.error);
