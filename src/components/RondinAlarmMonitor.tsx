import { useRondinAlarm } from '@/hooks/use-rondin-alarm';

/** Monta las alarmas de rondín durante turno activo. No renderiza UI. */
const RondinAlarmMonitor = () => {
  useRondinAlarm();
  return null;
};

export default RondinAlarmMonitor;
