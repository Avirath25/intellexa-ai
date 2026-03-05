import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
    "Show total revenue by category",
    "Top 10 products by sales",
    "Monthly revenue trend",
    "How many customers?",
    "Average order value",
    "Revenue by region",
    "Top 5 customers by purchase value",
    "Payment methods distribution",
];

export default function ChatPanel({ onQueryResult }) {
    const [messages, setMessages] = useState([
        {
            type: 'ai',
            content: '👋 Hello! I\'m **INTELLEXA-AI**\n\nI can help you explore your database using natural language. Just type a question and I\'ll:\n\n🔍 Analyze your question\n⚡ Generate optimized SQL\n📊 Visualize the results\n💡 Provide AI insights\n\nTry a suggestion below, or ask anything!',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [listening, setListening] = useState(false);
    const [showSql, setShowSql] = useState({});
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const handleSend = async (text) => {
        const question = text || input.trim();
        if (!question || loading) return;

        setMessages(prev => [...prev, { type: 'user', content: question, timestamp: new Date() }]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, isVoice: false })
            });
            const data = await res.json();

            if (data.success) {
                const d = data.data;
                const insightText = d.insights?.length > 0
                    ? '\n\n' + d.insights.slice(0, 2).map(i => i.text).join('\n')
                    : '';

                setMessages(prev => [...prev, {
                    type: 'ai',
                    content: `✅ ${d.description}\n\n📊 Found **${d.rowCount}** result${d.rowCount !== 1 ? 's' : ''} — visualized as **${d.chartType}** chart.${insightText}`,
                    sql: d.sql,
                    rowCount: d.rowCount,
                    timestamp: new Date()
                }]);
                onQueryResult(d);
            } else {
                setMessages(prev => [...prev, {
                    type: 'ai',
                    content: `⚠️ ${data.message}${data.suggestion ? `\n\n💡 ${data.suggestion}` : ''}`,
                    timestamp: new Date()
                }]);
            }
        } catch {
            setMessages(prev => [...prev, {
                type: 'ai',
                content: '❌ Failed to process query. Please check if the server is running.',
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const toggleVoice = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice recognition is not supported in this browser. Please use Chrome.');
            return;
        }
        if (listening) { recognitionRef.current?.stop(); setListening(false); return; }

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            setListening(false);
            setTimeout(() => handleSend(transcript), 300);
        };
        recognition.onerror = () => setListening(false);
        recognition.onend = () => setListening(false);
        recognition.start();
        recognitionRef.current = recognition;
        setListening(true);
    };

    const formatMsg = (text) => {
        // Simple bold support: **text**
        return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} style={{ color: 'var(--text-accent)' }}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <div className="chat-panel">
            <div className="chat-header">
                <span style={{ fontSize: '1.2rem' }}>💬</span>
                <h3>AI Assistant</h3>
                <span className="ai-badge">AI Powered</span>
            </div>

            <div className="chat-messages">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.type}`}>
                        <div className="message-avatar">{msg.type === 'ai' ? '🧠' : '👤'}</div>
                        <div className="message-content">
                            <div style={{ whiteSpace: 'pre-wrap' }}>{formatMsg(msg.content)}</div>
                            {msg.sql && (
                                <div className="message-sql">
                                    <div className="message-sql-header">
                                        <span>Generated SQL</span>
                                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                                            <button onClick={() => setShowSql(p => ({ ...p, [idx]: !p[idx] }))}>
                                                {showSql[idx] === false ? 'Show' : 'Hide'}
                                            </button>
                                            <button onClick={() => navigator.clipboard.writeText(msg.sql)}>Copy</button>
                                        </div>
                                    </div>
                                    {showSql[idx] !== false && <code>{msg.sql}</code>}
                                </div>
                            )}
                            {msg.rowCount !== undefined && (
                                <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                    📄 {msg.rowCount} row{msg.rowCount !== 1 ? 's' : ''} returned
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="message ai">
                        <div className="message-avatar" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #a855f7)' }}>🧠</div>
                        <div className="typing-indicator">
                            <div className="typing-dots"><span></span><span></span><span></span></div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Analyzing your query...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {messages.length <= 1 && (
                <div className="suggestion-chips" style={{ padding: '0 1rem 0.5rem' }}>
                    {SUGGESTIONS.map((s, i) => (
                        <button key={i} className="suggestion-chip" onClick={() => handleSend(s)}>{s}</button>
                    ))}
                </div>
            )}

            <div className="chat-input-area">
                <div className="chat-input-wrapper">
                    <button className={`btn-icon btn-voice ${listening ? 'listening' : ''}`} onClick={toggleVoice} title={listening ? 'Stop listening' : 'Voice query'}>
                        {listening ? '⏹️' : '🎤'}
                    </button>
                    <input
                        ref={inputRef}
                        className="chat-input"
                        placeholder={listening ? '🎤 Listening...' : 'Ask about your data...'}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={loading}
                    />
                    <button className="btn-icon btn-send" onClick={() => handleSend()} disabled={!input.trim() || loading} title="Send">➤</button>
                </div>
            </div>
        </div>
    );
}
