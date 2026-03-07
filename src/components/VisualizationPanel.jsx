import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const COLORS = [
    'rgba(99,102,241,0.85)', 'rgba(34,211,238,0.85)', 'rgba(168,85,247,0.85)',
    'rgba(16,185,129,0.85)', 'rgba(245,158,11,0.85)', 'rgba(239,68,68,0.85)',
    'rgba(236,72,153,0.85)', 'rgba(59,130,246,0.85)', 'rgba(132,204,22,0.85)', 'rgba(251,146,60,0.85)',
];
const BORDERS = COLORS.map(c => c.replace('0.85', '1'));

const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, padding: 16, usePointStyle: true } },
        tooltip: { backgroundColor: 'rgba(10,14,35,0.95)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 10, padding: 14 }
    },
    scales: {
        x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
        y: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } }
    }
};
const pieOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
        legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, padding: 14, usePointStyle: true } },
        tooltip: { backgroundColor: 'rgba(10,14,35,0.95)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 10, padding: 14 }
    }
};

export default function VisualizationPanel({ queryResult }) {
    const [activeChart, setActiveChart] = useState(null);
    useEffect(() => { if (queryResult) setActiveChart(queryResult.chartType); }, [queryResult]);

    // ── Welcome State ──
    if (!queryResult) {
        return (
            <div className="viz-area">
                <div className="welcome-state">
                    <div className="welcome-icon">🧠</div>
                    <h2>Welcome to INTELLEXA-AI</h2>
                    <p>Ask questions about your database in plain English. I'll analyze the data and show results with charts, tables & AI insights.</p>
                    <div className="welcome-features">
                        <div className="welcome-feat"><div className="wf-icon">💬</div><div className="wf-text">Ask in English</div></div>
                        <div className="welcome-feat"><div className="wf-icon">📊</div><div className="wf-text">Auto Charts</div></div>
                        <div className="welcome-feat"><div className="wf-icon">💡</div><div className="wf-text">AI Insights</div></div>
                        <div className="welcome-feat"><div className="wf-icon">🎤</div><div className="wf-text">Voice Input</div></div>
                        <div className="welcome-feat"><div className="wf-icon">🔗</div><div className="wf-text">Smart JOINs</div></div>
                        <div className="welcome-feat"><div className="wf-icon">⚡</div><div className="wf-text">Instant</div></div>
                    </div>
                </div>
            </div>
        );
    }

    const { rows, chartType, description, insights, rowCount, intent } = queryResult;

    if (!rows || rows.length === 0) {
        return (
            <div className="viz-area">
                <div className="empty-state"><div className="empty-icon">📭</div><p>No data found. Try a different question.</p></div>
            </div>
        );
    }

    const columns = Object.keys(rows[0]);
    const textCols = columns.filter(c => typeof rows[0][c] === 'string');
    const numCols = columns.filter(c => typeof rows[0][c] === 'number');
    const labelCol = textCols[0] || columns[0];
    const primaryNumCol = numCols.find(c => !c.toLowerCase().includes('id')) || numCols[0];

    const ct = activeChart || chartType || 'table';
    const isListQuery = intent === 'list' && ct === 'table';
    const isKpiQuery = chartType === 'kpi' || (rows.length === 1 && numCols.length >= 1 && textCols.length === 0);

    // Filter out ID-only insights that aren't meaningful
    const meaningfulInsights = (insights || []).filter(ins => {
        const text = ins.text.toLowerCase();
        // Skip insights that are just about IDs
        if (text.includes(' id ') && numCols.length <= 1 && textCols.length > 1) return false;
        if (text.includes('_id') && numCols.length <= 1) return false;
        return true;
    });

    const showInsights = !isListQuery && meaningfulInsights.length > 0;

    // ── Chart Data ──
    const chartLimit = 50;
    const labels = rows.map(r => String(r[labelCol])).slice(0, chartLimit);
    const chartNumCols = numCols.filter(c => !c.toLowerCase().endsWith('_id') && c.toLowerCase() !== 'id');
    const displayNumCols = (chartNumCols.length > 0 || intent === 'visual') ? (chartNumCols.length > 0 ? chartNumCols : numCols) : [];
    const isPie = ct === 'pie' || ct === 'doughnut';

    const chartData = {
        labels,
        datasets: displayNumCols.slice(0, 3).map((col, i) => ({
            label: prettify(col),
            data: rows.map(r => r[col]).slice(0, chartLimit),
            backgroundColor: isPie ? rows.map((_, j) => COLORS[j % COLORS.length]) : COLORS[i],
            borderColor: isPie ? rows.map((_, j) => BORDERS[j % BORDERS.length]) : BORDERS[i],
            borderWidth: ct === 'line' ? 3 : 1,
            borderRadius: ct === 'bar' ? 8 : 0,
            tension: 0.4,
            fill: ct === 'line' ? { target: 'origin', above: 'rgba(99,102,241,0.08)' } : false,
            pointRadius: ct === 'line' ? 5 : 0,
            pointHoverRadius: 7,
            pointBackgroundColor: BORDERS[i],
        }))
    };

    const renderChart = () => {
        if (displayNumCols.length === 0) return null;
        const h = { height: '360px' };
        if (ct === 'bar') return <div style={h}><Bar data={chartData} options={chartOpts} /></div>;
        if (ct === 'line') return <div style={h}><Line data={chartData} options={chartOpts} /></div>;
        if (ct === 'pie') return <div style={h}><Pie data={chartData} options={pieOpts} /></div>;
        if (ct === 'doughnut') return <div style={h}><Doughnut data={chartData} options={pieOpts} /></div>;
        return null;
    };

    const types = ['bar', 'line', 'pie', 'doughnut', 'table'];
    const icons = { bar: '📊', line: '📈', pie: '🥧', doughnut: '🍩', table: '📋' };

    return (
        <div className="viz-area">
            {/* Header */}
            <div className="viz-header">
                <h2>📊 {description}</h2>
                <span className="badge">{rowCount} result{rowCount !== 1 ? 's' : ''}</span>
            </div>

            {/* KPI Cards for single-value results */}
            {isKpiQuery && (
                <div className="kpi-grid">
                    {rows.length === 1 ? numCols.map((col, i) => (
                        <div key={i} className="kpi-card" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="kpi-label">{prettify(col)}</div>
                            <div className="kpi-value">{fmt(rows[0][col])}</div>
                        </div>
                    )) : rows.slice(0, 8).map((row, i) => (
                        <div key={i} className="kpi-card" style={{ animationDelay: `${i * 0.08}s` }}>
                            <div className="kpi-label">{row[labelCol]}</div>
                            <div className="kpi-value">{primaryNumCol ? fmt(row[primaryNumCol]) : '—'}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* AI Insights — only for aggregation queries, not plain lists */}
            {showInsights && (
                <div className="insight-cards">
                    {meaningfulInsights.slice(0, 4).map((ins, i) => (
                        <div key={i} className="insight-card" style={{ animationDelay: `${i * 0.08}s` }}>
                            <span className="insight-icon">{ins.icon}</span>
                            <span className="insight-text">{ins.text}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Chart — only for aggregation queries with numeric data */}
            {!isListQuery && !isKpiQuery && displayNumCols.length > 0 && (
                <div className="chart-container">
                    <div className="chart-title">
                        <span>📈 Visualization</span>
                        <div className="chart-type-selector">
                            {types.map(t => (
                                <button key={t} className={`chart-type-btn ${ct === t ? 'active' : ''}`} onClick={() => setActiveChart(t)} title={t}>
                                    {icons[t]}
                                </button>
                            ))}
                        </div>
                    </div>
                    {ct !== 'table' && renderChart()}
                </div>
            )}

            {/* Data Table — ALWAYS shown, and shown FIRST for list queries */}
            <div className="data-table-container">
                <div className="data-table-header">
                    <h4>📋 {isListQuery ? 'Results' : 'Data Table'}</h4>
                    <span className="row-count">{rows.length} rows × {columns.length} columns</span>
                </div>
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                {columns.map((col, i) => <th key={i}>{prettify(col)}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.slice(0, 100).map((row, i) => (
                                <tr key={i}>
                                    <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{i + 1}</td>
                                    {columns.map((col, j) => (
                                        <td key={j} style={typeof row[col] === 'number' ? { fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent-secondary)' } : {}}>
                                            {typeof row[col] === 'number' ? fmt(row[col]) : String(row[col] ?? '—')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Format column name: "first_name" → "First Name"
function prettify(col) {
    return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Format number
function fmt(n) {
    if (typeof n !== 'number') return n;
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
