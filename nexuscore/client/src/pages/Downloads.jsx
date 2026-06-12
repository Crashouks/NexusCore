import { Navigate } from 'react-router-dom';

export default function Downloads() {
  return <Navigate to="/library?tab=downloads" replace />;
}
