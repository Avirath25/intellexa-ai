import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentDb = null;
let currentDbType = null;
let currentDbPath = null;
let mysqlPool = null;

export function connectDatabase(config) {
    try {
        if (config.type === 'sqlite' || config.type === 'demo') {
            const dbPath = config.type === 'demo'
                ? path.join(__dirname, 'demo.db')
                : config.path;

            currentDb = new Database(dbPath);
            currentDb.pragma('journal_mode = WAL');
            currentDb.pragma('foreign_keys = ON');
            currentDbType = 'sqlite';
            currentDbPath = dbPath;

            return {
                success: true,
                message: `Connected to SQLite database${config.type === 'demo' ? ' (Demo)' : ''}`,
                type: 'sqlite'
            };
        }

        return { success: false, message: 'Use connectDatabaseAsync for MySQL/PostgreSQL' };
    } catch (error) {
        return { success: false, message: `Connection failed: ${error.message}` };
    }
}

export async function connectDatabaseAsync(config) {
    try {
        if (config.type === 'sqlite' || config.type === 'demo') {
            return connectDatabase(config);
        }

        if (config.type === 'mysql') {
            // Close existing connections
            if (mysqlPool) {
                await mysqlPool.end();
                mysqlPool = null;
            }
            if (currentDb) {
                currentDb.close();
                currentDb = null;
            }

            const host = config.host || 'localhost';
            const port = config.port || 3306;
            const user = config.username || 'root';
            const password = config.password || '';
            const database = config.database;

            if (!database) {
                return { success: false, message: 'Please provide a database name.' };
            }

            mysqlPool = mysql.createPool({
                host,
                port,
                user,
                password,
                database,
                waitForConnections: true,
                connectionLimit: 5,
                queueLimit: 0,
            });

            // Test connection
            const conn = await mysqlPool.getConnection();
            conn.release();

            currentDbType = 'mysql';
            currentDb = mysqlPool;

            return {
                success: true,
                message: `Connected to MySQL database "${database}" at ${host}:${port}`,
                type: 'mysql'
            };
        }

        if (config.type === 'postgresql') {
            return {
                success: false,
                message: 'PostgreSQL support coming soon. Use MySQL or the Demo Database.'
            };
        }

        return { success: false, message: 'Unsupported database type' };
    } catch (error) {
        return { success: false, message: `Connection failed: ${error.message}` };
    }
}

export function getDatabase() {
    return currentDb;
}

export function getDatabaseType() {
    return currentDbType;
}

export function isConnected() {
    return currentDb !== null || mysqlPool !== null;
}

export async function disconnectDatabase() {
    if (currentDbType === 'mysql' && mysqlPool) {
        await mysqlPool.end();
        mysqlPool = null;
    }
    if (currentDb && currentDbType === 'sqlite') {
        currentDb.close();
    }
    currentDb = null;
    currentDbType = null;
    currentDbPath = null;
}

export async function executeQuery(sql, params = []) {
    if (!isConnected()) {
        throw new Error('No database connected');
    }

    try {
        const trimmed = sql.trim().toUpperCase();
        if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH') && !trimmed.startsWith('PRAGMA') && !trimmed.startsWith('SHOW')) {
            return { success: false, rows: [], error: 'Only SELECT queries are allowed for safety.' };
        }

        if (currentDbType === 'mysql') {
            const [rows] = await mysqlPool.execute(sql, params);
            return { success: true, rows, rowCount: rows.length };
        } else {
            // SQLite
            const stmt = currentDb.prepare(sql);
            const rows = stmt.all(...params);
            return { success: true, rows, rowCount: rows.length };
        }
    } catch (error) {
        return { success: false, rows: [], error: error.message };
    }
}
