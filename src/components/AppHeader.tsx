import { ReactNode, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useBrandLogo } from '@/lib/branding';
import headerCityFlags from '@/assets/header-city-flags.jpg';

interface AppHeaderProps {
  /** Small label shown above the title (e.g. "Bienvenido", "Sección") */
  eyebrow?: string;
  /** Main title rendered with the brand display font */
  title?: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** When true, shows a back button that navigates to `backTo` (default /dashboard) */
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
  /** Slot rendered on the right side (e.g. status pill, action button) */
  rightSlot?: ReactNode;
  /** Extra content rendered below the heading block */
  children?: ReactNode;
  /** Hide the floating Defender logo (e.g. when the page already shows it) */
  hideLogo?: boolean;
  /** Round the bottom corners (default true). Set false on full-screen flows like chat thread. */
  rounded?: boolean;
}

/**
 * AppHeader — shared dark-brand header for Defender Seguridad Privada.
 * Cinematic dark city + Mexican flag backdrop with red brand glow,
 * surfaces the brand logo (no frame) so identity stays consistent.
 */
const AppHeader = ({
  eyebrow,
  title,
  subtitle,
  showBack,
  backTo = '/dashboard',
  backLabel = 'Volver',
  rightSlot,
  children,
  hideLogo,
  rounded = true,
}: AppHeaderProps) => {
  const logoDefender = useBrandLogo();
  const navigate = useNavigate();

  const headerStyle = {
    ['--header-bg-image' as any]: `url(${headerCityFlags})`,
  } as CSSProperties;

  return (
    <div
      style={headerStyle}
      className={`text-primary-foreground px-4 pt-12 pb-6 sm:pb-8 app-header ${
        rounded ? 'rounded-b-3xl' : ''
      }`}
    >
      <div className="max-w-lg mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {showBack && (
              <button
                onClick={() => navigate(backTo)}
                className="flex items-center gap-1 text-sm opacity-80 mb-2 hover:opacity-100 transition-opacity"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{backLabel}</span>
              </button>
            )}
            {eyebrow && (
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-primary/90 mb-1">
                {eyebrow}
              </p>
            )}
            {title && (
              <h1 className="text-xl sm:text-2xl font-display font-bold uppercase tracking-wide truncate">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-primary-foreground/70 mt-1">{subtitle}</p>
            )}
          </div>

          {!hideLogo && (
            <div className="shrink-0 flex items-center">
              <img
                src={logoDefender}
                alt="Defender Seguridad Privada"
                className="w-auto object-contain drop-shadow-[0_4px_12px_hsl(0_82%_52%/0.45)]"
                style={{ height: 'clamp(2rem, 7vw, 3rem)' }}
              />
            </div>
          )}

          {rightSlot && <div className="shrink-0">{rightSlot}</div>}
        </div>

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
};

export default AppHeader;
