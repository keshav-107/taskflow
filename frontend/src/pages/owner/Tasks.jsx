import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTasks, updateTask, deleteTask } from '../../api/tasks';
import StatusBadge from '../../components/StatusBadge';
import { useToast } from '../../context/ToastContext';

const ALL_STATUSES = ['', 'pending', 'in_progress', 'submitted', 'completed', 'rejected'];

export default function OwnerTasks() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = (status = filter) => {
    setLoading(true);
    listTasks(status ? { status } : {})
      .then(setTasks)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete task "${title}"? This cannot be undone.`)) return;
    try {
      await deleteTask(id);
      toast.success('Task deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updateTask(id, { status });
      toast.success('Status updated');
      load();
    } catch { toast.error('Update failed'); }
  };

  const displayed = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
                          t.vendor?.full_name?.toLowerCase().includes(search.toLowerCase());
    
    let matchesDate = true;
    const taskDate = new Date(t.created_at).setHours(0,0,0,0);
    
    if (fromDate) {
      matchesDate = matchesDate && taskDate >= new Date(fromDate).setHours(0,0,0,0);
    }
    if (toDate) {
      matchesDate = matchesDate && taskDate <= new Date(toDate).setHours(0,0,0,0);
    }
    
    return matchesSearch && matchesDate;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Tasks</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{tasks.length} total tasks</p>
        </div>
        <Link to="/owner/tasks/new" className="btn btn-primary">＋ New Task</Link>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div className="flex items-center gap-3" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="🔍  Search tasks or vendors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 220 }}
          />
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
            <span className="empty-title">No tasks found</span>
            <span className="empty-desc">Try adjusting your filter or create a new task.</span>
            <Link to="/owner/tasks/new" className="btn btn-primary" style={{ marginTop: 8 }}>
              Create Task
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayed.map(task => (
              <div key={task.id} className="task-card" style={{ cursor: 'default' }}>
                <div className="task-card-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      to={`/owner/tasks/${task.id}`}
                      className="task-card-title"
                      style={{ display: 'block', color: 'var(--text-primary)', textDecoration: 'none' }}
                    >
                      {task.title}
                    </Link>
                    {task.description && (
                      <p className="text-muted text-sm truncate" style={{ marginTop: 4 }}>{task.description}</p>
                    )}
                  </div>
                  <StatusBadge status={task.status} />
                </div>

                <div className="task-card-meta">
                  <span className="task-meta-item">
                    🏢 {task.vendor?.full_name || 'Unassigned'}
                  </span>
                  {task.due_date && (
                    <span className="task-meta-item">
                      📅 Due {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                  <span className="task-meta-item">
                    🕒 {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                  <Link to={`/owner/tasks/${task.id}`} className="btn btn-secondary btn-sm">
                    👁 View
                  </Link>
                  {task.status === 'submitted' && (
                    <button
                      className="btn btn-sm"
                      style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid rgba(34,197,94,.3)' }}
                      onClick={() => handleStatusChange(task.id, 'completed')}
                    >
                      ✅ Mark Complete
                    </button>
                  )}
                  {task.status === 'submitted' && (
                    <button className="btn btn-danger btn-sm"
                      onClick={() => handleStatusChange(task.id, 'rejected')}>
                      ❌ Reject
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: 'auto', color: 'var(--danger)' }}
                    onClick={() => handleDelete(task.id, task.title)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
