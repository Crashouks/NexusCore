import { useState } from 'react';
import { useTrial } from '../context/TrialContext';
import BuyModal from './BuyModal';
import Icon from './Icon';

export default function TrialBar() {
  const { activeTrial, endTrial } = useTrial();
  const [buyOpen, setBuyOpen] = useState(false);

  if (!activeTrial) return null;

  const mins = activeTrial.minutesRemaining ?? 30;

  return (
    <>
      <div style={{
        background: 'var(--trial)', color: '#1a1a2e', padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        fontWeight: 600, fontSize: 14, flexWrap: 'wrap',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="clock" size={16} /> Trial Mode — {activeTrial.name}
        </span>
        <span>| {mins}:{String(0).padStart(2, '0')} remaining</span>
        <button className="btn" style={{ background: '#1a1a2e', color: 'var(--trial)', padding: '6px 14px', fontSize: 13 }}
          onClick={() => setBuyOpen(true)}>
          Buy Now — ${parseFloat(activeTrial.price || 0).toFixed(2)}
        </button>
        <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13, borderColor: '#1a1a2e', color: '#1a1a2e' }}
          onClick={endTrial}>
          End Trial
        </button>
      </div>
      <BuyModal open={buyOpen} onClose={() => setBuyOpen(false)} game={activeTrial} />
    </>
  );
}
