import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { applyBrandIcons } from '@/lib/brand-icons';
import defaultLogo from '@/assets/logo-defender.png';


/**
 * Branding — logotipo y paleta de colores configurables por el administrador.
 *
 * La fila `branding` es un singleton (id = true). Los colores se guardan como
 * cadenas HSL sin `hsl()` (formato de las variables CSS: "0 82% 52%") y el
 * logo se guarda como ruta dentro del bucket privado `branding`.
 */

export interface BrandingColors {
  primary_hsl: string;
  primary_glow_hsl: string;
  accent_hsl: string;
  background_hsl: string;
  card_hsl: string;
}

export const DEFAULT_COLORS: BrandingColors = {
  primary_hsl: '0 82% 52%',
  primary_glow_hsl: '0 88% 62%',
  accent_hsl: '0 82% 52%',
  background_hsl: '0 0% 6%',
  card_hsl: '0 0% 10%',
};

const CACHE_KEY = 'defender.branding.v1';

interface BrandingState {
  colors: BrandingColors;
  logoUrl: string;
  logoPath: string | null;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingState>({
  colors: DEFAULT_COLORS,
  logoUrl: defaultLogo,
  logoPath: null,
  refresh: async () => {},
});

/* ---------------------------------- color utils --------------------------------- */

/** "#e11d1d" -> "0 76% 50%" */
export function hexToHsl(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** "0 82% 52%" -> "#e5211f" */
export function hslToHex(hsl: string): string {
  const m = hsl.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return '#000000';
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Escoge texto legible (claro/oscuro) según la luminosidad del color base. */
function readableForeground(hsl: string): string {
  const m = hsl.match(/(\d+(?:\.\d+)?)%\s*$/);
  const l = m ? parseFloat(m[1]) : 50;
  return l > 62 ? '0 0% 8%' : '0 0% 100%';
}

/** Aplica la paleta a las variables CSS del documento. */
export function applyBrandingColors(colors: BrandingColors) {
  const root = document.documentElement;
  root.style.setProperty('--primary', colors.primary_hsl);
  root.style.setProperty('--primary-foreground', readableForeground(colors.primary_hsl));
  root.style.setProperty('--primary-glow', colors.primary_glow_hsl);
  root.style.setProperty('--accent', colors.accent_hsl);
  root.style.setProperty('--accent-foreground', readableForeground(colors.accent_hsl));
  root.style.setProperty('--ring', colors.primary_hsl);
  root.style.setProperty('--background', colors.background_hsl);
  root.style.setProperty('--card', colors.card_hsl);
  root.style.setProperty('--popover', colors.card_hsl);
  root.style.setProperty('--sidebar-primary', colors.primary_hsl);
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${colors.primary_hsl}), hsl(${colors.primary_glow_hsl}))`);
  root.style.setProperty('--gradient-brand', `linear-gradient(135deg, hsl(${colors.primary_hsl}) 0%, hsl(${colors.primary_glow_hsl}) 100%)`);
  root.style.setProperty('--shadow-brand', `0 8px 32px -8px hsl(${colors.primary_hsl} / 0.45)`);
}

/** Firma la ruta del logo dentro del bucket privado (1 año). */
export async function signLogo(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('branding').createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? null;
}

/* ---------------------------------- provider ------------------------------------ */

export function BrandingProvider({ children }: { children: ReactNode }) {
  const cached = (() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) as { colors: BrandingColors; logoUrl: string; logoPath: string | null } : null;
    } catch {
      return null;
    }
  })();

  const [colors, setColors] = useState<BrandingColors>(cached?.colors ?? DEFAULT_COLORS);
  const [logoUrl, setLogoUrl] = useState<string>(cached?.logoUrl || defaultLogo);
  const [logoPath, setLogoPath] = useState<string | null>(cached?.logoPath ?? null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('branding')
      .select('logo_url, primary_hsl, primary_glow_hsl, accent_hsl, background_hsl, card_hsl')
      .eq('id', true)
      .maybeSingle();
    if (error || !data) return;

    const next: BrandingColors = {
      primary_hsl: data.primary_hsl || DEFAULT_COLORS.primary_hsl,
      primary_glow_hsl: data.primary_glow_hsl || DEFAULT_COLORS.primary_glow_hsl,
      accent_hsl: data.accent_hsl || DEFAULT_COLORS.accent_hsl,
      background_hsl: data.background_hsl || DEFAULT_COLORS.background_hsl,
      card_hsl: data.card_hsl || DEFAULT_COLORS.card_hsl,
    };
    setColors(next);
    applyBrandingColors(next);

    let url = defaultLogo;
    const path = data.logo_url || null;
    if (path) {
      const signed = await signLogo(path);
      if (signed) url = signed;
    }
    setLogoUrl(url);
    document.documentElement.style.setProperty('--brand-logo', `url("${url}")`);
    setLogoPath(path);

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ colors: next, logoUrl: url, logoPath: path }));
    } catch {
      /* cuota llena: la caché es opcional */
    }
  }, []);

  useEffect(() => {
    applyBrandingColors(colors);
    document.documentElement.style.setProperty('--brand-logo', `url("${logoUrl}")`);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ colors, logoUrl, logoPath, refresh }), [colors, logoUrl, logoPath, refresh]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => useContext(BrandingContext);

/** Atajo para componentes que solo necesitan la imagen del logotipo. */
export const useBrandLogo = () => useContext(BrandingContext).logoUrl;
