import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTasks } from '../../api/tasks';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import HamburgerBtn from '../../components/HamburgerBtn';

export default function VendorDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTasks().then(setTasks).finally(() => setLoading(false));
  }, []);

  const pending    = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const submitted  = tasks.filter(t => t.status === 'submitted').length;
  const completed  = tasks.filter(t => t.status === 'completed').length;

  const active = tasks.filter(t => !['completed', 'rejected'].includes(t.status));

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
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>My Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Welcome, {user?.full_name} 👋</p>
          </div>
        </div>
        <Link to="/vendor/tasks" className="btn btn-secondary">📋 All Tasks</Link>
      </div>

      <div className="page-body">
        <div className="grid-4" style={{ marginBottom: 24 }}>
          <div className="stat-card warning">
            <span className="stat-label">Pending</span>
            <span className="stat-value">{pending}</span>
            <span className="stat-desc">Not yet started</span>
          </div>
          <div className="stat-card info">
            <span className="stat-label">In Progress</span>
            <span className="stat-value">{inProgress}</span>
            <span className="stat-desc">Currently working</span>
          </div>
          <div className="stat-card accent">
            <span className="stat-label">Submitted</span>
            <span className="stat-value">{submitted}</span>
            <span className="stat-desc">Awaiting review</span>
          </div>
          <div className="stat-card success">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{completed}</span>
            <span className="stat-desc">All done ✓</span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Active Tasks ({active.length})</span>
            <Link to="/vendor/tasks" className="btn btn-ghost btn-sm">View all →</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {active.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <span className="empty-icon">🎉</span>
                <span className="empty-title">All clear!</span>
                <span className="empty-desc">No active tasks right now. Check back soon.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {active.map(task => (
                  <Link
                    key={task.id}
                    to={`/vendor/tasks/${task.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 20px', borderBottom: '1px solid var(--border-subtle)',
                      textDecoration: 'none', color: 'inherit', transition: 'background var(--transition)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="font-semibold truncate" style={{ fontSize: 14 }}>{task.title}</div>
                      {task.due_date && (
                        <div className="text-muted text-sm">
                          📅 Due {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={task.status} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
