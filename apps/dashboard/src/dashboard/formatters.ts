export function formatUsd(value: number): string {
  return `$${value.toFixed(3)}`;
}

export function formatPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
}

export function formatRelative(iso: string | null): string {
  if (iso === null) {
    return '-';
  }

  const deltaMs = Date.now() - Date.parse(iso);
  if (Number.isNaN(deltaMs)) {
    return '-';
  }

  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function formatTimestamp(iso: string | null): string {
  if (iso === null) {
    return '-';
  }

  return new Date(iso).toLocaleString();
}
