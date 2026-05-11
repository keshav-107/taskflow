import { useEffect, useState } from 'react';
import { getVendorLedger } from '../../api/payments';
import StatusBadge from '../../components/StatusBadge';
import HamburgerBtn from '../../components/HamburgerBtn';
import { Link } from 'react-router-dom';

export default function VendorLedger() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getVendorLedger().then(setEntries).finally(() => setLoading(false));
  }, []);

  const totalPolicy     = entries.reduce((s, e) => s + (Number(e.policy_amount) || 0), 0);
  const totalCommission = entries.reduce((s, e) => s + (Number(e.commission_amount) || 0), 0);
  const totalBalance    = entries.reduce((s, e) => s + (Number(e.net_balance) || 0), 0);

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
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>💰 My Ledger</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your personal financial record across all tasks</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Summary cards */}
        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <span className="stat-label">Total Policy Value</span>
            <span className="stat-value">₹{totalPolicy.toLocaleString()}</span>
          </div>
          <div className="stat-card success">
            <span className="stat-label">Total Commission Earned</span>
            <span className="stat-value">₹{totalCommission.toLocaleString()}</span>
          </div>
          <div className={`stat-card ${totalBalance >= 0 ? 'success' : 'warning'}`}>
            <span className="stat-label">Net Balance</span>
            <span className="stat-value" style={{ color: totalBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {totalBalance >= 0 ? '+' : '-'}₹{Math.abs(totalBalance).toLocaleString()}
            </span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📒</span>
            <span className="empty-title">No payment records yet</span>
            <span className="empty-desc">Payment info you add on tasks will appear here.</span>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header">
              <span className="card-title">All Transactions</span>
              <span className="text-muted text-sm">{entries.length} task(s)</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Reg. No.', 'Task', 'Policy (₹)', 'Commission (₹)', 'Net Balance', 'Payment Link', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <>
                      <tr
                        key={e.id}
                        style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background var(--transition)' }}
                        onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                        onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-elevated)'}
                        onMouseLeave={ev => ev.currentTarget.style.background = ''}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-accent)', fontSize: 14 }}>
                          🚗 {e.tasks?.registration_no || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 14 }}>
                          <Link to={`/vendor/tasks/${e.task_id}`} onClick={ev => ev.stopPropagation()} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                            {e.tasks?.title || 'Untitled'}
                          </Link>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 14 }}>₹{Number(e.policy_amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', fontSize: 14 }}>₹{Number(e.commission_amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 700, color: e.net_balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {e.net_balance >= 0 ? '+' : ''}₹{Number(e.net_balance || 0).toLocaleString()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {e.payment_link ? (
                            <a
                              href={e.payment_link.startsWith('http') ? e.payment_link : `https://${e.payment_link}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={ev => ev.stopPropagation()}
                              className="btn btn-primary btn-sm"
                            >
                              💳 Pay Now
                            </a>
                          ) : (
                            <span className="text-muted text-sm">—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                          {expanded === e.id ? '▲' : '▼'}
                        </td>
                      </tr>
                      {expanded === e.id && (
                        <tr key={`${e.id}-tx`}>
                          <td colSpan={7} style={{ padding: '0 16px 16px 32px', background: 'var(--bg-elevated)' }}>
                            {!e.transactions?.length ? (
                              <p className="text-muted text-sm" style={{ paddingTop: 12 }}>No transactions recorded yet.</p>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                                <thead>
                                  <tr>
                                    {['Type', 'Amount', 'Notes', 'Date'].map(h => (
                                      <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {e.transactions.map(t => (
                                    <tr key={t.id}>
                                      <td style={{ padding: '6px 12px', fontSize: 13 }}>{t.transaction_type.replace(/_/g, ' ')}</td>
                                      <td style={{ padding: '6px 12px', fontSize: 13, fontWeight: 600, color: t.direction === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                                        {t.direction === 'credit' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                                      </td>
                                      <td style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-muted)' }}>{t.description || '—'}</td>
                                      <td style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
