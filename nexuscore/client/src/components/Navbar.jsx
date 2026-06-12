import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCloud } from '../context/CloudContext';
import { useTrial } from '../context/TrialContext';

export default function Navbar() {
  const { isAuth, user, logout } = useAuth();
  const { session } = useCloud();
  const { activeTrial } = useTrial();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [dropdown, setDropdown] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/store?search=${encodeURIComponent(search.trim())}`);
  };

  const navLink = (to, label, extra) => (
    <Link to={to} style={{
      color: location.pathname === to ? 'var(--accent-glow)' : 'var(--text-muted)',
      fontWeight: 500, fontSize: 14, position: 'relative',
    }}>
      {label}{extra}
    </Link>
  );

  return (
    <nav style={{
      background: 'rgba(13,13,20,0.9)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div className="page" style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '14px 20px' }}>
        <Link to="/" className="font-display gradient-text" style={{ fontSize: 26, fontWeight: 700, flexShrink: 0 }}>
          NexusCore
        </Link>

        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 400 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search games..."
            style={{
              width: '100%', padding: '8px 16px', borderRadius: 'var(--radius)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text)', outline: 'none',
            }} />
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginLeft: 'auto' }}>
          {isAuth ? (
            <>
              {navLink('/store', 'Store')}
              {navLink('/library', 'Library')}
              <Link to="/cloud" style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                Cloud
                {session && <span className="pulse-mint" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--neon)', display: 'inline-block' }} />}
              </Link>
              {activeTrial && (
                <span className="pulse-amber" style={{ fontSize: 12, color: 'var(--trial)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ⏱ Trial
                </span>
              )}
              {user?.role === 'developer' && navLink('/developer', 'Developer')}
              {user?.role === 'admin' && (
                <Link to="/admin" style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>Admin</Link>
              )}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setDropdown(!dropdown)} style={{
                  background: 'var(--accent-dim)', border: 'none', borderRadius: '50%',
                  width: 36, height: 36, color: 'var(--accent-glow)', fontWeight: 700,
                }}>
                  {user?.username?.[0]?.toUpperCase()}
                </button>
                {dropdown && (
                  <div className="card" style={{ position: 'absolute', right: 0, top: 44, minWidth: 160, padding: 8, zIndex: 200 }}>
                    <Link to="/profile" onClick={() => setDropdown(false)}
                      style={{ display: 'block', padding: '10px 14px', borderRadius: 6, color: 'var(--text)' }}
                      onMouseEnter={e => e.target.style.background = 'var(--bg-elevated)'}
                      onMouseLeave={e => e.target.style.background = ''}>
                      Profile
                    </Link>
                    <button onClick={() => { logout(); setDropdown(false); navigate('/'); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                        borderRadius: 6, background: 'none', border: 'none', color: 'var(--danger)' }}>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost" style={{ padding: '8px 16px' }}>Log In</Link>
              <Link to="/register" className="btn btn-primary" style={{ padding: '8px 16px' }}>Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
