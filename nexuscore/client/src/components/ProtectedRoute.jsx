import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { isAuth, user, loading } = useAuth();
  if (loading) return <div className="page" style={{ textAlign: 'center', paddingTop: 100 }}>Loading...</div>;
  if (!isAuth) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
