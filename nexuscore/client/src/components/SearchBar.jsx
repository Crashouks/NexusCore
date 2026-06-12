import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import Icon from '../components/Icon';

const RECENT_KEY = 'nc_recent_searches';
const TRENDING = ['Action', 'RPG', 'Racing', 'Cloud', 'Free Trial'];

export default function SearchBar({ inputRef: externalRef }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  const internalRef = useRef(null);
  const inputRef = externalRef || internalRef;
  const navigate = useNavigate();

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')); } catch { setRecent([]); }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputRef]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await api.games.list(`search=${encodeURIComponent(query)}&limit=8`);
        setResults(data.games || []);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const saveRecent = (term) => {
    const updated = [term, ...recent.filter(r => r !== term)].slice(0, 5);
    setRecent(updated);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  };

  const goSearch = (term) => {
    if (!term.trim()) return;
    saveRecent(term.trim());
    navigate(`/store?search=${encodeURIComponent(term.trim())}`);
    setFocused(false);
  };

  return (
    <div className="search-bar-wrap">
      <div className="search-bar">
        <Icon name="search" size={18} className="search-bar-icon" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={e => e.key === 'Enter' && goSearch(query)}
          placeholder="Search games, genres, publishers…"
        />
        <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-dim)' }}>Ctrl+K</span>

        {focused && (results.length > 0 || recent.length > 0 || !query) && (
          <div className="search-results">
            {!query && recent.length > 0 && (
              <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Recent</div>
                {recent.map(r => (
                  <button key={r} onMouseDown={() => goSearch(r)} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                    background: 'none', border: 'none', color: 'var(--text-muted)', borderRadius: 6, fontSize: 14,
                  }}>{r}</button>
                ))}
              </div>
            )}
            {!query && (
              <div style={{ padding: '8px 12px', borderTop: recent.length ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Trending</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TRENDING.map(t => (
                    <button key={t} onMouseDown={() => goSearch(t)} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{t}</button>
                  ))}
                </div>
              </div>
            )}
            {results.map(g => (
              <button key={g.game_id} onMouseDown={() => navigate(`/games/${g.slug || g.game_id}`)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px',
                background: 'none', border: 'none', borderBottom: '1px solid var(--border)', textAlign: 'left',
              }}>
                <img src={g.cover_url} alt="" style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 4 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.genre} · {g.tags?.split(',')[0]}</div>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                  {g.is_free ? 'Free' : `$${parseFloat(g.price).toFixed(2)}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
