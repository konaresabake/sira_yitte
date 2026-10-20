import { statusIndex, statusLabel } from '../utils/constants';
export default function StatusBadge({ status }) {
  return <span className={`st s${statusIndex(status)}`}>{statusLabel(status)}</span>;
}
