import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useNotifications } from '../context/NotificationContext';
import Icon from '../components/Icon';

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { refresh: refreshNotifications } = useNotifications();

  const loadAll = useCallback(async () => {
    if (!profile?.user_id) return;
    const [f, r] = await Promise.all([
      api.users.friends(profile.user_id).catch(() => []),
      api.users.friendRequests(profile.user_id).catch(() => []),
    ]);
    setFriends(f);
    setRequests(r);
  }, [profile]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      const r = await api.users.search(search.trim());
      const blocked = new Set([
        profile.user_id,
        ...friends.map(f => f.user_id),
        ...requests.map(req => req.user_id),
      ]);
      setResults(r.filter(u => !blocked.has(u.user_id)));
    } catch {
      setResults([]);
    }
  };

  const addFriend = async (friendId) => {
    if (!profile?.user_id) {
      showToast('Please log in again', 'error');
      return;
    }
    try {
      await api.users.addFriend(profile.user_id, friendId);
      setResults(results.filter(r => r.user_id !== friendId));
      await loadAll();
      refreshNotifications().catch(() => {});
    } catch (err) {
      showToast(err.message || 'Could not send friend request', 'error');
    }
  };

  const acceptRequest = async (friendId) => {
    try {
      await api.users.acceptFriend(profile.user_id, friendId);
      await loadAll();
      refreshNotifications().catch(() => {});
    } catch (err) { showToast(err.message, 'error'); }
  };

  const rejectRequest = async (friendId) => {
    try {
      await api.users.rejectFriend(profile.user_id, friendId);
      setRequests(requests.filter(r => r.user_id !== friendId));
    } catch (err) { showToast(err.message, 'error'); }
  };

  const removeFriend = async (friendId) => {
    try {
      await api.users.removeFriend(profile.user_id, friendId);
      setFriends(friends.filter(f => f.user_id !== friendId));
      showToast('Friend removed', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 32, maxWidth: 500 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by username..."
          style={{ flex: 1, padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {requests.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 className="font-display" style={{ fontSize: 20, marginBottom: 16 }}>Friend Requests ({requests.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map(req => (
              <div key={req.user_id} className="card" style={{
                padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderLeft: '4px solid var(--accent-trial)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--trial-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {req.username[0].toUpperCase()}
                  </div>
                  <div>
                    <strong>{req.username}</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Wants to be your friend</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-success" style={{ padding: '8px 12px' }}
                    title="Accept" onClick={() => acceptRequest(req.user_id)}>
                    <Icon name="check" size={18} />
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ padding: '8px 12px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    title="Decline" onClick={() => rejectRequest(req.user_id)}>
                    <Icon name="x" size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 className="font-display" style={{ fontSize: 20, marginBottom: 16 }}>Search Results</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map(u => (
              <div key={u.user_id} className="card" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{u.username}</span>
                <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => addFriend(u.user_id)}>Add Friend</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display" style={{ fontSize: 20, marginBottom: 16 }}>Your Friends ({friends.length})</h2>
        {friends.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {friends.map(f => (
              <div key={f.user_id} className="card" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {f.username[0].toUpperCase()}
                  </div>
                  <div>
                    <strong>{f.username}</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Since {new Date(f.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13, color: 'var(--danger)' }} onClick={() => removeFriend(f.user_id)}>Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No friends yet. Search above to add some!</p>
        )}
      </section>
    </>
  );
}
