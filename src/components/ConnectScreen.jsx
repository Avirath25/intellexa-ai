import { useState, useEffect, useRef } from 'react';

// ── Animated particle network background ──
function ParticleNetwork() {
    const canvasRef = useRef(null);
    const mouse = useRef({ x: -1000, y: -1000 });

    useEffect(() => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        let raf;
        const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
        resize();
        window.addEventListener('resize', resize);

        const N = 70;
        const ps = Array.from({ length: N }, () => ({
            x: Math.random() * c.width, y: Math.random() * c.height,
            vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
            r: Math.random() * 2.2 + 0.8, base: Math.random() * 0.4 + 0.15,
        }));

        const draw = () => {
            ctx.clearRect(0, 0, c.width, c.height);
            ps.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > c.width) p.vx *= -1;
                if (p.y < 0 || p.y > c.height) p.vy *= -1;
                // Mouse repulsion
                const dx = p.x - mouse.current.x, dy = p.y - mouse.current.y;
                const md = Math.sqrt(dx * dx + dy * dy);
                if (md < 150) { p.x += dx * 0.02; p.y += dy * 0.02; }
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(99,102,241,${p.base})`;
                ctx.fill();
            });
            for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
                const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 130) {
                    ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y);
                    ctx.strokeStyle = `rgba(99,102,241,${0.12 * (1 - d / 130)})`;
                    ctx.lineWidth = 0.6; ctx.stroke();
                }
            }
            raf = requestAnimationFrame(draw);
        };
        draw();

        const onMouse = (e) => { mouse.current = { x: e.clientX, y: e.clientY }; };
        window.addEventListener('mousemove', onMouse);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMouse); };
    }, []);

    return <canvas ref={canvasRef} className="particle-canvas" />;
}

// ── Typewriter hook ──
function useTypewriter(text, speed = 25) {
    const [displayed, setDisplayed] = useState('');
    useEffect(() => {
        setDisplayed('');
        let i = 0;
        const id = setInterval(() => { if (i < text.length) { setDisplayed(text.slice(0, ++i)); } else clearInterval(id); }, speed);
        return () => clearInterval(id);
    }, [text, speed]);
    return displayed;
}

// ── Feature cards data ──
const FEATURES = [
    { icon: '💬', title: 'Natural Language', desc: 'Ask questions in plain English — no SQL needed', color: '#6366f1' },
    { icon: '📊', title: 'Auto Visualization', desc: 'Charts, tables & KPIs generated automatically', color: '#22d3ee' },
    { icon: '🧠', title: 'AI Insights', desc: 'Smart analysis with trend detection & patterns', color: '#a855f7' },
    { icon: '🎤', title: 'Voice Queries', desc: 'Speak your questions using voice recognition', color: '#10b981' },
];

const DB_TYPES = [
    { id: 'demo', label: 'Demo', icon: '🎯', glow: '#6366f1' },
    { id: 'sqlite', label: 'SQLite', icon: '📦', glow: '#22d3ee' },
    { id: 'mysql', label: 'MySQL', icon: '🐬', glow: '#10b981' },
    { id: 'postgresql', label: 'Postgres', icon: '🐘', glow: '#f59e0b' },
];

export default function ConnectScreen({ onConnect }) {
    const [dbType, setDbType] = useState('demo');
    const [form, setForm] = useState({ host: 'localhost', database: '', username: 'root', password: '', path: '' });
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const heroText = useTypewriter('Ask your database anything.', 40);

    const handleConnect = async (type) => {
        const t = type || dbType;
        setLoading(true);
        setStatus({ type: 'loading', msg: 'Establishing secure connection...' });
        try {
            const res = await fetch('/api/connect', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: t, ...form })
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', msg: data.message });
                setTimeout(() => onConnect(data.schema), 900);
            } else {
                setStatus({ type: 'error', msg: data.message });
                setLoading(false);
            }
        } catch {
            setStatus({ type: 'error', msg: 'Server not reachable. Is npm run dev running?' });
            setLoading(false);
        }
    };

    return (
        <div className="connect-screen">
            <ParticleNetwork />

            <div className="connect-wrapper">
                {/* Left — Hero side */}
                <div className="connect-hero">
                    <div className="hero-badge">✨ AI-Powered Database Intelligence</div>
                    <h1 className="hero-title">INTELLEXA<span>-AI</span></h1>
                    <p className="hero-typewriter">{heroText}<span className="cursor">|</span></p>

                    <div className="hero-features">
                        {FEATURES.map((f, i) => (
                            <div key={i} className="hero-feat" style={{ '--feat-color': f.color, animationDelay: `${0.2 + i * 0.1}s` }}>
                                <div className="hero-feat-icon">{f.icon}</div>
                                <div>
                                    <div className="hero-feat-title">{f.title}</div>
                                    <div className="hero-feat-desc">{f.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="hero-stats">
                        <div className="hero-stat"><span className="stat-num">5+</span><span className="stat-label">DB Types</span></div>
                        <div className="hero-stat-divider" />
                        <div className="hero-stat"><span className="stat-num">∞</span><span className="stat-label">Queries</span></div>
                        <div className="hero-stat-divider" />
                        <div className="hero-stat"><span className="stat-num">6+</span><span className="stat-label">Chart Types</span></div>
                        <div className="hero-stat-divider" />
                        <div className="hero-stat"><span className="stat-num">&lt;1s</span><span className="stat-label">Response</span></div>
                    </div>
                </div>

                {/* Right — Form side */}
                <div className="connect-form-side">
                    <div className="connect-card">
                        <div className="connect-card-header">
                            <div className="card-icon">🔌</div>
                            <div>
                                <h2>Connect Database</h2>
                                <p>Choose your database and start exploring</p>
                            </div>
                        </div>

                        <div className="db-type-selector">
                            {DB_TYPES.map(db => (
                                <button key={db.id} className={`db-type-btn ${dbType === db.id ? 'active' : ''}`} onClick={() => setDbType(db.id)} style={{ '--btn-glow': db.glow }}>
                                    <span className="db-icon">{db.icon}</span>
                                    <span>{db.label}</span>
                                </button>
                            ))}
                        </div>

                        {dbType === 'demo' && (
                            <div className="form-section">
                                <div className="demo-box">
                                    <div className="demo-box-icon">🚀</div>
                                    <div className="demo-box-text">
                                        <strong>Ready-to-explore</strong> e-commerce database with 40 products, 700+ orders spread across 30 customers
                                    </div>
                                </div>
                                <button className="btn-primary" onClick={() => handleConnect('demo')} disabled={loading}>
                                    {loading ? <><span className="spinner" /> Launching...</> : '🚀 Launch Demo Database'}
                                </button>
                            </div>
                        )}

                        {dbType === 'sqlite' && (
                            <div className="form-section">
                                <div className="form-group"><label>Database File Path</label><input type="text" placeholder="C:\path\to\database.db" value={form.path} onChange={e => setForm({ ...form, path: e.target.value })} /></div>
                                <button className="btn-primary" onClick={() => handleConnect()} disabled={loading || !form.path}>
                                    {loading ? <><span className="spinner" /> Connecting...</> : '🔌 Connect'}
                                </button>
                            </div>
                        )}

                        {(dbType === 'mysql' || dbType === 'postgresql') && (
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group"><label>Host</label><input type="text" placeholder="localhost" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} /></div>
                                    <div className="form-group"><label>Database</label><input type="text" placeholder="my_database" value={form.database} onChange={e => setForm({ ...form, database: e.target.value })} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Username</label><input type="text" placeholder="root" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
                                    <div className="form-group"><label>Password</label><input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
                                </div>
                                <button className="btn-primary" onClick={() => handleConnect()} disabled={loading || !form.database}>
                                    {loading ? <><span className="spinner" /> Connecting...</> : `🔌 Connect to ${dbType.toUpperCase()}`}
                                </button>
                            </div>
                        )}

                        {status && (
                            <div className={`connect-status ${status.type}`}>
                                {status.type === 'loading' && <span className="spinner" />}
                                {status.type === 'success' && '✅'} {status.type === 'error' && '❌'} {status.msg}
                            </div>
                        )}

                        <div className="connect-footer">🔒 Credentials stay local — never stored or sent externally</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
