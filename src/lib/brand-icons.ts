/**
 * Iconos de marca (favicon / pestaña / PWA) generados a partir del logotipo
 * que el administrador sube en /identidad.
 *
 * Se dibuja el logo centrado sobre un lienzo cuadrado del color de la app y
 * se generan PNGs en varios tamaños que reemplazan en caliente:
 *  - <link rel="icon">            → icono de la pestaña del navegador
 *  - <link rel="apple-touch-icon"> → icono al añadir a pantalla de inicio (iOS)
 *  - <link rel="manifest">         → iconos de la PWA instalada
 */

const SIZES = [32, 180, 192, 512] as const;

function setLink(rel: string, href: string, extra: Record<string, string> = {}) {
  const selector = `link[rel="${rel}"][data-brand="1"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    // Elimina los estáticos del index.html para que no compitan.
    document.head.querySelectorAll(`link[rel="${rel}"]`).forEach(n => n.remove());
    el = document.createElement('link');
    el.rel = rel;
    el.dataset.brand = '1';
    document.head.appendChild(el);
  }
  Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
  el.href = href;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Dibuja el logo centrado con margen dentro de un cuadrado `size`. */
function render(img: HTMLImageElement, size: number, bg: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  const pad = size * 0.1;
  const box = size - pad * 2;
  const scale = Math.min(box / img.width, box / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL('image/png');
}

let manifestUrl: string | null = null;

/**
 * Regenera y aplica todos los iconos. Si el lienzo falla (CORS), cae de vuelta
 * a usar la imagen original tal cual como favicon.
 */
export async function applyBrandIcons(logoUrl: string, backgroundHsl: string) {
  const bg = `hsl(${backgroundHsl})`;
  let icons: Record<number, string> = {};

  try {
    const img = await loadImage(logoUrl);
    for (const s of SIZES) {
      const url = render(img, s, bg);
      if (url) icons[s] = url;
    }
  } catch {
    icons = {};
  }

  const favicon = icons[32] || logoUrl;
  setLink('icon', favicon, { type: 'image/png' });
  setLink('shortcut icon', favicon, { type: 'image/png' });
  setLink('apple-touch-icon', icons[180] || logoUrl);

  // Manifest dinámico para que la PWA instalada use el logo del cliente.
  try {
    const base = document.querySelector<HTMLLinkElement>('link[rel="manifest"]:not([data-brand])');
    let manifest: any = {};
    if (base?.href) {
      manifest = await fetch(base.href).then(r => r.json()).catch(() => ({}));
    }
    manifest.icons = [
      { src: icons[192] || logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icons[512] || logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icons[512] || logoUrl, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ];
    manifest.background_color = bg;
    manifest.theme_color = bg;

    if (manifestUrl) URL.revokeObjectURL(manifestUrl);
    manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
    setLink('manifest', manifestUrl);
  } catch {
    /* el manifest estático sigue siendo válido */
  }

  const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (theme) theme.content = bg;
}
