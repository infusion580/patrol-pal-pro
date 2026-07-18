/**
 * ConnectionBanner
 * ----------------
 * Sticky banner shown at the top of the app when the browser loses
 * connectivity. Displays a brief "conexión restablecida" toast once
 * traffic resumes, and triggers a global react-query refetch so any
 * open screen re-syncs immediately.
 *
 * Rendered once at the root (see App.tsx). Non-blocking, does not
 * interfere with routes or forms.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status";

export default function ConnectionBanner() {
  const { online } = useOnlineStatus();
  const qc = useQueryClient();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("Conexión restablecida", {
        description: "Sincronizando datos…",
        duration: 2500,
      });
      // Refresh every active query so the UI reflects server state.
      qc.invalidateQueries();
    }
  }, [online, qc]);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[100] bg-destructive text-destructive-foreground text-sm font-medium py-2 px-4 flex items-center justify-center gap-2 shadow-md"
    >
      <WifiOff className="h-4 w-4" />
      <span>Sin conexión — reintentando automáticamente…</span>
    </div>
  );
}
