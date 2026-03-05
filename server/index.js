import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase, connectDatabaseAsync, executeQuery, isConnected, disconnectDatabase } from './db-connector.js';
import { analyzeSchema, getSchema, getSchemaContext } from './schema-engine.js';
import { processNaturalLanguage, resetContext, setDbType } from './nl-to-sql.js';
import { generateInsights } from './insight-generator.js';
import { getDatabaseType } from './db-connector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Query history store
const queryHistory = [];

// ═══════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', connected: isConnected() });
});

// Connect to database
app.post('/api/connect', async (req, res) => {
    try {
        const { type, host, port, database, username, password, path: dbPath } = req.body;

        // Disconnect any existing connection
        if (isConnected()) {
            await disconnectDatabase();
            resetContext();
        }

        let result;
        if (type === 'mysql') {
            result = await connectDatabaseAsync({
                type, host, port, database, username, password
            });
        } else {
            result = connectDatabase({
                type: type || 'demo',
                host, database, username, password,
                path: dbPath
            });
        }

        if (result.success) {
            // Auto-analyze schema after connection
            const schema = await analyzeSchema();
            // Tell NL engine which DB type we're using
            setDbType(getDatabaseType());
            res.json({
                success: true,
                message: result.message,
                schema: schema
            });
        } else {
            res.json({ success: false, message: result.message });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Disconnect
app.post('/api/disconnect', async (req, res) => {
    await disconnectDatabase();
    resetContext();
    res.json({ success: true, message: 'Disconnected' });
});

// Get schema
app.get('/api/schema', (req, res) => {
    if (!isConnected()) {
        return res.json({ success: false, message: 'No database connected' });
    }
    const schema = getSchema();
    res.json({ success: true, schema });
});

// Natural language query
app.post('/api/query', async (req, res) => {
    try {
        const { question, isVoice } = req.body;

        if (!isConnected()) {
            return res.json({
                success: false,
                message: 'No database connected. Please connect first.'
            });
        }

        if (!question || question.trim().length === 0) {
            return res.json({ success: false, message: 'Please provide a question.' });
        }

        // Process NL to SQL
        const nlResult = processNaturalLanguage(question);

        if (nlResult.error) {
            return res.json({
                success: false,
                message: nlResult.error,
                suggestion: nlResult.suggestion
            });
        }

        // Execute the generated SQL (async for MySQL)
        const queryResult = await executeQuery(nlResult.sql);

        if (!queryResult.success) {
            return res.json({
                success: false,
                message: `Query error: ${queryResult.error}`,
                sql: nlResult.sql
            });
        }

        // Generate insights
        const insights = generateInsights(queryResult.rows, nlResult.intent, nlResult.description);

        // Store in history
        const historyEntry = {
            id: Date.now(),
            question,
            sql: nlResult.sql,
            chartType: nlResult.chartType,
            description: nlResult.description,
            rowCount: queryResult.rowCount,
            timestamp: new Date().toISOString(),
            isVoice: isVoice || false
        };
        queryHistory.unshift(historyEntry);
        if (queryHistory.length > 50) queryHistory.pop();

        res.json({
            success: true,
            data: {
                rows: queryResult.rows,
                rowCount: queryResult.rowCount,
                sql: nlResult.sql,
                chartType: nlResult.chartType,
                description: nlResult.description,
                intent: nlResult.intent,
                insights
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Query history
app.get('/api/history', (req, res) => {
    res.json({ success: true, history: queryHistory });
});

// Clear history
app.delete('/api/history', (req, res) => {
    queryHistory.length = 0;
    res.json({ success: true });
});

// ═══════════════════════════════════════════════
//  STATIC ASSETS & FRONTEND SERVING
// ═══════════════════════════════════════════════

// Serve static files from the 'dist' folder (created by npm run build)
const clientDistPath = path.join(__dirname, '../dist');
app.use(express.static(clientDistPath));

// Fallback: serve index.html for any non-API routes (React Router support)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    }
});

// ═══════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════

app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║   🧠 INTELLEXA-AI Server Running                      ║');
    console.log(`║   📡 API: http://localhost:${PORT}                       ║`);
    console.log('║   🔌 Ready for database connections (SQLite + MySQL)   ║');
    console.log('║                                                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
});
