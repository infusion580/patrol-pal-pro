import { useState } from 'react';
import { ArrowLeft, MapPin, QrCode, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import EmergencyButton from '@/components/EmergencyButton';

const checkpoints = [
  { id: 1, name: 'Entrada Principal', scanned: true, time: '10:05' },
  { id: 2, name: 'Estacionamiento A', scanned: true, time: '10:15' },
  { id: 3, name: 'Edificio Norte', scanned: false, time: null },
  { id: 4, name: 'Zona de Carga', scanned: false, time: null },
  { id: 5, name: 'Perímetro Sur', scanned: false, time: null },
];

const Rondines = () => {
  const navigate = useNavigate();
  const [checkedIn, setCheckedIn] = useState(false);
  const [points, setPoints] = useState(checkpoints);

  const handleScan = (id: number) => {
    setPoints(prev => prev.map(p =>
      p.id === id ? { ...p, scanned: true, time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) } : p
    ));
  };

  const scannedCount = points.filter(p => p.scanned).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Control de Rondines</h1>
          <p className="text-sm opacity-70 mt-1">{scannedCount}/{points.length} puntos escaneados</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* Check-in Button */}
        <div className="bg-card rounded-xl p-4 shadow-card mb-6">
          <Button
            onClick={() => setCheckedIn(!checkedIn)}
            className={`w-full h-14 text-base font-bold rounded-xl ${
              checkedIn
                ? 'bg-emergency text-emergency-foreground hover:bg-emergency/90'
                : 'bg-success text-success-foreground hover:bg-success/90'
            }`}
          >
            <MapPin className="w-5 h-5 mr-2" />
            {checkedIn ? 'Hacer Check-out' : 'Hacer Check-in'}
          </Button>
          {checkedIn && (
            <p className="text-xs text-success text-center mt-2 font-semibold">
              ✅ Check-in activo — GPS registrado
            </p>
          )}
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">Progreso del Rondín</span>
            <span className="text-sm font-bold text-primary">{Math.round((scannedCount / points.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(scannedCount / points.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Checkpoints */}
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Puntos de Control</h2>
        <div className="space-y-2">
          {points.map(point => (
            <div key={point.id} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                point.scanned ? 'bg-success/10' : 'bg-accent'
              }`}>
                {point.scanned ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <QrCode className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${point.scanned ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {point.name}
                </p>
                {point.time && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {point.time}
                  </p>
                )}
              </div>
              {!point.scanned && (
                <Button size="sm" onClick={() => handleScan(point.id)} className="text-xs h-8">
                  Escanear
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <EmergencyButton />
      <BottomNav />
    </div>
  );
};

export default Rondines;
