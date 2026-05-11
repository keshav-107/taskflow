import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ownerNav = [
  { to: '/owner/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/owner/tasks',     icon: '📋', label: 'Tasks' },
  { to: '/owner/vendors',   icon: '🏢', label: 'Vendors' },
  { to: '/owner/ledger',    icon: '💰', label: 'Ledger' },
];

const vendorNav = [
  { to: '/vendor/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/vendor/tasks',     icon: '📋', label: 'My Tasks' },
  { to: '/vendor/ledger',    icon: '💰', label: 'My Ledger' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const nav = user?.role === 'owner' ? ownerNav : vendorNav;
  const initials = user?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">⚡</div>
        <span className="sidebar-brand-name">TaskFlow</span>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-section-label">Navigation</span>
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <div className="avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-semibold text-sm truncate">{user?.full_name}</div>
            <div className="text-muted" style={{ fontSize: 11 }}>
              {user?.role === 'owner' ? '👑 Owner' : '🏢 Vendor'}
            </div>
          </div>
        </div>
        <button className="btn btn-ghost w-full btn-sm" onClick={logout}>
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
}
