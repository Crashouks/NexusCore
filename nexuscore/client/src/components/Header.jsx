import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCloud } from '../context/CloudContext';
import { useNotifications } from '../context/NotificationContext';
import NavDropdown from './NavDropdown';
import Icon from './Icon';

const STORE_ITEMS = [
  { icon: 'grid', label: 'Browse All Games', to: '/store' },
  { icon: 'clock', label: 'Free to Try', to: '/store?trial=1' },
  { icon: 'flame', label: 'Top Sellers', to: '/store?sort=rating' },
];

const LIBRARY_ITEMS = [
  { icon: 'library', label: 'My Games', to: '/library' },
  { icon: 'history', label: 'Recently Played', to: '/library?tab=recent' },
  { icon: 'download', label: 'Downloads', to: '/library?tab=downloads' },
  { icon: 'heart', label: 'Wishlist', to: '/wishlist' },
];

const CLOUD_ITEMS = [
  { icon: 'play', label: 'Stream Now (GeForce Now)', to: '/cloud' },
  { icon: 'cloud', label: 'Compatible Games', to: '/store?cloud=1' },
  { icon: 'chart', label: 'My Cloud Sessions', to: '/profile#cloud-sessions' },
  { icon: 'settings', label: 'Streaming Settings', to: '/cloud#settings' },
];

const COMMUNITY_ITEMS = [
  { icon: 'message', label: 'Forums', to: '/community?tab=forums' },
  { icon: 'users', label: 'Friends', to: '/community?tab=friends' },
];

const NOTIFICATION_ICONS = {
  purchase: 'receipt',
  download: 'download',
  wishlist: 'heart',
  friend_request: 'users',
  friend_added: 'users',
};

const AVATAR_ITEMS = [
  { icon: 'user', label: 'Profile', to: '/profile' },
  { icon: 'receipt', label: 'Purchase History', to: '/purchases' },
];

export default function Header() {
  const { isAuth, user, profile, logout } = useAuth();
  const { session } = useCloud();
  const { items: notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const prevUnread = useRef(0);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (unreadCount > prevUnread.current && unreadCount > 0) {
      setBellOpen(true);
    }
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (!bellOpen && !avatarOpen) return undefined;
    const close = (e) => {
      if (!e.target.closest('.header-icon-wrap')) {
        setBellOpen(false);
        setAvatarOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [bellOpen, avatarOpen]);

  const handleNotificationClick = async (n) => {
    if (!n.is_read) await markRead(n.notification_id);
    setBellOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <header className={`site-header ${scrolled ? 'header-scrolled' : ''}`}>
      <div className="page header-inner">
        <Link to="/" className="font-display logo-text">
          Nexus<span className="logo-accent">Core</span>
        </Link>

        <button
          type="button"
          className="header-menu-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
        >
          <span className="header-menu-icon" aria-hidden />
        </button>

        <nav className={`header-nav ${menuOpen ? 'header-nav--open' : ''}`}>
          <NavDropdown label="Store" items={STORE_ITEMS} />
          {isAuth && <NavDropdown label="Library" items={LIBRARY_ITEMS} />}
          {isAuth && <NavDropdown label="Cloud" items={CLOUD_ITEMS} />}
          <NavDropdown label="Community" items={COMMUNITY_ITEMS} />
        </nav>

        <div className="header-actions">
          {isAuth ? (
            <>
              <div className="header-icon-wrap">
                <button type="button" className="icon-btn notification-btn" onClick={() => setBellOpen(!bellOpen)} title="Notifications">
                  <Icon name="bell" size={20} />
                  {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
                {bellOpen && (
                  <div className="nav-dropdown nav-dropdown-right notification-dropdown">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      <strong style={{ fontSize: 13 }}>Notifications</strong>
                      {unreadCount > 0 && (
                        <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={markAllRead}>Mark all read</button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="nav-empty">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <button
                          key={n.notification_id}
                          type="button"
                          className={`nav-dropdown-item notification-item ${n.is_read ? '' : 'notification-unread'}`}
                          onClick={() => handleNotificationClick(n)}
                        >
                          <Icon name={NOTIFICATION_ICONS[n.type] || 'bell'} size={16} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, lineHeight: 1.4 }}>{n.message}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                              {new Date(n.created_at).toLocaleString()}
                            </div>
                          </div>
                          {!n.is_read && (
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {session && (
                <Link to="/cloud" className="stream-indicator" title="Streaming active">
                  <span className="pulse-green stream-dot" />
                </Link>
              )}

              {user?.role === 'developer' && (
                <Link to="/developer" className="header-link">Dev</Link>
              )}
              {user?.role === 'admin' && (
                <Link to="/admin" className="header-link header-link-admin">Admin</Link>
              )}

              <div className="header-icon-wrap">
                <button type="button" className="avatar-btn" onClick={() => setAvatarOpen(!avatarOpen)}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                  ) : (
                    user?.username?.[0]?.toUpperCase()
                  )}
                </button>
                {avatarOpen && (
                  <div className="nav-dropdown nav-dropdown-right">
                    {AVATAR_ITEMS.map(item => (
                      <Link key={item.to} to={item.to} className="nav-dropdown-item" onClick={() => setAvatarOpen(false)}>
                        <Icon name={item.icon} size={16} />
                        {item.label}
                      </Link>
                    ))}
                    <button type="button" className="nav-dropdown-item nav-dropdown-danger" onClick={() => { logout(); setAvatarOpen(false); navigate('/'); }}>
                      <Icon name="logout" size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Log In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
