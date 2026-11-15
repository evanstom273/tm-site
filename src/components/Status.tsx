export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {message}
    </div>
  );
}

export function Loading() {
  return <p className="text-sm text-zinc-500">Loading…</p>;
}

export function OfflineNote() {
  return <p className="text-xs text-amber-700 dark:text-amber-400">Offline: showing the copy saved on this device.</p>;
}
