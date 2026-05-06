import { useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

export default function ProtectedLayout({ role }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'owner' ? '/owner/dashboard' : '/vendor/dashboard'} replace />;
  }

  return (
    <div className="app-shell">
      {/* Overlay — always rendered, visible only when sidebar is open on mobile */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        {/* Mobile topbar with hamburger */}
        <div className="mobile-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Open menu">
            <span /><span /><span />
          </button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>⚡ TaskFlow</span>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
