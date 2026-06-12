import { Link } from 'react-router-dom';
import { useCloud } from '../context/CloudContext';
import Icon from './Icon';

export default function CloudSessionBar() {
  const { session } = useCloud();
  if (!session) return null;

  return (
    <div style={{
      background: 'var(--neon-dark)', color: 'white', padding: '8px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      fontSize: 14, fontWeight: 500,
    }}>
      <span className="pulse-mint" style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', display: 'inline-block' }} />
      <Icon name="cloud" size={16} />
      GeForce Now — {session.name}
      {session.minutes_remaining != null && (
        <span>| {session.minutes_remaining} min remaining</span>
      )}
      <Link to="/cloud" style={{ textDecoration: 'underline', marginLeft: 8 }}>View Session</Link>
    </div>
  );
}
