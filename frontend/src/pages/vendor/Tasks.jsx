import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTasks } from '../../api/tasks';
import StatusBadge from '../../components/StatusBadge';
import HamburgerBtn from '../../components/HamburgerBtn';

export default function VendorTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    listTasks(filter ? { status: filter } : {}).then(setTasks).finally(() => setLoading(false));
  }, [filter]);

  const ALL_STATUSES = ['', 'pending', 'in_progress', 'submitted', 'completed', 'rejected'];

  const displayed = tasks.filter(t => {
    let matchesDate = true;
    const taskDate = new Date(t.created_at).setHours(0,0,0,0);
    
    if (fromDate) {
      matchesDate = matchesDate && taskDate >= new Date(fromDate).setHours(0,0,0,0);
    }
    if (toDate) {
      matchesDate = matchesDate && taskDate <= new Date(toDate).setHours(0,0,0,0);
    }
    
    return matchesDate;
  });

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <HamburgerBtn />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>My Tasks</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{tasks.length} tasks assigned to you</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="flex items-center gap-3" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2">
            <input type="date" className="form-input btn-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} title="From Date" style={{ width: 140 }} />
            <span className="text-muted">–</span>
            <input type="date" className="form-input btn-sm" value={toDate} onChange={e => setToDate(e.target.value)} title="To Date" style={{ width: 140 }} />
          </div>
          <div className="flex items-center gap-2">
            {ALL_STATUSES.map(s => (
              <button
                key={s}
                className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(s)}
              >
                {s ? s.replace('_', ' ') : 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: 64 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <span className="empty-title">No tasks here</span>
            <span className="empty-desc">No tasks match this filter.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayed.map(task => (
              <Link key={task.id} to={`/vendor/tasks/${task.id}`} className="task-card">
                <div className="task-card-header">
                  <span className="task-card-title">{task.title}</span>
                  <StatusBadge status={task.status} />
                </div>
                {task.description && (
                  <p className="text-muted text-sm truncate">{task.description}</p>
                )}
                <div className="task-card-meta">
                  {task.due_date && (
                    <span className="task-meta-item">📅 Due {new Date(task.due_date).toLocaleDateString()}</span>
                  )}
                  <span className="task-meta-item">🕒 {new Date(task.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
