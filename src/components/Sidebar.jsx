import { useState } from 'react';

const NAV_ITEMS = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', desc: 'Charts & insights' },
    { id: 'schema', icon: '🗂️', label: 'Schema Explorer', desc: 'Tables & columns' },
    { id: 'history', icon: '📜', label: 'Query History', desc: 'Past queries' },
];

export default function Sidebar({ activeView, onViewChange, collapsed, onToggle, schema, onDisconnect }) {
    const tableCount = schema?.tables?.length || 0;
    const totalRows = schema?.tables?.reduce((sum, t) => sum + (t.rowCount || 0), 0) || 0;

    return (
        <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <div className="logo-mini">🧠</div>
                <div className="brand">
                    <h2>INTELLEXA</h2>
                    <span>AI Database Intelligence</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {NAV_ITEMS.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                        onClick={() => onViewChange(item.id)}
                        title={collapsed ? item.label : ''}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Schema Stats */}
            {!collapsed && schema && (
                <div style={{ padding: '0.5rem 0.65rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-tertiary)', marginBottom: '0.4rem', fontWeight: 700 }}>Database</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 1, background: 'var(--accent-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-hover)' }}>{tableCount}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>Tables</div>
                        </div>
                        <div style={{ flex: 1, background: 'var(--accent-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-hover)' }}>{totalRows > 999 ? (totalRows / 1000).toFixed(1) + 'K' : totalRows}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>Rows</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="sidebar-footer">
                <div className="connection-badge">
                    <span className="dot"></span>
                    <span className="connection-text">Connected</span>
                </div>
                <button className="nav-item" onClick={onDisconnect} title="Go back to connect screen" style={{ color: 'var(--error)', marginTop: '0.3rem' }}>
                    <span className="nav-icon">🔙</span>
                    <span className="nav-label">Go Back</span>
                </button>
                <button className="sidebar-toggle" onClick={onToggle}>
                    {collapsed ? '▶' : '◀'}
                </button>
            </div>
        </div>
    );
}
