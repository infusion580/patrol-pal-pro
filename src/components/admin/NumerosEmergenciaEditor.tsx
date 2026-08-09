/**
 * Editor administrativo de los números de llamada directa que aparecen en el
 * panel de emergencia. Los números viven en la tabla `numeros_emergencia`, por
 * lo que pueden variar por estado/plaza y el cambio aplica a todos al instante.
 * Solo el rol admin puede crear, editar o eliminar (RLS lo garantiza).
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Phone, Plus, Save, Trash2 } from 'lucide-react';

export interface NumeroEmergencia {
  id: string;
  label: string;
  descripcion: string;
  numero: string;
  orden: number;
  activo: boolean;
}

/** Deja solo dígitos, `+` y `#` (válidos en un enlace `tel:`). */
export const limpiarTelefono = (v: string) => v.replace(/[^\d+#*]/g, '');

const NumerosEmergenciaEditor = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<NumeroEmergencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const cargar = async () => {
    const { data } = await supabase
      .from('numeros_emergencia')
      .select('*')
      .order('orden', { ascending: true });
    setItems((data as NumeroEmergencia[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const actualizarLocal = (id: string, campos: Partial<NumeroEmergencia>) =>
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...campos } : i)));

  const guardar = async (item: NumeroEmergencia) => {
    const numero = limpiarTelefono(item.numero);
    if (!item.label.trim() || numero.length < 3) {
      toast({
        title: 'Datos incompletos',
        description: 'Escribe una etiqueta y un número válido.',
        variant: 'destructive',
      });
      return;
    }
    setSavingId(item.id);
    const { error } = await supabase
      .from('numeros_emergencia')
      .update({
        label: item.label.trim(),
        descripcion: item.descripcion.trim(),
        numero,
        activo: item.activo,
      })
      .eq('id', item.id);
    setSavingId(null);
    if (error) {
      toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Número actualizado', description: `${item.label} · ${numero}` });
    cargar();
  };

  const agregar = async () => {
    const { error } = await supabase.from('numeros_emergencia').insert({
      label: 'Nuevo',
      descripcion: 'Descripción',
      numero: '911',
      orden: items.length + 1,
    });
    if (error) {
      toast({ title: 'No se pudo agregar', description: error.message, variant: 'destructive' });
      return;
    }
    cargar();
  };

  const eliminar = async (id: string) => {
    const { error } = await supabase.from('numeros_emergencia').delete().eq('id', id);
    if (error) {
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' });
      return;
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <Card className="p-4 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" aria-hidden="true" />
            Números de llamada directa
          </h2>
          <p className="text-xs text-muted-foreground">
            Aparecen en el panel de emergencia. Puedes ajustarlos según el estado o la plaza.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={agregar}>
          <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
          Agregar
        </Button>
      </header>

      {loading && <p className="text-xs text-muted-foreground">Cargando…</p>}

      {!loading && items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No hay números configurados. Agrega al menos uno.
        </p>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="rounded-xl border border-border p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                aria-label="Etiqueta"
                value={item.label}
                maxLength={20}
                onChange={e => actualizarLocal(item.id, { label: e.target.value })}
                placeholder="911"
                className="h-11"
              />
              <Input
                aria-label="Descripción"
                value={item.descripcion}
                maxLength={40}
                onChange={e => actualizarLocal(item.id, { descripcion: e.target.value })}
                placeholder="Emergencias"
                className="h-11"
              />
              <Input
                aria-label="Número telefónico"
                inputMode="tel"
                value={item.numero}
                maxLength={20}
                onChange={e => actualizarLocal(item.id, { numero: e.target.value })}
                placeholder="911"
                className="h-11"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => guardar(item)}
                disabled={savingId === item.id}
                className="h-10"
              >
                <Save className="w-4 h-4 mr-1" aria-hidden="true" />
                {savingId === item.id ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                size="sm"
                variant={item.activo ? 'outline' : 'secondary'}
                className="h-10"
                onClick={() => guardar({ ...item, activo: !item.activo })}
              >
                {item.activo ? 'Visible' : 'Oculto'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-10 text-destructive"
                onClick={() => eliminar(item.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" aria-hidden="true" />
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default NumerosEmergenciaEditor;
