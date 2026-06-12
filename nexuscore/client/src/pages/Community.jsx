import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Forums from './community/Forums';
import Friends from './Friends';

export default function Community() {
  const [params] = useSearchParams();
  const tab = params.get('tab') || 'forums';
  const { isAuth } = useAuth();

  if (tab === 'friends') {
    return isAuth ? (
      <div className="page"><Friends /></div>
    ) : (
      <div className="page">
        <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Log in to add friends and see your friend list.</p>
          <Link to="/login" className="btn btn-primary">Log In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Forums />
    </div>
  );
}
