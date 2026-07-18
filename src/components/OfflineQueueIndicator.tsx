/**
 * OfflineQueueIndicator
 * ---------------------
 * Small floating badge that appears in the bottom-right corner whenever
 * there are writes waiting to be flushed to the server. Complements
 * ConnectionBanner (which shows the network state at the top).
 */
import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';
import { subscribeOfflineQueue } from '@/lib/offline-queue';

export default function OfflineQueueIndicator() {
  const [count, setCount] = useState(0);

  useEffect(() => subscribeOfflineQueue(setCount), []);

  if (count === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[90] bg-muted text-foreground border border-border shadow-lg rounded-full px-3 py-1.5 text-xs flex items-center gap-2"
      title="Cambios pendientes que se enviarán al reconectar"
    >
      <CloudOff className="h-3.5 w-3.5" />
      <span>{count} pendiente{count === 1 ? '' : 's'} de sincronizar</span>
    </div>
  );
}
