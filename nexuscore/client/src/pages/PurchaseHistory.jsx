import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/api';

export default function PurchaseHistory() {
  const { profile } = useAuth();
  const [library, setLibrary] = useState([]);

  useEffect(() => {
    if (profile) api.users.library(profile.user_id).then(setLibrary);
  }, [profile]);

  return (
    <div className="page">
      <h1 className="font-display" style={{ fontSize: 32, marginBottom: 24 }}>Purchase History</h1>
      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {['Game', 'Date', 'Price'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {library.map(g => (
              <tr key={g.game_id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px' }}>{g.name}</td>
                <td style={{ padding: '12px 16px' }}>{new Date(g.purchase_date).toLocaleDateString()}</td>
                <td style={{ padding: '12px 16px' }}>${parseFloat(g.purchase_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!library.length && <p style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No purchases yet.</p>}
      </div>
    </div>
  );
}
