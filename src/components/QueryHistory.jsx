import { useState, useEffect } from 'react';

export default function QueryHistory({ onReRun }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            if (data.success) setHistory(data.history);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchHistory(); }, []);

    const clearHistory = async () => {
        await fetch('/api/history', { method: 'DELETE' });
        setHistory([]);
    };

    const reRun = async (question) => {
        if (!onReRun) return;
        try {
            const res = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });
            const data = await res.json();
            if (data.success) onReRun(data.data);
            fetchHistory();
        } catch { /* ignore */ }
    };

    const timeAgo = (ts) => {
        const diff = Date.now() - new Date(ts).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div className="query-history">
            <div className="query-history-title">
                <span>📜 Query History</span>
                {history.length > 0 && <button onClick={clearHistory}>🗑️ Clear All</button>}
            </div>

            {loading ? (
                <div className="empty-state"><span className="spinner"></span></div>
            ) : history.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <p>No queries yet. Start asking questions in the chat!</p>
                </div>
            ) : (
                history.map((item, idx) => (
                    <div key={item.id || idx} className="history-item" onClick={() => reRun(item.question)} style={{ animationDelay: `${idx * 0.05}s` }}>
                        <div className="history-question">
                            {item.isVoice ? '🎤' : '💬'} {item.question}
                        </div>
                        <div className="history-sql">{item.sql}</div>
                        <div className="history-meta">
                            <span>📊 {item.chartType}</span>
                            <span>•</span>
                            <span>📄 {item.rowCount} rows</span>
                            <span>•</span>
                            <span>🕐 {timeAgo(item.timestamp)}</span>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
