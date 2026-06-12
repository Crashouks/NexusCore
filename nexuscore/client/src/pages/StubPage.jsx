import { Link } from 'react-router-dom';

export default function StubPage({ title, description }) {
  return (
    <div className="page" style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
      <div className="card" style={{ padding: 48 }}>
        <h1 className="font-display" style={{ fontSize: 32, marginBottom: 12 }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>{description}</p>
        <span style={{ display: 'inline-block', background: 'var(--accent-dim)', color: 'var(--accent)', padding: '6px 16px', borderRadius: 20, fontSize: 13, marginBottom: 24 }}>Coming Soon</span>
        <div><Link to="/" className="btn btn-primary">Back to Store</Link></div>
      </div>
    </div>
  );
}
