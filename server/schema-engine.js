import { getDatabase, getDatabaseType, getMongoDb } from './db-connector.js';
import mysql from 'mysql2/promise';

let cachedSchema = null;

export async function analyzeSchema() {
    const dbType = getDatabaseType();
    const db = getDatabase();
    if (!db) throw new Error('No database connected');

    if (dbType === 'mysql') {
        return await analyzeMySQLSchema(db);
    } else if (dbType === 'mongodb') {
        return await analyzeMongoSchema(getMongoDb());
    } else {
        return analyzeSQLiteSchema(db);
    }
}

// ═══════════════════════════════════════
//  MYSQL SCHEMA ANALYSIS
// ═══════════════════════════════════════

async function analyzeMySQLSchema(pool) {
    const schema = { tables: [], relationships: [] };

    // Get all tables
    const [tables] = await pool.execute(
        "SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
    );

    for (const table of tables) {
        const tableName = table.TABLE_NAME;

        // Get columns
        const [columns] = await pool.execute(
            `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, IS_NULLABLE, COLUMN_DEFAULT, EXTRA 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
            [tableName]
        );

        // Get foreign keys
        const [foreignKeys] = await pool.execute(
            `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME 
       FROM information_schema.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
            [tableName]
        );

        // Get indexes
        const [indexes] = await pool.execute(
            `SHOW INDEX FROM \`${tableName}\``
        );

        // Get actual row count
        let rowCount = table.TABLE_ROWS || 0;
        try {
            const [countResult] = await pool.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
            rowCount = countResult[0].count;
        } catch (e) {
            // fallback to TABLE_ROWS estimate
        }

        const uniqueIndexes = [...new Set(indexes.filter(i => i.Non_unique === 0).map(i => i.Key_name))];

        const tableInfo = {
            name: tableName,
            columns: columns.map(col => ({
                name: col.COLUMN_NAME,
                type: col.DATA_TYPE.toUpperCase(),
                isPrimaryKey: col.COLUMN_KEY === 'PRI',
                isNullable: col.IS_NULLABLE === 'YES',
                defaultValue: col.COLUMN_DEFAULT
            })),
            primaryKeys: columns.filter(c => c.COLUMN_KEY === 'PRI').map(c => c.COLUMN_NAME),
            foreignKeys: foreignKeys.map(fk => ({
                column: fk.COLUMN_NAME,
                referencedTable: fk.REFERENCED_TABLE_NAME,
                referencedColumn: fk.REFERENCED_COLUMN_NAME
            })),
            indexes: uniqueIndexes.map(name => ({ name, unique: true })),
            rowCount
        };

        schema.tables.push(tableInfo);

        // Build relationships
        for (const fk of foreignKeys) {
            schema.relationships.push({
                from: { table: tableName, column: fk.COLUMN_NAME },
                to: { table: fk.REFERENCED_TABLE_NAME, column: fk.REFERENCED_COLUMN_NAME },
                type: 'many-to-one'
            });
        }
    }

    cachedSchema = schema;
    return schema;
}

// ═══════════════════════════════════════
//  MONGODB SCHEMA ANALYSIS
// ═══════════════════════════════════════

async function analyzeMongoSchema(db) {
    const schema = { tables: [], relationships: [] };
    const collections = await db.listCollections().toArray();

    for (const col of collections) {
        const name = col.name;
        const sample = await db.collection(name).find({}).limit(20).toArray();
        const rowCount = await db.collection(name).estimatedDocumentCount();

        // Infer columns from sample documents
        const fieldMap = {};
        for (const doc of sample) {
            for (const [key, val] of Object.entries(doc)) {
                if (!fieldMap[key]) {
                    let type = typeof val;
                    if (val instanceof Date) type = 'date';
                    else if (Array.isArray(val)) type = 'array';
                    else if (val && typeof val === 'object') type = 'object';
                    fieldMap[key] = type.toUpperCase();
                }
            }
        }

        schema.tables.push({
            name,
            columns: Object.entries(fieldMap).map(([k, v]) => ({
                name: k,
                type: v,
                isPrimaryKey: k === '_id',
                isNullable: true,
                defaultValue: null
            })),
            primaryKeys: ['_id'],
            foreignKeys: [],
            indexes: [{ name: '_id_', unique: true }],
            rowCount
        });
    }

    cachedSchema = schema;
    return schema;
}

// ═══════════════════════════════════════
//  SQLITE SCHEMA ANALYSIS
// ═══════════════════════════════════════

function analyzeSQLiteSchema(db) {
    const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();

    const schema = { tables: [], relationships: [] };

    for (const table of tables) {
        const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all();
        const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${table.name}")`).all();
        const indexList = db.prepare(`PRAGMA index_list("${table.name}")`).all();
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM "${table.name}"`).get();

        const tableInfo = {
            name: table.name,
            columns: columns.map(col => ({
                name: col.name,
                type: col.type,
                isPrimaryKey: col.pk === 1,
                isNullable: col.notnull === 0,
                defaultValue: col.dflt_value
            })),
            primaryKeys: columns.filter(c => c.pk === 1).map(c => c.name),
            foreignKeys: foreignKeys.map(fk => ({
                column: fk.from,
                referencedTable: fk.table,
                referencedColumn: fk.to
            })),
            indexes: indexList.map(idx => ({
                name: idx.name,
                unique: idx.unique === 1
            })),
            rowCount: countResult.count
        };

        schema.tables.push(tableInfo);

        for (const fk of foreignKeys) {
            schema.relationships.push({
                from: { table: table.name, column: fk.from },
                to: { table: fk.table, column: fk.to },
                type: 'many-to-one'
            });
        }
    }

    cachedSchema = schema;
    return schema;
}

export function getSchema() {
    return cachedSchema;
}

export function getSchemaContext() {
    if (!cachedSchema) return '';

    let context = 'DATABASE SCHEMA:\n\n';
    for (const table of cachedSchema.tables) {
        context += `TABLE: ${table.name} (${table.rowCount} rows)\n`;
        context += `  Columns:\n`;
        for (const col of table.columns) {
            let desc = `    - ${col.name} (${col.type})`;
            if (col.isPrimaryKey) desc += ' [PRIMARY KEY]';
            context += desc + '\n';
        }
        if (table.foreignKeys.length > 0) {
            context += `  Foreign Keys:\n`;
            for (const fk of table.foreignKeys) {
                context += `    - ${fk.column} → ${fk.referencedTable}.${fk.referencedColumn}\n`;
            }
        }
        context += '\n';
    }

    if (cachedSchema.relationships.length > 0) {
        context += 'RELATIONSHIPS:\n';
        for (const rel of cachedSchema.relationships) {
            context += `  ${rel.from.table}.${rel.from.column} → ${rel.to.table}.${rel.to.column}\n`;
        }
    }

    return context;
}

export function getTableNames() {
    if (!cachedSchema) return [];
    return cachedSchema.tables.map(t => t.name);
}

export function getColumnNames(tableName) {
    if (!cachedSchema) return [];
    const table = cachedSchema.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
    return table ? table.columns.map(c => c.name) : [];
}
