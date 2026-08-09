/**
 * Estilos compartidos para los correos de autenticación de Defender.
 * Derivados de la identidad visual de la app (src/index.css):
 *   --primary: 0 82% 52%  |  --radius: 0.875rem
 * Nota: el fondo del <Body> siempre es blanco para máxima compatibilidad
 * con clientes de correo, aunque la app use tema oscuro.
 */

export const BRAND = {
  primary: 'hsl(0, 82%, 52%)',
  primaryForeground: '#ffffff',
  foreground: '#14161a',
  muted: '#5b5f66',
  subtle: '#9aa0a6',
  border: '#e6e8eb',
  surface: '#f7f8f9',
  radius: '14px',
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
}

export const main = {
  backgroundColor: '#ffffff',
  fontFamily: BRAND.font,
  margin: '0',
  padding: '0',
}

export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px 40px',
}

export const brandBar = {
  borderTop: `4px solid ${BRAND.primary}`,
  borderRadius: '4px',
  margin: '0 0 24px',
}

export const brandName = {
  fontSize: '20px',
  fontWeight: 700 as const,
  letterSpacing: '2px',
  color: BRAND.primary,
  textTransform: 'uppercase' as const,
  margin: '0 0 4px',
}

export const brandTagline = {
  fontSize: '12px',
  color: BRAND.subtle,
  margin: '0 0 28px',
}

export const h1 = {
  fontSize: '22px',
  fontWeight: 700 as const,
  color: BRAND.foreground,
  lineHeight: '1.3',
  margin: '0 0 16px',
}

export const text = {
  fontSize: '15px',
  color: BRAND.muted,
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const button = {
  display: 'inline-block',
  backgroundColor: BRAND.primary,
  color: BRAND.primaryForeground,
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: BRAND.radius,
  padding: '14px 28px',
  textDecoration: 'none',
}

export const linkFallback = {
  fontSize: '12px',
  color: BRAND.subtle,
  wordBreak: 'break-all' as const,
  lineHeight: '1.5',
  margin: '20px 0 0',
}

export const codeBox = {
  backgroundColor: BRAND.surface,
  border: `1px solid ${BRAND.border}`,
  borderRadius: BRAND.radius,
  padding: '18px',
  textAlign: 'center' as const,
  fontSize: '30px',
  fontWeight: 700 as const,
  letterSpacing: '8px',
  color: BRAND.foreground,
  margin: '0 0 20px',
}

export const infoBox = {
  backgroundColor: BRAND.surface,
  border: `1px solid ${BRAND.border}`,
  borderRadius: BRAND.radius,
  padding: '16px 18px',
  fontSize: '14px',
  color: BRAND.foreground,
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const hr = {
  border: 'none',
  borderTop: `1px solid ${BRAND.border}`,
  margin: '32px 0 20px',
}

export const footer = {
  fontSize: '12px',
  color: BRAND.subtle,
  lineHeight: '1.6',
  margin: '0 0 6px',
}
