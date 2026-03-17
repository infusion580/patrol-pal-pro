import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, MapPin, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';

interface Checkpoint {
  id: string;
  nombre: string;
  ubicacion: string;
}

interface Servicio {
  id: string;
  nombre: string;
  cliente: string;
  direccion: string;
  checkpoints: Checkpoint[];
}

const Servicios = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddCheckpoint, setShowAddCheckpoint] = useState<string | null>(null);
  const [newService, setNewService] = useState({ nombre: '', cliente: '', direccion: '' });
  const [newCheckpoint, setNewCheckpoint] = useState({ nombre: '', ubicacion: '', lat: '', lng: '', radius: '50' });

  const fetchServicios = async () => {
    const { data: svcs } = await supabase.from('servicios').select('*').order('created_at', { ascending: false });
    if (!svcs) { setLoading(false); return; }

    const serviciosWithCps: Servicio[] = [];
    for (const s of svcs) {
      const { data: cps } = await supabase.from('checkpoints').select('*').eq('servicio_id', s.id).order('created_at');
      serviciosWithCps.push({
        id: s.id,
        nombre: s.nombre,
        cliente: s.cliente,
        direccion: s.direccion,
        checkpoints: (cps || []).map(c => ({ id: c.id, nombre: c.nombre, ubicacion: c.ubicacion })),
      });
    }
    setServicios(serviciosWithCps);
    setLoading(false);
  };

  useEffect(() => { fetchServicios(); }, []);

  const addService = async () => {
    if (!newService.nombre.trim()) return;
    const { error } = await supabase.from('servicios').insert({
      nombre: newService.nombre,
      cliente: newService.cliente,
      direccion: newService.direccion,
      created_by: user?.id,
    });
    if (error) { console.error(error); toast({ title: 'Error', description: 'No se pudo agregar el servicio.', variant: 'destructive' }); return; }
    setNewService({ nombre: '', cliente: '', direccion: '' });
    setShowAddService(false);
    toast({ title: 'Servicio agregado' });
    fetchServicios();
  };

  const removeService = async (id: string) => {
    await supabase.from('servicios').delete().eq('id', id);
    toast({ title: 'Servicio eliminado' });
    fetchServicios();
  };

  const addCheckpoint = async (servicioId: string) => {
    if (!newCheckpoint.nombre.trim()) return;
    if (!newCheckpoint.lat || !newCheckpoint.lng) {
      toast({ title: 'Error', description: 'Las coordenadas (lat/lng) son obligatorias.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('checkpoints').insert({
      servicio_id: servicioId,
      nombre: newCheckpoint.nombre,
      ubicacion: newCheckpoint.ubicacion,
      lat: parseFloat(newCheckpoint.lat),
      lng: parseFloat(newCheckpoint.lng),
      radius_metros: parseInt(newCheckpoint.radius) || 50,
    } as any);
    if (error) { console.error(error); toast({ title: 'Error', description: 'No se pudo agregar el punto de rondín.', variant: 'destructive' }); return; }
    setNewCheckpoint({ nombre: '', ubicacion: '', lat: '', lng: '', radius: '50' });
    setShowAddCheckpoint(null);
    toast({ title: 'Punto de rondín agregado' });
    fetchServicios();
  };

  const removeCheckpoint = async (checkpointId: string) => {
    await supabase.from('checkpoints').delete().eq('id', checkpointId);
    fetchServicios();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-display font-bold">Servicios y Puntos</h1>
              <p className="text-sm opacity-70 mt-1">Configura sitios y checkpoints de rondín</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowAddService(!showAddService)} className="gap-1">
              <Plus className="w-4 h-4" /> Nuevo
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-3">
        {showAddService && (
          <div className="bg-card rounded-xl p-4 shadow-card space-y-3 animate-slide-up">
            <h3 className="text-sm font-semibold text-foreground">Nuevo Servicio</h3>
            <div className="space-y-2">
              <Input placeholder="Nombre del servicio" value={newService.nombre} onChange={e => setNewService(p => ({ ...p, nombre: e.target.value }))} className="h-10" />
              <Input placeholder="Cliente" value={newService.cliente} onChange={e => setNewService(p => ({ ...p, cliente: e.target.value }))} className="h-10" />
              <Input placeholder="Dirección" value={newService.direccion} onChange={e => setNewService(p => ({ ...p, direccion: e.target.value }))} className="h-10" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addService} className="flex-1">Guardar</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddService(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {servicios.length === 0 && (
          <div className="bg-card rounded-xl p-8 shadow-card text-center">
            <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No hay servicios configurados</p>
            <p className="text-xs text-muted-foreground">Agrega tu primer servicio para empezar</p>
          </div>
        )}

        {servicios.map(servicio => {
          const isExpanded = expandedId === servicio.id;
          return (
            <div key={servicio.id} className="bg-card rounded-xl shadow-card overflow-hidden">
              <button onClick={() => setExpandedId(isExpanded ? null : servicio.id)} className="w-full p-4 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{servicio.nombre}</p>
                  <p className="text-xs text-muted-foreground">{servicio.cliente} • {servicio.checkpoints.length} puntos</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); removeService(servicio.id); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-emergency hover:bg-emergency/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-2 animate-slide-up">
                  <p className="text-xs text-muted-foreground">{servicio.direccion}</p>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-foreground">Puntos de Rondín</h4>
                      <button onClick={() => setShowAddCheckpoint(showAddCheckpoint === servicio.id ? null : servicio.id)} className="text-xs text-primary font-semibold flex items-center gap-0.5">
                        <Plus className="w-3 h-3" /> Agregar
                      </button>
                    </div>

                    {showAddCheckpoint === servicio.id && (
                      <div className="bg-accent rounded-lg p-3 space-y-2 mb-2">
                        <Input placeholder="Nombre del punto" value={newCheckpoint.nombre} onChange={e => setNewCheckpoint(p => ({ ...p, nombre: e.target.value }))} className="h-9 text-sm" />
                        <Input placeholder="Ubicación (descripción)" value={newCheckpoint.ubicacion} onChange={e => setNewCheckpoint(p => ({ ...p, ubicacion: e.target.value }))} className="h-9 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Latitud *" type="number" step="any" value={newCheckpoint.lat} onChange={e => setNewCheckpoint(p => ({ ...p, lat: e.target.value }))} className="h-9 text-sm" />
                          <Input placeholder="Longitud *" type="number" step="any" value={newCheckpoint.lng} onChange={e => setNewCheckpoint(p => ({ ...p, lng: e.target.value }))} className="h-9 text-sm" />
                        </div>
                        <Input placeholder="Radio permitido (metros)" type="number" value={newCheckpoint.radius} onChange={e => setNewCheckpoint(p => ({ ...p, radius: e.target.value }))} className="h-9 text-sm" />
                        <p className="text-[10px] text-muted-foreground">El guardia debe estar dentro del radio para confirmar el escaneo.</p>
                        <Button size="sm" onClick={() => addCheckpoint(servicio.id)} className="w-full h-8 text-xs">Agregar Punto</Button>
                      </div>
                    )}

                    {servicio.checkpoints.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2">Sin puntos configurados</p>
                    ) : (
                      <div className="space-y-1.5">
                        {servicio.checkpoints.map((cp, i) => (
                          <div key={cp.id} className="flex items-center gap-2 bg-accent/50 rounded-lg px-3 py-2">
                            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground">{cp.nombre}</p>
                              <p className="text-[10px] text-muted-foreground">{cp.ubicacion}</p>
                            </div>
                            <button onClick={() => removeCheckpoint(cp.id)} className="p-1 rounded text-muted-foreground hover:text-emergency transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
};

export default Servicios;
