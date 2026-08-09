/**
 * Módulo de administración del canal de soporte.
 *
 * Permite al administrador actualizar el número de WhatsApp al que llegan los
 * reportes de falla enviados desde el botón de ayuda visible en toda la app.
 * El número se guarda en la tabla `branding`, por lo que el cambio aplica a
 * todos los usuarios de inmediato.
 */

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { HelpCircle, Phone, Save, ExternalLink } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import NumerosEmergenciaEditor from '@/components/admin/NumerosEmergenciaEditor';
import BottomNav from '@/components/BottomNav';
import {
  fetchSoporteWhatsapp,
  setSoporteWhatsapp,
  formatSoporteWhatsapp,
  normalizarNumero,
  construirEnlaceWhatsapp,
} from '@/lib/soporte-config';

const SoporteConfig = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [numero, setNumero] = useState('');
  const [actual, setActual] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let activo = true;
    fetchSoporteWhatsapp().then(n => {
      if (!activo) return;
      setActual(n);
      setNumero(n);
      setLoading(false);
    });
    return () => {
      activo = false;
    };
  }, []);

  if (authLoading) return null;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  const normalizado = normalizarNumero(numero);
  const valido = normalizado.length >= 11;
  const cambiado = normalizado !== actual;

  const guardar = async () => {
    if (!valido) {
      toast({
        title: 'Número inválido',
        description: 'Escribe 10 dígitos (México) o el número completo con LADA de país.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const guardado = await setSoporteWhatsapp(normalizado);
      setActual(guardado);
      setNumero(guardado);
      toast({ title: 'Número actualizado', description: formatSoporteWhatsapp(guardado) });
    } catch {
      toast({
        title: 'No se pudo guardar',
        description: 'Verifica tu conexión e inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />

      <main className="p-4 space-y-4 max-w-2xl mx-auto">
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Soporte y reporte de fallas</h1>
            <p className="text-xs text-muted-foreground">
              Canal de reportes de falla y números de llamada directa de emergencia.
            </p>
          </div>
        </header>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>
              Número vigente:{' '}
              <strong className="text-foreground">
                {loading ? 'Cargando…' : formatSoporteWhatsapp(actual)}
              </strong>
            </span>
          </div>

          <div className="space-y-2">
            <label htmlFor="soporte-numero" className="text-sm font-semibold text-foreground">
              Nuevo número de soporte
            </label>
            <Input
              id="soporte-numero"
              inputMode="tel"
              value={numero}
              onChange={e => setNumero(e.target.value)}
              placeholder="4426356998"
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground">
              Si escribes 10 dígitos se agrega automáticamente la LADA de México (52).
              {valido && <> Se guardará como <strong>{formatSoporteWhatsapp(normalizado)}</strong>.</>}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={guardar}
              disabled={!valido || !cambiado || saving || loading}
              className="h-12 flex-1"
            >
              <Save className="w-4 h-4 mr-2" aria-hidden="true" />
              {saving ? 'Guardando…' : 'Guardar número'}
            </Button>
            <Button
              variant="outline"
              className="h-12 flex-1"
              disabled={!valido}
              onClick={() =>
                window.open(
                  construirEnlaceWhatsapp(normalizado, 'Prueba de canal de soporte · Defender'),
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            >
              <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
              Probar envío
            </Button>
          </div>
        </Card>

        <NumerosEmergenciaEditor />

        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-bold text-foreground">Cómo funciona</h2>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>El botón de ayuda aparece flotante en todas las pantallas de la app.</li>
            <li>
              El usuario elige el tipo de falla, la describe y se abre WhatsApp con el usuario,
              rol, pantalla, dispositivo y fecha ya incluidos.
            </li>
            <li>Solo el administrador puede cambiar este número; aplica para todos al instante.</li>
            <li>
              Los números de llamada directa del panel de emergencia también se editan aquí y se
              actualizan para todos los usuarios.
            </li>
          </ul>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default SoporteConfig;
