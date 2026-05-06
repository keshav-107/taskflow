import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import { SidebarContext } from './SidebarContext';

export default function ProtectedLayout({ role }) {
  const { user, loading } = useAuth();
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
      {/* Tap-to-close overlay on mobile */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        {/* Provide sidebar toggle to all child pages */}
        <SidebarContext.Provider value={{ toggle: () => setSidebarOpen(o => !o) }}>
          <Outlet />
        </SidebarContext.Provider>
      </main>
    </div>
  );
}
