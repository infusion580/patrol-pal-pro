import { useEffect, useRef, useState } from 'react';
import { Upload, RotateCcw, Save, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { compressImage } from '@/lib/image-compress';
import {
  BrandingColors,
  DEFAULT_COLORS,
  applyBrandingColors,
  hexToHsl,
  hslToHex,
  signLogo,
  useBranding,
} from '@/lib/branding';

/** Paletas listas para aplicar con un clic. */
const PRESETS: { name: string; colors: BrandingColors }[] = [
  { name: 'Defender (rojo)', colors: DEFAULT_COLORS },
  {
    name: 'Azul corporativo',
    colors: { primary_hsl: '214 90% 52%', primary_glow_hsl: '210 95% 64%', accent_hsl: '214 90% 52%', background_hsl: '220 24% 8%', card_hsl: '220 20% 13%' },
  },
  {
    name: 'Verde operativo',
    colors: { primary_hsl: '152 62% 42%', primary_glow_hsl: '150 66% 52%', accent_hsl: '152 62% 42%', background_hsl: '160 18% 7%', card_hsl: '160 14% 12%' },
  },
  {
    name: 'Ámbar nocturno',
    colors: { primary_hsl: '35 95% 55%', primary_glow_hsl: '42 96% 62%', accent_hsl: '35 95% 55%', background_hsl: '30 12% 7%', card_hsl: '30 10% 12%' },
  },
  {
    name: 'Claro institucional',
    colors: { primary_hsl: '222 72% 44%', primary_glow_hsl: '222 80% 58%', accent_hsl: '222 72% 44%', background_hsl: '210 30% 97%', card_hsl: '0 0% 100%' },
  },
];

const FIELDS: { key: keyof BrandingColors; label: string; help: string }[] = [
  { key: 'primary_hsl', label: 'Color principal', help: 'Botones, íconos y acentos de marca' },
  { key: 'primary_glow_hsl', label: 'Brillo del principal', help: 'Degradados y resplandor' },
  { key: 'accent_hsl', label: 'Color de acento', help: 'Fondos de íconos y destacados' },
  { key: 'background_hsl', label: 'Fondo de la app', help: 'Color base de todas las pantallas' },
  { key: 'card_hsl', label: 'Tarjetas', help: 'Fondo de tarjetas y ventanas' },
];

/**
 * Identidad — pantalla de administrador para cambiar el logotipo
 * y la paleta de colores de toda la aplicación.
 */
const Branding = () => {
  const { colors, logoUrl, refresh } = useBranding();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<BrandingColors>(colors);
  const [preview, setPreview] = useState<string>(logoUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setDraft(colors), [colors]);
  useEffect(() => setPreview(logoUrl), [logoUrl]);

  // Vista previa en vivo mientras el admin ajusta los colores.
  useEffect(() => {
    applyBrandingColors(draft);
  }, [draft]);

  const setColor = (key: keyof BrandingColors, hex: string) =>
    setDraft(prev => ({ ...prev, [key]: hexToHsl(hex) }));

  const handleLogo = async (file: File) => {
    setUploading(true);
    try {
      const blob = await compressImage(file, { maxSide: 600, quality: 0.9 });
      const ext = file.name.split('.').pop()?.toLowerCase() === 'png' ? 'png' : 'jpg';
      const path = `logo-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('branding')
        .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from('branding')
        .update({ logo_url: path, updated_at: new Date().toISOString() })
        .eq('id', true);
      if (dbErr) throw dbErr;

      const signed = await signLogo(path);
      if (signed) setPreview(signed);
      await refresh();
      toast({ title: 'Logotipo actualizado', description: 'Ya se muestra en toda la aplicación.' });
    } catch (e: any) {
      toast({ title: 'No se pudo subir el logotipo', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('branding')
      .update({ ...draft, updated_at: new Date().toISOString() })
      .eq('id', true);
    setSaving(false);
    if (error) {
      toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' });
      return;
    }
    await refresh();
    toast({ title: 'Paleta guardada', description: 'Los colores se aplicaron para todos los usuarios.' });
  };

  const resetDefaults = () => setDraft(DEFAULT_COLORS);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <AppHeader
        eyebrow="Administración"
        title="Identidad"
        subtitle="Logotipo y paleta de colores"
        showBack
        backTo="/dashboard"
      />

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        {/* Logotipo */}
        <section className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Logotipo</h2>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl bg-secondary flex items-center justify-center overflow-hidden shrink-0">
              <img src={preview} alt="Logotipo actual" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">
                PNG o JPG. Se optimiza automáticamente (máx. 600 px).
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleLogo(f);
                  e.target.value = '';
                }}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full" aria-label="Subir logotipo">
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Subiendo…' : 'Cambiar logotipo'}
              </Button>
            </div>
          </div>
        </section>

        {/* Paletas rápidas */}
        <section className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" aria-hidden="true" /> Paletas rápidas
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {PRESETS.map(p => (
              <button
                key={p.name}
                onClick={() => setDraft(p.colors)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Aplicar paleta ${p.name}`}
              >
                <span className="text-xs font-semibold text-foreground">{p.name}</span>
                <span className="flex gap-1">
                  {Object.values(p.colors).map((c, i) => (
                    <span key={i} className="w-5 h-5 rounded-full border border-border" style={{ background: `hsl(${c})` }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Colores individuales */}
        <section className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Colores personalizados</h2>
          {FIELDS.map(f => (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{f.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{f.help}</p>
              </div>
              <input
                type="color"
                aria-label={f.label}
                value={hslToHex(draft[f.key])}
                onChange={e => setColor(f.key, e.target.value)}
                className="w-12 h-10 rounded-lg bg-transparent border border-border cursor-pointer shrink-0"
              />
            </div>
          ))}
        </section>

        <div className="flex gap-2">
          <Button variant="outline" onClick={resetDefaults} className="flex-1" aria-label="Restaurar colores predeterminados">
            <RotateCcw className="w-4 h-4 mr-2" /> Restaurar
          </Button>
          <Button onClick={save} disabled={saving} className="flex-1" aria-label="Guardar paleta">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Branding;
