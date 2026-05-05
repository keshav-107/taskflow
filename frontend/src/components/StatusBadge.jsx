export default function StatusBadge({ status }) {
  const labels = {
    pending:     'Pending',
    in_progress: 'In Progress',
    submitted:   'Submitted',
    completed:   'Completed',
    rejected:    'Rejected',
  };
  return (
    <span className={`badge badge-${status}`}>
      <span className="badge-dot" />
      {labels[status] || status}
    </span>
  );
}
