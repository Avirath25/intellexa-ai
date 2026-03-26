import { getSchema, getTableNames, getColumnNames } from './schema-engine.js';

// Database type for quoting
let currentDbType = 'sqlite';

export function setDbType(type) {
    currentDbType = type || 'sqlite';
}

// Quote identifier based on DB type
function q(name) {
    if (currentDbType === 'mysql') return `\`${name}\``;
    if (currentDbType === 'mongodb') return name; // no quoting needed
    return `"${name}"`;
}

// Date format expression based on DB type
function dateFormat(col) {
    if (currentDbType === 'mysql') return `DATE_FORMAT(${col}, '%Y-%m')`;
    return `strftime('%Y-%m', ${col})`;
}

// Conversation context for follow-ups
let conversationContext = {
    lastTable: null,
    lastColumns: [],
    lastQuery: null,
    lastFilters: {},
    history: []
};

// ═══════════════════════════════════════════════════════
//  INTELLEXA NL-to-SQL ENGINE
//  Smart rule-based natural language to SQL converter
//  Pluggable architecture — swap with Gemini/OpenAI
// ═══════════════════════════════════════════════════════

export function processNaturalLanguage(userInput) {
    const input = userInput.toLowerCase().trim();
    const schema = getSchema();
    if (!schema) {
        return { error: 'No database connected. Please connect first.' };
    }

    const tableNames = getTableNames();

    // Detect intent
    const intent = detectIntent(input);

    // Find relevant tables
    const relevantTables = findRelevantTables(input, schema);

    // Check for follow-up context
    if (relevantTables.length === 0 && conversationContext.lastTable) {
        relevantTables.push(conversationContext.lastTable);
    }

    if (relevantTables.length === 0) {
        return {
            error: `I couldn't find any table related to "${userInput}". Could you mention a specific table or data type?`,
            suggestion: `Available tables: ${tableNames.join(', ')}`
        };
    }

    // MongoDB: generate aggregation pipeline
    if (currentDbType === 'mongodb') {
        const result = generateMongoQuery(input, intent, relevantTables, schema);
        conversationContext.lastTable = relevantTables[0];
        conversationContext.lastQuery = result.sql;
        conversationContext.history.push({ input: userInput, sql: result.sql });
        return result;
    }

    // Generate SQL based on intent
    const result = generateSQL(input, intent, relevantTables, schema);

    // Update conversation context
    conversationContext.lastTable = relevantTables[0];
    conversationContext.lastQuery = result.sql;
    conversationContext.history.push({ input: userInput, sql: result.sql });

    return result;
}

// ═══════════════════════════════════════════════════════
//  MONGODB AGGREGATION PIPELINE GENERATOR
// ═══════════════════════════════════════════════════════

function generateMongoQuery(input, intents, tables, schema) {
    const collection = tables[0];
    const tableSchema = schema.tables.find(t => t.name === collection);
    const topMatch = input.match(/top\s*(\d+)/i);
    const limitN = topMatch ? parseInt(topMatch[1]) : null;

    // Find amount/numeric field
    const amountPatterns = ['amount', 'total', 'price', 'revenue', 'cost', 'value', 'quantity', 'qty', 'sum', 'subtotal', 'sales'];
    const amountField = tableSchema?.columns.find(c =>
        amountPatterns.some(p => c.name.toLowerCase().includes(p)) &&
        ['NUMBER', 'DOUBLE', 'INT', 'FLOAT', 'DECIMAL', 'OBJECT'].includes(c.type)
    )?.name;

    // Find date field
    const datePatterns = ['date', 'created', 'timestamp', 'time', 'ordered', 'purchased', 'paid'];
    const dateField = tableSchema?.columns.find(c =>
        datePatterns.some(p => c.name.toLowerCase().includes(p))
    )?.name;

    // Find name/category field
    const namePatterns = ['name', 'title', 'label', 'category', 'type', 'status'];
    const nameField = tableSchema?.columns.find(c =>
        namePatterns.some(p => c.name.toLowerCase().includes(p)) && c.name !== '_id'
    )?.name;

    let pipeline = [];
    let chartType = 'table';
    let description = `Data from ${collection}`;
    let intent = intents[0] || 'list';

    if (intents.includes('trend') && dateField) {
        chartType = 'line';
        intent = 'trend';
        pipeline = [
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: `$${dateField}` } }, total: amountField ? { $sum: `$${amountField}` } : { $sum: 1 }, count: { $sum: 1 } } },
            { $sort: { '_id': 1 } }
        ];
        description = `Monthly trend from ${collection}`;
    } else if ((intents.includes('top') || intents.includes('bottom')) && nameField) {
        chartType = 'bar';
        intent = intents.includes('top') ? 'top' : 'bottom';
        const sortDir = intents.includes('bottom') ? 1 : -1;
        const limit = limitN || 10;
        pipeline = [
            { $group: { _id: `$${nameField}`, total: amountField ? { $sum: `$${amountField}` } : { $sum: 1 } } },
            { $sort: { total: sortDir } },
            { $limit: limit }
        ];
        description = `${intent === 'top' ? 'Top' : 'Bottom'} ${limit} from ${collection}`;
    } else if (intents.includes('count')) {
        chartType = 'kpi';
        intent = 'count';
        if (nameField) {
            pipeline = [
                { $group: { _id: `$${nameField}`, count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ];
            description = `Count by ${nameField} in ${collection}`;
        } else {
            pipeline = [{ $count: 'total_count' }];
            description = `Total count in ${collection}`;
        }
    } else if ((intents.includes('sum') || intents.includes('percentage')) && amountField) {
        chartType = 'bar';
        intent = 'sum';
        if (nameField) {
            pipeline = [
                { $group: { _id: `$${nameField}`, total: { $sum: `$${amountField}` } } },
                { $sort: { total: -1 } }
            ];
            description = `Total ${amountField} by ${nameField}`;
        } else {
            pipeline = [{ $group: { _id: null, grand_total: { $sum: `$${amountField}` }, average: { $avg: `$${amountField}` }, count: { $sum: 1 } } }];
            description = `Summary of ${amountField} in ${collection}`;
        }
    } else if (intents.includes('average') && amountField) {
        chartType = 'bar';
        intent = 'average';
        if (nameField) {
            pipeline = [
                { $group: { _id: `$${nameField}`, average: { $avg: `$${amountField}` }, count: { $sum: 1 } } },
                { $sort: { average: -1 } }
            ];
            description = `Average ${amountField} by ${nameField}`;
        } else {
            pipeline = [{ $group: { _id: null, average: { $avg: `$${amountField}` } } }];
            description = `Average ${amountField} in ${collection}`;
        }
    } else if (intents.includes('distribution') && nameField) {
        chartType = 'pie';
        intent = 'distribution';
        pipeline = [
            { $group: { _id: `$${nameField}`, count: amountField ? { $sum: `$${amountField}` } : { $sum: 1 } } },
            { $sort: { count: -1 } }
        ];
        description = `Distribution by ${nameField}`;
    } else {
        // Default: list documents
        const limit = limitN || 50;
        pipeline = [{ $limit: limit }];
        description = `Documents from ${collection}`;
    }

    // Serialize as JSON command for executeMongoQuery
    const sql = JSON.stringify({ collection, pipeline });
    return { sql, chartType, description, intent };
}

function detectIntent(input) {
    // Order matters — check specific intents BEFORE generic ones
    const intents = [
        ['trend', /trend|over time|month(ly)?|week(ly)?|year(ly)?|growth|decline|progression|timeline|time.?series/i],
        ['top', /top\s*\d+|best|highest|most|maximum|greatest|leading|largest/i],
        ['bottom', /bottom\s*\d+|worst|lowest|least|minimum|smallest|fewest/i],
        ['count', /how many|count|number of|total\s*number/i],
        ['compare', /compare|versus|vs\.?|difference|between.*and/i],
        ['average', /average|avg|mean|typical/i],
        ['sum', /total|sum|overall|combined|aggregate|revenue|sales|amount/i],
        ['distribution', /distribution|breakdown|by|per|each|split|group/i],
        ['percentage', /percent|%|ratio|proportion|share/i],
        ['visual', /graph|chart|plot|visualize|visualization/i],
        ['list', /show|list|display|all|get|find|retrieve|fetch|details|information|info/i],
    ];

    const detected = [];
    for (const [name, pattern] of intents) {
        if (pattern.test(input)) detected.push(name);
    }

    // If we detected specific intents plus 'list', remove 'list' since it's too generic
    if (detected.length > 1 && detected.includes('list')) {
        return detected.filter(d => d !== 'list');
    }

    return detected.length > 0 ? detected : ['list'];
}

function findRelevantTables(input, schema) {
    const tables = [];
    const inputLower = input.toLowerCase();

    // Direct table name match
    for (const table of schema.tables) {
        const tableLower = table.name.toLowerCase();
        const singular = tableLower.replace(/s$/, '');
        if (inputLower.includes(tableLower) || inputLower.includes(singular)) {
            tables.push(table.name);
        }
    }

    // Keyword-to-table mapping 
    const keywordMap = {
        'revenue': ['orders', 'order_items', 'payments'],
        'sales': ['orders', 'order_items'],
        'income': ['payments'],
        'customer': ['customers'],
        'client': ['customers'],
        'buyer': ['customers'],
        'product': ['products'],
        'item': ['products', 'order_items'],
        'order': ['orders', 'order_items'],
        'purchase': ['orders'],
        'payment': ['payments'],
        'transaction': ['payments'],
        'category': ['categories'],
        'categor': ['categories'],
        'region': ['customers'],
        'city': ['customers'],
        'country': ['customers'],
    };

    for (const [keyword, relatedTables] of Object.entries(keywordMap)) {
        if (inputLower.includes(keyword)) {
            for (const t of relatedTables) {
                const schemaTable = schema.tables.find(st => st.name.toLowerCase() === t);
                if (schemaTable && !tables.includes(schemaTable.name)) {
                    tables.push(schemaTable.name);
                }
            }
        }
    }

    return tables;
}

function generateSQL(input, intents, tables, schema) {
    const primaryTable = tables[0];
    const inputLower = input.toLowerCase();

    // Extract number for TOP N queries
    const topMatch = input.match(/top\s*(\d+)/i);
    const limitN = topMatch ? parseInt(topMatch[1]) : null;

    // Detect time filters
    const timeFilter = detectTimeFilter(input);

    // Detect specific columns mentioned by user
    const requestedColumns = findRequestedColumns(inputLower, tables, schema);

    // Detect chart type
    let chartType = 'table';

    // ── TREND QUERIES ──
    if (intents.includes('trend')) {
        chartType = 'line';
        const { sql, description } = buildTrendQuery(inputLower, tables, schema, timeFilter);
        return { sql, chartType, description, intent: 'trend' };
    }

    // ── TOP/BOTTOM N QUERIES ──
    if (intents.includes('top') || intents.includes('bottom')) {
        chartType = 'bar';
        const direction = intents.includes('bottom') ? 'ASC' : 'DESC';
        const limit = limitN || 10;
        const { sql, description } = buildTopQuery(inputLower, tables, schema, direction, limit, timeFilter);
        return { sql, chartType, description, intent: intents.includes('top') ? 'top' : 'bottom' };
    }

    // ── COUNT QUERIES ──
    if (intents.includes('count')) {
        chartType = 'kpi';
        const { sql, description } = buildCountQuery(inputLower, tables, schema, timeFilter);
        return { sql, chartType, description, intent: 'count' };
    }

    // ── SUM / REVENUE / TOTAL QUERIES ──
    if (intents.includes('sum') || intents.includes('percentage')) {
        chartType = 'bar';
        const { sql, description } = buildSumQuery(inputLower, tables, schema, timeFilter);
        return { sql, chartType, description, intent: 'sum' };
    }

    // ── AVERAGE QUERIES ──
    if (intents.includes('average')) {
        chartType = 'bar';
        const { sql, description } = buildAverageQuery(inputLower, tables, schema, timeFilter);
        return { sql, chartType, description, intent: 'average' };
    }

    // ── DISTRIBUTION / GROUP BY ──
    if (intents.includes('distribution')) {
        chartType = 'pie';
        const { sql, description } = buildDistributionQuery(inputLower, tables, schema, timeFilter);
        return { sql, chartType, description, intent: 'distribution' };
    }

    // ── COMPARE QUERIES ──
    if (intents.includes('compare')) {
        chartType = 'bar';
        const { sql, description } = buildCompareQuery(inputLower, tables, schema, timeFilter);
        return { sql, chartType, description, intent: 'compare' };
    }

    // ── DEFAULT: LIST/SHOW ──
    const limit = limitN || 50;
    const table = schema.tables.find(t => t.name === primaryTable);
    let selectCols = '*';
    let description = `All ${primaryTable} records`;
    
    // If user requested specific columns, use only those
    if (requestedColumns.length > 0) {
        selectCols = requestedColumns.map(c => q(c)).join(', ');
        description = `${requestedColumns.join(', ')} from ${primaryTable}`;
    } else if (table) {
        const textCols = table.columns.filter(c => !c.name.toLowerCase().endsWith('_id') && c.name.toLowerCase() !== 'id');
        if (textCols.length > 0 && textCols.length < table.columns.length) {
            selectCols = table.columns.map(c => q(c.name)).join(', ');
        }
    }
    
    const sql = `SELECT ${selectCols} FROM ${q(primaryTable)} LIMIT ${limit}`;

    // If the user explicitly asked for a graph/chart, provide visualization
    if (intents.includes('visual')) {
        return { sql, chartType: 'bar', description, intent: 'visual' };
    }

    return { sql, chartType: 'table', description, intent: 'list' };
}

// ═══════════════════════════════════════════════
//  QUERY BUILDERS
// ═══════════════════════════════════════════════

function buildTrendQuery(input, tables, schema, timeFilter) {
    // Find a date column
    const dateInfo = findDateColumn(tables, schema);
    const amountInfo = findAmountColumn(tables, schema);

    if (dateInfo && amountInfo) {
        const joinClause = buildJoinClause(tables, schema);
        const whereClause = timeFilter ? `WHERE ${dateInfo.fullName} ${timeFilter}` : '';

        const sql = `SELECT ${dateFormat(dateInfo.fullName)} as month, 
  SUM(${amountInfo.fullName}) as total, 
  COUNT(*) as count 
FROM ${joinClause} 
${whereClause}
GROUP BY month 
ORDER BY month`;

        return { sql, description: `Monthly trend of ${amountInfo.column} from ${amountInfo.table}` };
    }

    if (dateInfo) {
        const sql = `SELECT ${dateFormat(dateInfo.fullName)} as month, COUNT(*) as count 
FROM ${q(dateInfo.table)} 
${timeFilter ? `WHERE ${dateInfo.fullName} ${timeFilter}` : ''}
GROUP BY month ORDER BY month`;
        return { sql, description: `Monthly count trend from ${dateInfo.table}` };
    }

    return { sql: `SELECT * FROM ${q(tables[0])} LIMIT 20`, description: 'No date column found for trend analysis' };
}

function buildTopQuery(input, tables, schema, direction, limit, timeFilter) {
    const amountInfo = findAmountColumn(tables, schema);
    const nameInfo = findNameColumn(tables, schema);
    const joinClause = buildJoinClause(tables, schema);
    const dateInfo = findDateColumn(tables, schema);
    const whereClause = timeFilter && dateInfo ? `WHERE ${dateInfo.fullName} ${timeFilter}` : '';

    if (amountInfo && nameInfo) {
        const sql = `SELECT ${nameInfo.fullName} as name, SUM(${amountInfo.fullName}) as total 
FROM ${joinClause} 
${whereClause}
GROUP BY ${nameInfo.fullName} 
ORDER BY total ${direction} 
LIMIT ${limit}`;
        return { sql, description: `${direction === 'DESC' ? 'Top' : 'Bottom'} ${limit} by ${amountInfo.column}` };
    }

    if (amountInfo) {
        const sql = `SELECT *, ${amountInfo.fullName} as sort_val FROM ${q(tables[0])} ${whereClause} ORDER BY sort_val ${direction} LIMIT ${limit}`;
        return { sql, description: `${direction === 'DESC' ? 'Top' : 'Bottom'} ${limit} from ${tables[0]}` };
    }

    const sql = `SELECT * FROM ${q(tables[0])} LIMIT ${limit}`;
    return { sql, description: `Showing ${limit} rows from ${tables[0]}` };
}

function buildCountQuery(input, tables, schema, timeFilter) {
    const dateInfo = findDateColumn(tables, schema);
    const whereClause = timeFilter && dateInfo ? `WHERE ${dateInfo.fullName} ${timeFilter}` : '';
    const groupBy = findGroupByColumn(input, tables, schema);

    if (groupBy) {
        const sql = `SELECT ${groupBy.fullName} as category, COUNT(*) as count 
FROM ${q(groupBy.table)} 
${whereClause}
GROUP BY ${groupBy.fullName} 
ORDER BY count DESC`;
        return { sql, description: `Count by ${groupBy.column}` };
    }

    const sql = `SELECT COUNT(*) as total_count FROM ${q(tables[0])} ${whereClause}`;
    return { sql, description: `Total count of records in ${tables[0]}` };
}

function buildSumQuery(input, tables, schema, timeFilter) {
    const amountInfo = findAmountColumn(tables, schema);
    const groupBy = findGroupByColumn(input, tables, schema);
    const dateInfo = findDateColumn(tables, schema);
    const joinClause = buildJoinClause(tables, schema);
    const whereClause = timeFilter && dateInfo ? `WHERE ${dateInfo.fullName} ${timeFilter}` : '';

    if (amountInfo && groupBy) {
        const sql = `SELECT ${groupBy.fullName} as category, SUM(${amountInfo.fullName}) as total 
FROM ${joinClause} 
${whereClause}
GROUP BY ${groupBy.fullName} 
ORDER BY total DESC`;
        return { sql, description: `Total ${amountInfo.column} by ${groupBy.column}` };
    }

    if (amountInfo) {
        const sql = `SELECT SUM(${amountInfo.fullName}) as grand_total, 
  AVG(${amountInfo.fullName}) as average, 
  MIN(${amountInfo.fullName}) as minimum, 
  MAX(${amountInfo.fullName}) as maximum, 
  COUNT(*) as count 
FROM ${joinClause} ${whereClause}`;
        return { sql, description: `Summary statistics for ${amountInfo.column}` };
    }

    return { sql: `SELECT * FROM "${tables[0]}" LIMIT 20`, description: `Showing data from ${tables[0]}` };
}

function buildAverageQuery(input, tables, schema, timeFilter) {
    const amountInfo = findAmountColumn(tables, schema);
    const groupBy = findGroupByColumn(input, tables, schema);
    const dateInfo = findDateColumn(tables, schema);
    const joinClause = buildJoinClause(tables, schema);
    const whereClause = timeFilter && dateInfo ? `WHERE ${dateInfo.fullName} ${timeFilter}` : '';

    if (amountInfo && groupBy) {
        const sql = `SELECT ${groupBy.fullName} as category, 
  ROUND(AVG(${amountInfo.fullName}), 2) as average,
  COUNT(*) as count 
FROM ${joinClause} ${whereClause}
GROUP BY ${groupBy.fullName} 
ORDER BY average DESC`;
        return { sql, description: `Average ${amountInfo.column} by ${groupBy.column}` };
    }

    if (amountInfo) {
        const sql = `SELECT ROUND(AVG(${amountInfo.fullName}), 2) as average FROM ${joinClause} ${whereClause}`;
        return { sql, description: `Average ${amountInfo.column}` };
    }

    return { sql: `SELECT * FROM "${tables[0]}" LIMIT 20`, description: `Showing data from ${tables[0]}` };
}

function buildDistributionQuery(input, tables, schema, timeFilter) {
    const groupBy = findGroupByColumn(input, tables, schema);
    const amountInfo = findAmountColumn(tables, schema);
    const dateInfo = findDateColumn(tables, schema);
    const joinClause = buildJoinClause(tables, schema);
    const whereClause = timeFilter && dateInfo ? `WHERE ${dateInfo.fullName} ${timeFilter}` : '';

    if (groupBy && amountInfo) {
        const sql = `SELECT ${groupBy.fullName} as category, SUM(${amountInfo.fullName}) as total 
FROM ${joinClause} ${whereClause}
GROUP BY ${groupBy.fullName} 
ORDER BY total DESC`;
        return { sql, description: `Distribution of ${amountInfo.column} by ${groupBy.column}` };
    }

    if (groupBy) {
        const sql = `SELECT ${groupBy.fullName} as category, COUNT(*) as count 
FROM ${q(groupBy.table)} ${whereClause}
GROUP BY ${groupBy.fullName} 
ORDER BY count DESC`;
        return { sql, description: `Distribution by ${groupBy.column}` };
    }

    return { sql: `SELECT * FROM ${q(tables[0])} LIMIT 20`, description: `Showing data from ${tables[0]}` };
}

function buildCompareQuery(input, tables, schema, timeFilter) {
    const amountInfo = findAmountColumn(tables, schema);
    const groupBy = findGroupByColumn(input, tables, schema);
    const joinClause = buildJoinClause(tables, schema);
    const dateInfo = findDateColumn(tables, schema);
    const whereClause = timeFilter && dateInfo ? `WHERE ${dateInfo.fullName} ${timeFilter}` : '';

    if (amountInfo && groupBy) {
        const sql = `SELECT ${groupBy.fullName} as category,
  SUM(${amountInfo.fullName}) as total,
  ROUND(AVG(${amountInfo.fullName}), 2) as average,
  COUNT(*) as count,
  MIN(${amountInfo.fullName}) as min_value,
  MAX(${amountInfo.fullName}) as max_value
FROM ${joinClause} ${whereClause}
GROUP BY ${groupBy.fullName}
ORDER BY total DESC`;
        return { sql, description: `Comparison of ${amountInfo.column} by ${groupBy.column}` };
    }

    return buildSumQuery(input, tables, schema, timeFilter);
}

// ═══════════════════════════════════════════════
//  HELPER FUNCTIONS
// ═══════════════════════════════════════════════

function findDateColumn(tables, schema) {
    const datePatterns = ['date', 'created', 'timestamp', 'time', 'ordered', 'purchased', 'paid'];
    for (const tableName of tables) {
        const table = schema.tables.find(t => t.name === tableName);
        if (!table) continue;
        for (const col of table.columns) {
            const colLower = col.name.toLowerCase();
            if (datePatterns.some(p => colLower.includes(p)) ||
                col.type.toLowerCase().includes('date') ||
                col.type.toLowerCase().includes('time')) {
                return { table: tableName, column: col.name, fullName: `"${tableName}"."${col.name}"` };
            }
        }
    }
    // Search all tables
    for (const table of schema.tables) {
        for (const col of table.columns) {
            const colLower = col.name.toLowerCase();
            if (datePatterns.some(p => colLower.includes(p))) {
                return { table: table.name, column: col.name, fullName: `${q(table.name)}.${q(col.name)}` };
            }
        }
    }
    return null;
}

function findAmountColumn(tables, schema) {
    const amountPatterns = ['amount', 'total', 'price', 'revenue', 'cost', 'value', 'quantity', 'qty', 'sum', 'subtotal', 'sales'];
    for (const tableName of tables) {
        const table = schema.tables.find(t => t.name === tableName);
        if (!table) continue;
        for (const col of table.columns) {
            const colLower = col.name.toLowerCase();
            if (amountPatterns.some(p => colLower.includes(p)) &&
                (col.type.toLowerCase().includes('real') || col.type.toLowerCase().includes('int') ||
                    col.type.toLowerCase().includes('num') || col.type.toLowerCase().includes('decimal') ||
                    col.type.toLowerCase().includes('float') || col.type === '')) {
                return { table: tableName, column: col.name, fullName: `${q(tableName)}.${q(col.name)}` };
            }
        }
    }
    return null;
}

function findNameColumn(tables, schema) {
    const namePatterns = ['name', 'title', 'label', 'description'];
    for (const tableName of tables) {
        const table = schema.tables.find(t => t.name === tableName);
        if (!table) continue;
        for (const col of table.columns) {
            const colLower = col.name.toLowerCase();
            if (namePatterns.some(p => colLower.includes(p))) {
                return { table: tableName, column: col.name, fullName: `${q(tableName)}.${q(col.name)}` };
            }
        }
    }
    return null;
}

function findGroupByColumn(input, tables, schema) {
    // Check if the user mentioned a specific column
    for (const tableName of tables) {
        const table = schema.tables.find(t => t.name === tableName);
        if (!table) continue;
        for (const col of table.columns) {
            const colLower = col.name.toLowerCase().replace(/_/g, ' ');
            if (input.includes(colLower) || input.includes(col.name.toLowerCase())) {
                return { table: tableName, column: col.name, fullName: `"${tableName}"."${col.name}"` };
            }
        }
    }

    // Smart mapping from keywords to categories
    const groupKeywords = {
        'category': ['category_name', 'category', 'type'],
        'region': ['region', 'state', 'country', 'city'],
        'status': ['status', 'state'],
        'customer': ['customer_name', 'name'],
        'product': ['product_name', 'name'],
        'month': null, // handled by trend
        'year': null,
    };

    for (const [keyword, colCandidates] of Object.entries(groupKeywords)) {
        if (input.includes(keyword) && colCandidates) {
            for (const tableName of tables) {
                const table = schema.tables.find(t => t.name === tableName);
                if (!table) continue;
                for (const candidate of colCandidates) {
                    const col = table.columns.find(c => c.name.toLowerCase().includes(candidate));
                    if (col) {
                        return { table: tableName, column: col.name, fullName: `${q(tableName)}.${q(col.name)}` };
                    }
                }
            }
            // Search all tables for the column
            for (const table of schema.tables) {
                for (const candidate of colCandidates) {
                    const col = table.columns.find(c => c.name.toLowerCase().includes(candidate));
                    if (col) {
                        return { table: table.name, column: col.name, fullName: `${q(table.name)}.${q(col.name)}` };
                    }
                }
            }
        }
    }

    // Default: find first text/categorical column that's not a PK or FK
    for (const tableName of tables) {
        const table = schema.tables.find(t => t.name === tableName);
        if (!table) continue;
        const fkCols = table.foreignKeys.map(fk => fk.column);
        for (const col of table.columns) {
            if (!col.isPrimaryKey && !fkCols.includes(col.name) &&
                (col.type.toLowerCase().includes('text') || col.type.toLowerCase().includes('varchar') || col.type === '')) {
                return { table: tableName, column: col.name, fullName: `"${tableName}"."${col.name}"` };
            }
        }
    }

    return null;
}

function buildJoinClause(tables, schema) {
    if (tables.length <= 1) return `${q(tables[0])}`;

    // Build join based on foreign key relationships
    let joinSQL = `${q(tables[0])}`;
    const joined = new Set([tables[0]]);

    for (let i = 1; i < tables.length; i++) {
        const tableName = tables[i];
        if (joined.has(tableName)) continue;

        // Find FK relationship
        let foundJoin = false;
        for (const rel of schema.relationships) {
            if (rel.from.table === tableName && joined.has(rel.to.table)) {
                joinSQL += ` JOIN ${q(tableName)} ON ${q(tableName)}.${q(rel.from.column)} = ${q(rel.to.table)}.${q(rel.to.column)}`;
                joined.add(tableName);
                foundJoin = true;
                break;
            }
            if (rel.to.table === tableName && joined.has(rel.from.table)) {
                joinSQL += ` JOIN ${q(tableName)} ON ${q(rel.from.table)}.${q(rel.from.column)} = ${q(tableName)}.${q(rel.to.column)}`;
                joined.add(tableName);
                foundJoin = true;
                break;
            }
        }

        if (!foundJoin) {
            // Try cross-table FK search
            for (const table of schema.tables) {
                for (const fk of table.foreignKeys) {
                    if ((fk.referencedTable === tableName && joined.has(table.name)) ||
                        (table.name === tableName && joined.has(fk.referencedTable))) {
                        joinSQL += ` JOIN ${q(tableName)} ON ${q(table.name)}.${q(fk.column)} = ${q(fk.referencedTable)}.${q(fk.referencedColumn)}`;
                        joined.add(tableName);
                        foundJoin = true;
                        break;
                    }
                }
                if (foundJoin) break;
            }
        }

        if (!foundJoin) {
            joinSQL += `, ${q(tableName)}`;
            joined.add(tableName);
        }
    }

    return joinSQL;
}

function findRequestedColumns(input, tables, schema) {
    const columns = [];
    const table = schema.tables.find(t => t.name === tables[0]);
    if (!table) return columns;

    // Check each column in the table
    for (const col of table.columns) {
        const colLower = col.name.toLowerCase();
        const colWithoutUnderscore = colLower.replace(/_/g, ' ');
        
        // Match exact column name or column name with spaces instead of underscores
        if (input.includes(colLower) || input.includes(colWithoutUnderscore)) {
            columns.push(col.name);
        }
    }

    return columns;
}

function detectTimeFilter(input) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    if (/last\s*(6|six)\s*months/i.test(input)) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 6);
        return `>= '${d.toISOString().split('T')[0]}'`;
    }
    if (/last\s*(3|three)\s*months/i.test(input)) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 3);
        return `>= '${d.toISOString().split('T')[0]}'`;
    }
    if (/last\s*month/i.test(input)) {
        const d = new Date(year, month - 2, 1);
        const e = new Date(year, month - 1, 0);
        return `BETWEEN '${d.toISOString().split('T')[0]}' AND '${e.toISOString().split('T')[0]}'`;
    }
    if (/this\s*month/i.test(input)) {
        const d = new Date(year, month - 1, 1);
        return `>= '${d.toISOString().split('T')[0]}'`;
    }
    if (/this\s*year|current\s*year/i.test(input)) {
        return `>= '${year}-01-01'`;
    }
    if (/last\s*year/i.test(input)) {
        return `BETWEEN '${year - 1}-01-01' AND '${year - 1}-12-31'`;
    }
    if (/last\s*quarter/i.test(input)) {
        const qStart = new Date(now);
        qStart.setMonth(qStart.getMonth() - 3);
        return `>= '${qStart.toISOString().split('T')[0]}'`;
    }
    if (/today/i.test(input)) {
        return `= '${now.toISOString().split('T')[0]}'`;
    }

    return null;
}

export function resetContext() {
    conversationContext = {
        lastTable: null,
        lastColumns: [],
        lastQuery: null,
        lastFilters: {},
        history: []
    };
}
