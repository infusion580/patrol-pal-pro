import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import logoDefender from '@/assets/logo-defender.png';

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
 * Uses the .app-header utility (dark base + red glow) and surfaces the
 * brand logo so the identity is consistent across the whole app.
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
  const navigate = useNavigate();

  return (
    <div
      className={`text-primary-foreground px-4 pt-12 pb-6 app-header ${
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/90 mb-1">
                {eyebrow}
              </p>
            )}
            {title && (
              <h1 className="text-2xl font-display font-bold uppercase tracking-wide truncate">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm text-primary-foreground/70 mt-1">{subtitle}</p>
            )}
          </div>

          {!hideLogo && (
            <div className="shrink-0 bg-foreground/95 rounded-xl p-2 shadow-brand">
              <img
                src={logoDefender}
                alt="Defender Seguridad Privada"
                className="h-8 w-auto"
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
