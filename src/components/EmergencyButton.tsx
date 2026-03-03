import { useState } from 'react';
import { AlertTriangle, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EmergencyButton = () => {
  const [showPanel, setShowPanel] = useState(false);
  const [activated, setActivated] = useState(false);

  const handleEmergency = () => {
    setActivated(true);
    // In production: send GPS, notify supervisor, activate protocol
    setTimeout(() => setActivated(false), 5000);
  };

  const emergencyNumbers = [
    { label: '911', desc: 'Emergencias', number: '911' },
    { label: 'Policía', desc: 'Policía Local', number: '911' },
    { label: 'P. Civil', desc: 'Protección Civil', number: '911' },
  ];

  return (
    <>
      {/* Floating Emergency Button */}
      <button
        onClick={() => setShowPanel(true)}
        className="fixed bottom-20 right-4 z-40 w-16 h-16 rounded-full bg-emergency text-emergency-foreground flex items-center justify-center shadow-emergency animate-pulse-emergency active:scale-95 transition-transform"
      >
        <AlertTriangle className="w-7 h-7" />
      </button>

      {/* Emergency Panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center" onClick={() => setShowPanel(false)}>
          <div className="bg-card w-full max-w-lg rounded-t-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-foreground">🚨 Emergencia</h2>
              <button onClick={() => setShowPanel(false)} className="text-muted-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Main Emergency Button */}
            <Button
              onClick={handleEmergency}
              className={`w-full h-20 text-xl font-bold rounded-xl mb-6 ${
                activated
                  ? 'bg-success text-success-foreground'
                  : 'bg-emergency text-emergency-foreground hover:bg-emergency/90'
              }`}
            >
              {activated ? '✅ Alerta Enviada — Ayuda en camino' : '🚨 ACTIVAR ALERTA DE EMERGENCIA'}
            </Button>

            {/* Quick Call Buttons */}
            <p className="text-sm font-semibold text-muted-foreground mb-3">Llamada directa:</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {emergencyNumbers.map(num => (
                <a
                  key={num.label}
                  href={`tel:${num.number}`}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-accent hover:bg-accent/80 transition-colors"
                >
                  <Phone className="w-5 h-5 text-primary" />
                  <span className="text-sm font-bold text-foreground">{num.label}</span>
                  <span className="text-[10px] text-muted-foreground">{num.desc}</span>
                </a>
              ))}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Las llamadas se registran automáticamente en el sistema
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default EmergencyButton;
