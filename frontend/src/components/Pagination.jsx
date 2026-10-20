export default function Pagination({ page, count, pageSize, onChange }) {
  const pages = Math.ceil(count / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="pager">
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button key={n} className={n === page ? 'on' : ''} onClick={() => onChange(n)} aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined}>{n}</button>
      ))}
    </div>
  );
}
