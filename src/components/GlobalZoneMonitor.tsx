import { useGlobalZoneMonitor } from '@/hooks/use-global-zone-monitor';

/** Monta el monitoreo GPS global de zona durante turno activo. No renderiza UI. */
const GlobalZoneMonitor = () => {
  useGlobalZoneMonitor();
  return null;
};

export default GlobalZoneMonitor;
