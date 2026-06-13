import { useState } from 'react';
import { api } from '../api/api';
import { useToast } from './Toast';

export default function ExePathInput({ value, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const browse = async () => {
    setBusy(true);
    try {
      const pick = await api.admin.browseExecutable();
      if (pick.cancelled || !pick.path) return;
      onChange(pick.path);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', minWidth: 0 }}>
      <input
        value={value || ''}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        placeholder="C:\Games\MyGame\game.exe"
        style={{
          flex: 1,
          minWidth: 0,
          padding: 6,
          borderRadius: 6,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={browse}
        disabled={disabled || busy}
        title="Browse for .exe on this PC (Windows server only)"
        style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
      >
        {busy ? '…' : 'Browse'}
      </button>
    </div>
  );
}
