import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      showToast('Welcome back!', 'success');
      navigate('/');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 420, margin: '60px auto' }}>
      <h1 className="font-display gradient-text" style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>Welcome Back</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 32 }}>NexusCore — Own it. Try it. Stream it.</p>
      <form onSubmit={handleSubmit} className="card" style={{ padding: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            style={{ width: '100%', padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            style={{ width: '100%', padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Signing in...' : 'Log In'}
        </button>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: 'var(--text-muted)' }}>
          No account? <Link to="/register" style={{ color: 'var(--accent-glow)' }}>Sign Up</Link>
        </p>
      </form>
    </div>
  );
}
