// ═══════════════════════════════════════════════
//  INTELLEXA-AI Insight Generator
//  Automatically generates human-readable insights
//  from query results
// ═══════════════════════════════════════════════

export function generateInsights(rows, intent, description) {
    const insights = [];

    if (!rows || rows.length === 0) {
        return [{ type: 'info', text: 'No data found for this query.', icon: '📭' }];
    }

    const columns = Object.keys(rows[0]);

    // Find numeric columns — EXCLUDE id columns
    const allNumericCols = columns.filter(col => typeof rows[0][col] === 'number');
    const numericCols = allNumericCols.filter(col => {
        const lower = col.toLowerCase();
        return lower !== 'id' && !lower.endsWith('_id') && !lower.startsWith('id_');
    });

    // Find label/category column
    const labelCol = columns.find(col =>
        ['name', 'category', 'month', 'product_name', 'customer_name', 'city', 'region', 'status', 'payment_method', 'first_name', 'last_name', 'title'].includes(col)
    ) || columns.find(col => typeof rows[0][col] === 'string');

    // ── For LIST queries (showing rows), only show record count ──
    if (intent === 'list' || (numericCols.length === 0 && rows.length > 1)) {
        insights.push({
            type: 'info',
            text: `📄 Showing ${rows.length} record${rows.length !== 1 ? 's' : ''} from the database`,
            icon: '📄'
        });
        return insights;
    }

    // ── KPI Insights ──
    if (rows.length === 1 && numericCols.length > 0) {
        for (const col of numericCols) {
            const val = rows[0][col];
            insights.push({
                type: 'kpi',
                text: `${formatColumnName(col)}: ${formatNumber(val)}`,
                value: val,
                icon: '📊'
            });
        }
        return insights;
    }

    // ── Top Performer ──
    if (numericCols.length > 0 && labelCol && rows.length > 1) {
        const mainNumCol = numericCols.find(c => c !== 'count') || numericCols[0];
        const sorted = [...rows].sort((a, b) => b[mainNumCol] - a[mainNumCol]);
        const top = sorted[0];
        const second = sorted.length > 1 ? sorted[1] : null;

        insights.push({
            type: 'highlight',
            text: `🏆 "${top[labelCol]}" leads with ${formatNumber(top[mainNumCol])} in ${formatColumnName(mainNumCol)}`,
            icon: '🏆'
        });

        if (second && top[mainNumCol] > 0 && second[mainNumCol] > 0) {
            const pctDiff = (((top[mainNumCol] - second[mainNumCol]) / second[mainNumCol]) * 100).toFixed(1);
            insights.push({
                type: 'comparison',
                text: `📈 "${top[labelCol]}" is ${pctDiff}% ahead of "${second[labelCol]}"`,
                icon: '📈'
            });
        }

        // Bottom performer
        const bottom = sorted[sorted.length - 1];
        if (bottom[labelCol] !== top[labelCol]) {
            insights.push({
                type: 'warning',
                text: `⚠️ "${bottom[labelCol]}" has the lowest ${formatColumnName(mainNumCol)} at ${formatNumber(bottom[mainNumCol])}`,
                icon: '⚠️'
            });
        }
    }

    // ── Trend Detection ──
    if (intent === 'trend' && numericCols.length > 0 && rows.length > 2) {
        const mainNumCol = numericCols.find(c => c !== 'count') || numericCols[0];
        const values = rows.map(r => r[mainNumCol]);
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        if (secondAvg > firstAvg) {
            const growth = (((secondAvg - firstAvg) / firstAvg) * 100).toFixed(1);
            insights.push({ type: 'trend-up', text: `📈 Upward trend — ${formatColumnName(mainNumCol)} grew by ${growth}%`, icon: '📈' });
        } else if (secondAvg < firstAvg) {
            const decline = (((firstAvg - secondAvg) / firstAvg) * 100).toFixed(1);
            insights.push({ type: 'trend-down', text: `📉 Downward trend — ${formatColumnName(mainNumCol)} declined by ${decline}%`, icon: '📉' });
        } else {
            insights.push({ type: 'trend-stable', text: `➡️ ${formatColumnName(mainNumCol)} has remained stable`, icon: '➡️' });
        }
    }

    // ── Total & Average Summary ──
    if (numericCols.length > 0 && rows.length > 1) {
        const mainNumCol = numericCols.find(c => c !== 'count') || numericCols[0];
        const total = rows.reduce((sum, r) => sum + (r[mainNumCol] || 0), 0);
        const avg = total / rows.length;

        insights.push({
            type: 'summary',
            text: `📋 Total ${formatColumnName(mainNumCol)}: ${formatNumber(total)} | Average: ${formatNumber(avg)} across ${rows.length} entries`,
            icon: '📋'
        });
    }

    // ── Record Count ──
    insights.push({
        type: 'info',
        text: `📄 Query returned ${rows.length} record${rows.length !== 1 ? 's' : ''}`,
        icon: '📄'
    });

    return insights;
}

function formatNumber(num) {
    if (typeof num !== 'number') return num;
    if (Number.isInteger(num)) {
        return num.toLocaleString();
    }
    if (Math.abs(num) >= 1000) {
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return num.toFixed(2);
}

function formatColumnName(col) {
    return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
