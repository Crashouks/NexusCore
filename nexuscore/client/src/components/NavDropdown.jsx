import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';

export default function NavDropdown({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = items.some(i => i.to && location.pathname + location.search === i.to);

  return (
    <div ref={ref} className="nav-dropdown-wrap">
      <button
        type="button"
        className={`nav-trigger ${isActive ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {label}
        <Icon name="chevronDown" size={14} className={`nav-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="nav-dropdown">
          {items.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-dropdown-item ${location.pathname + location.search === item.to ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
