import { useState } from 'react';

export default function SchemaExplorer({ schema }) {
    const [expanded, setExpanded] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    if (!schema || !schema.tables) {
        return <div className="schema-explorer"><div className="empty-state"><div className="empty-icon">🗂️</div><p>No schema loaded</p></div></div>;
    }

    const toggle = (name) => setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

    const totalCols = schema.tables.reduce((sum, t) => sum + t.columns.length, 0);
    const totalRows = schema.tables.reduce((sum, t) => sum + (t.rowCount || 0), 0);

    const filtered = schema.tables.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.columns.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="schema-explorer">
            <div className="schema-explorer-title">🗂️ Schema Explorer</div>

            {/* Summary KPIs */}
            <div className="kpi-grid" style={{ marginBottom: '1.2rem' }}>
                <div className="kpi-card"><div className="kpi-label">Tables</div><div className="kpi-value">{schema.tables.length}</div></div>
                <div className="kpi-card"><div className="kpi-label">Columns</div><div className="kpi-value">{totalCols}</div></div>
                <div className="kpi-card"><div className="kpi-label">Total Rows</div><div className="kpi-value">{totalRows.toLocaleString()}</div></div>
                <div className="kpi-card"><div className="kpi-label">Relations</div><div className="kpi-value">{schema.relationships?.length || 0}</div></div>
            </div>

            {/* Search */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
                <input
                    type="text" placeholder="🔍 Search tables & columns..."
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 1rem', background: 'var(--bg-input)', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' }}
                />
            </div>

            {/* Tables */}
            {filtered.map((table, idx) => (
                <div key={table.name} className="schema-table-card" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <div className="schema-table-header" onClick={() => toggle(table.name)}>
                        <div className="schema-table-name">
                            <span className="table-icon">📋</span>
                            <span>{table.name}</span>
                        </div>
                        <div className="schema-table-meta">
                            <span>{table.rowCount?.toLocaleString()} rows</span>
                            <span>•</span>
                            <span>{table.columns.length} cols</span>
                            <span style={{ fontSize: '0.8rem', transition: 'transform 0.3s', transform: expanded[table.name] ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                        </div>
                    </div>
                    {expanded[table.name] && (
                        <div className="schema-columns" style={{ animation: 'fadeIn 0.2s ease' }}>
                            {table.columns.map((col, ci) => (
                                <div key={ci} className="schema-column">
                                    <span style={{ color: col.isPrimaryKey ? 'var(--warning)' : 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                                        {col.isPrimaryKey ? '🔑' : table.foreignKeys?.some(fk => fk.column === col.name) ? '🔗' : '◦'}
                                    </span>
                                    <span className="col-name">{col.name}</span>
                                    <span className="col-type">{col.type}</span>
                                    {col.isPrimaryKey && <span className="col-badge pk">PK</span>}
                                    {table.foreignKeys?.some(fk => fk.column === col.name) && <span className="col-badge fk">FK</span>}
                                </div>
                            ))}
                            {table.foreignKeys?.length > 0 && (
                                <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.5rem', background: 'rgba(99,102,241,0.05)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem' }}>
                                    <div style={{ color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: '0.25rem' }}>Relationships:</div>
                                    {table.foreignKeys.map((fk, fi) => (
                                        <div key={fi} style={{ color: 'var(--text-accent)', fontSize: '0.7rem' }}>
                                            {fk.column} → {fk.referencedTable}.{fk.referencedColumn}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
