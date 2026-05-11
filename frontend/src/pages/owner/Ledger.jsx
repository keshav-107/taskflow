import { useEffect, useState } from 'react';
import { getLedger } from '../../api/payments';
import StatusBadge from '../../components/StatusBadge';
import HamburgerBtn from '../../components/HamburgerBtn';

const STATUS_COLORS = {
  pending: 'var(--warning)',
  owner_paid: 'var(--success)',
  vendor_paid: 'var(--text-accent)',
  settled: 'var(--text-muted)',
};

export default function Ledger() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getLedger().then(setEntries).finally(() => setLoading(false));
  }, []);

  const totalPolicy = entries.reduce((s, e) => s + (Number(e.policy_amount) || 0), 0);
  const totalCommission = entries.reduce((s, e) => s + (Number(e.commission_amount) || 0), 0);
  const totalBalance = entries.reduce((s, e) => s + (Number(e.net_balance) || 0), 0);

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
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>💰 Payment Ledger</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Full financial record across all tasks</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Summary cards */}
        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <span className="stat-label">Total Policy</span>
            <span className="stat-value">₹{totalPolicy.toLocaleString()}</span>
          </div>
          <div className="stat-card success">
            <span className="stat-label">Total Commission</span>
            <span className="stat-value">₹{totalCommission.toLocaleString()}</span>
          </div>
          <div className="stat-card warning">
            <span className="stat-label">Net Balance Received</span>
            <span className="stat-value">₹{totalBalance.toLocaleString()}</span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📒</span>
            <span className="empty-title">No payment records yet</span>
            <span className="empty-desc">Payments will appear here once vendors add payment details on tasks.</span>
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
                    {['Reg. No.', 'Task', 'Policy (₹)', 'Commission (₹)', 'Net Balance', 'Status', ''].map(h => (
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
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-accent)', fontSize: 14 }}>{e.tasks?.registration_no || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 14 }}>{e.tasks?.title || 'Untitled Task'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 14 }}>₹{Number(e.policy_amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', fontSize: 14 }}>₹{Number(e.commission_amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 700, color: e.net_balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {e.net_balance >= 0 ? '+' : '-'}₹{Math.abs(e.net_balance || 0).toLocaleString()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: 'var(--bg-elevated)', color: STATUS_COLORS[e.status] || 'var(--text-muted)' }}>
                            {(e.status || 'pending').replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{expanded === e.id ? '▲' : '▼'}</td>
                      </tr>
                      {expanded === e.id && (
                        <tr key={`${e.id}-expanded`}>
                          <td colSpan={7} style={{ padding: '0 16px 16px 32px', background: 'var(--bg-elevated)' }}>
                            {e.transactions?.length === 0 ? (
                              <p className="text-muted text-sm" style={{ paddingTop: 12 }}>No transactions recorded yet.</p>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                                <thead>
                                  <tr>
                                    {['Type', 'Amount', 'Direction', 'Notes', 'Date'].map(h => (
                                      <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {e.transactions.map(t => (
                                    <tr key={t.id}>
                                      <td style={{ padding: '6px 12px', fontSize: 13 }}>{t.transaction_type.replace(/_/g, ' ')}</td>
                                      <td style={{ padding: '6px 12px', fontSize: 13, fontWeight: 600, color: t.direction === 'credit' ? 'var(--success)' : 'var(--warning)' }}>
                                        {t.direction === 'credit' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                                      </td>
                                      <td style={{ padding: '6px 12px', fontSize: 13 }}>{t.direction}</td>
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
