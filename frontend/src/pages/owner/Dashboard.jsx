import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTasks } from '../../api/tasks';
import { listVendors } from '../../api/vendors';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import HamburgerBtn from '../../components/HamburgerBtn';

const STATUS_ORDER = ['pending', 'in_progress', 'submitted', 'completed', 'rejected'];

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listTasks(), listVendors()])
      .then(([t, v]) => { setTasks(t); setVendors(v); })
      .finally(() => setLoading(false));
  }, []);

  const stats = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s).length;
    return acc;
  }, {});

  const recent = tasks.slice(0, 5);

  if (loading) return (
    <div className="page-body flex items-center justify-center" style={{ minHeight: 300 }}>
      <div className="spinner spinner-lg" />
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <HamburgerBtn />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Welcome back, {user?.full_name} 👋</p>
          </div>
        </div>
        <Link to="/owner/tasks/new" className="btn btn-primary">
          ＋ New Task
        </Link>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 24 }}>
          <div className="stat-card accent">
            <span className="stat-label">Total Tasks</span>
            <span className="stat-value">{tasks.length}</span>
            <span className="stat-desc">All assigned tasks</span>
          </div>
          <div className="stat-card warning">
            <span className="stat-label">Pending</span>
            <span className="stat-value">{stats.pending + stats.in_progress}</span>
            <span className="stat-desc">Awaiting completion</span>
          </div>
          <div className="stat-card info">
            <span className="stat-label">Submitted</span>
            <span className="stat-value">{stats.submitted}</span>
            <span className="stat-desc">Ready for review</span>
          </div>
          <div className="stat-card success">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{stats.completed}</span>
            <span className="stat-desc">Successfully done</span>
          </div>
        </div>

        <div className="grid-2">
          {/* Recent Tasks */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Tasks</span>
              <Link to="/owner/tasks" className="btn btn-ghost btn-sm">View all →</Link>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {recent.length === 0 ? (
                <div className="empty-state" style={{ padding: 32 }}>
                  <span className="empty-icon">📋</span>
                  <span className="empty-title">No tasks yet</span>
                  <Link to="/owner/tasks/new" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                    Create your first task
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {recent.map(task => (
                    <Link
                      key={task.id}
                      to={`/owner/tasks/${task.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
                        textDecoration: 'none', color: 'inherit', transition: 'background var(--transition)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                  <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {task.registration_no && (
                            <span className="font-semibold" style={{ fontSize: 14, color: 'var(--text-accent)' }}>🚗 {task.registration_no}</span>
                          )}
                          <span className="text-muted truncate" style={{ fontSize: 13 }}>{task.title}</span>
                        </div>
                        <div className="text-muted text-sm">{task.vendor?.full_name || 'Unassigned'}</div>
                      </div>
                      <StatusBadge status={task.status} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Vendors Overview */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Vendors ({vendors.length})</span>
              <Link to="/owner/vendors" className="btn btn-ghost btn-sm">Manage →</Link>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {vendors.length === 0 ? (
                <div className="empty-state" style={{ padding: 32 }}>
                  <span className="empty-icon">🏢</span>
                  <span className="empty-title">No vendors yet</span>
                  <Link to="/owner/vendors" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                    Add a vendor
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {vendors.slice(0, 6).map(v => {
                    const initials = v.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    const taskCount = tasks.filter(t => t.vendor_id === v.id).length;
                    return (
                      <div
                        key={v.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '11px 20px', borderBottom: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div className="avatar">{initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="font-semibold truncate" style={{ fontSize: 14 }}>{v.full_name}</div>
                          <div className="text-muted text-sm">{v.company_name || v.email}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, color: 'var(--text-accent)', fontWeight: 600 }}>{taskCount}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>tasks</div>
                        </div>
                        {!v.is_active && (
                          <span className="badge badge-rejected" style={{ fontSize: 10 }}>Inactive</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
