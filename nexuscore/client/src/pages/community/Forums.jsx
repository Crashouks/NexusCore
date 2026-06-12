import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';

function formatWhen(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString();
}

export default function Forums() {
  const [params, setSearchParams] = useSearchParams();
  const topicId = params.get('topic');
  const { isAuth } = useAuth();
  const { showToast } = useToast();

  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);

  const loadTopics = () => {
    setLoading(true);
    api.forums.list()
      .then(setTopics)
      .catch(() => setTopics([]))
      .finally(() => setLoading(false));
  };

  const loadThread = (id) => {
    setLoading(true);
    api.forums.detail(id)
      .then(data => {
        setThread(data.topic);
        setPosts(data.posts || []);
      })
      .catch(() => {
        setThread(null);
        setPosts([]);
        showToast('Could not load topic', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (topicId) loadThread(topicId);
    else {
      setThread(null);
      setPosts([]);
      loadTopics();
    }
  }, [topicId]);

  const openTopic = (id) => setSearchParams({ tab: 'forums', topic: String(id) });
  const backToList = () => setSearchParams({ tab: 'forums' });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAuth) {
      showToast('Log in to create a forum topic', 'error');
      return;
    }
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const created = await api.forums.create(title);
      setNewTitle('');
      showToast('Topic created', 'success');
      openTopic(created.topic_id);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!isAuth) {
      showToast('Log in to post', 'error');
      return;
    }
    const content = reply.trim();
    if (!content || !topicId) return;
    setPosting(true);
    try {
      const post = await api.forums.post(topicId, content);
      setPosts(prev => [...prev, post]);
      setReply('');
      showToast('Posted', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPosting(false);
    }
  };

  if (topicId) {
    if (loading && !thread) {
      return <div className="skeleton" style={{ height: 200, maxWidth: 800, margin: '0 auto' }} />;
    }
    if (!thread) {
      return (
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Topic not found.</p>
          <button type="button" className="btn btn-primary" onClick={backToList}>Back to topics</button>
        </div>
      );
    }
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <button type="button" className="btn btn-ghost" style={{ marginBottom: 20, padding: '6px 12px', fontSize: 13 }}
          onClick={backToList}>
          <Icon name="chevronLeft" size={14} /> All topics
        </button>

        <h1 className="font-display" style={{ fontSize: 28, marginBottom: 8 }}>{thread.title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
          Started by {thread.author} · {formatWhen(thread.created_at)}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {posts.length === 0 && !loading && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
              No posts yet. Be the first to write in this topic.
            </p>
          )}
          {posts.map(p => (
            <div key={p.post_id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
                <strong>{p.username}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatWhen(p.created_at)}</span>
              </div>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{p.content}</p>
            </div>
          ))}
        </div>

        {isAuth ? (
          <form onSubmit={handleReply} className="card" style={{ padding: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Write a post</label>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Share your thoughts..."
              rows={4}
              style={{
                width: '100%', padding: 12, borderRadius: 'var(--radius)',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                color: 'var(--text)', marginBottom: 12, resize: 'vertical',
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={posting || !reply.trim()}>
              {posting ? 'Posting...' : 'Post'}
            </button>
          </form>
        ) : (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>Log in to write in this topic.</p>
            <Link to="/login" className="btn btn-primary">Log In</Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {isAuth ? (
        <form onSubmit={handleCreate} className="card" style={{ padding: 16, marginBottom: 24 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>New forum topic</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Topic title..."
              maxLength={200}
              style={{
                flex: 1, minWidth: 200, padding: 10, borderRadius: 'var(--radius)',
                background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)',
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={creating || !newTitle.trim()}>
              {creating ? 'Creating...' : 'Create Topic'}
            </button>
          </div>
        </form>
      ) : (
        <div className="card" style={{ padding: 16, marginBottom: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>Log in to create forum topics and post replies.</p>
          <Link to="/login" className="btn btn-primary">Log In</Link>
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : topics.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 48 }}>
          No topics yet. Create the first one above.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {topics.map(t => (
            <button
              key={t.topic_id}
              type="button"
              className="card"
              onClick={() => openTopic(t.topic_id)}
              style={{
                padding: '16px 20px', textAlign: 'left', cursor: 'pointer',
                border: '1px solid var(--border)', width: '100%',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, color: 'var(--text)' }}>{t.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>by {t.author}</span>
                <span>{t.post_count || 0} posts</span>
                {t.last_post_at && <span>last activity {formatWhen(t.last_post_at)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
