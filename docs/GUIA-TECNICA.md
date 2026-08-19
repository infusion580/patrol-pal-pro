# Guía técnica de Defender (SecureOps)

> Documento de mantenimiento. Describe **cómo está implementado realmente** el sistema
> (código en `src/`, funciones en `supabase/functions/`, esquema en Lovable Cloud/Postgres).
> Cada funcionalidad incluye su **mapa de modificación**: archivo → componente/función → tabla → lógica.

## 0. Panorama del proyecto

| Capa | Tecnología | Ubicación |
| --- | --- | --- |
| UI | React 18 + Vite 5 + TypeScript + Tailwind + shadcn/ui | `src/` |
| Estado remoto | `@tanstack/react-query` (config global en `src/App.tsx`) | `src/App.tsx` |
| Ruteo | `react-router-dom` con `ProtectedRoute` por rol | `src/App.tsx`, `src/components/ProtectedRoute.tsx` |
| Backend | Postgres + RLS + Auth + Storage + Realtime (Lovable Cloud) | `src/integrations/supabase/client.ts` |
| Lógica de servidor | Edge Functions Deno | `supabase/functions/*` |
| Tareas programadas | `pg_cron` + `pg_net` | ver §7 |
| Mapas | Leaflet + OpenStreetMap (carga diferida, sin wrappers) | `src/components/MapView.tsx` |

### Proveedores globales y componentes siempre montados (`src/App.tsx`)

`QueryClientProvider` → `TooltipProvider` → `BrandingProvider` → `AuthProvider` → `BrowserRouter`.

Montados fuera de las rutas (aplican en toda la app):

| Componente | Función |
| --- | --- |
| `ConnectionBanner` | Aviso de pérdida/retorno de conexión |
| `OfflineQueueIndicator` | Estado de la cola de escrituras y fotos pendientes |
| `GlobalZoneMonitor` | Vigilancia de geocerca en cualquier pantalla |
| `GlobalAlertSound` | Sonido al llegar cualquier alerta |
| `RondinAlarmMonitor` | Pantalla bloqueante de alarma de rondín (3 min) |
| `SoporteChat` | Botón flotante de soporte por WhatsApp |
| `SessionCaptureGate` | Exige foto en vivo al iniciar/cerrar sesión |
| `ValidacionPuestoGate` | Exige foto + GPS en el horario programado |

Inicializadores ejecutados al cargar el bundle: `initOfflineQueue()`, `initPhotoQueue()`,
`initErrorMonitor()`, `initRealtimeManager()`.

### Mapa de rutas y permisos (fuente de verdad: `src/App.tsx`)

| Ruta | Pantalla | Roles permitidos |
| --- | --- | --- |
| `/login`, `/registro`, `/forgot-password`, `/reset-password` | Login, Register, ForgotPassword, ResetPassword | público |
| `/.lovable/oauth/consent` | OAuthConsent | público |
| `/dashboard` | Dashboard (redirige por rol) | cualquier autenticado |
| `/perfil` | Perfil | cualquier autenticado |
| `/notificaciones` | Notificaciones | cualquier autenticado |
| `/comunicados` | Comunicados | cualquier autenticado |
| `/rondines` | Rondines | guardia, supervisor, admin |
| `/reportes` | ReporteNovedades | guardia, supervisor, admin |
| `/chat` | Chat | guardia, supervisor, admin |
| `/chat-rh` | ChatRH | guardia, supervisor, admin |
| `/historial` | Historial | guardia, supervisor, admin |
| `/actividad-guardia` | GuardActivityPage | guardia, supervisor, admin |
| `/cuadro-honor` | CuadroHonor | guardia, supervisor, admin |
| `/visitas` | Visitas | guardia, supervisor, admin |
| `/prestamos` | Prestamos | guardia, supervisor, admin |
| `/pendientes` | PendientesPuesto | supervisor, admin |
| `/mapa` | MapaSupervisor | supervisor, admin |
| `/metricas` | Metricas | supervisor, admin |
| `/novedades` | NovedadesReportes | supervisor, admin |
| `/reconocimientos` | Reconocimientos | supervisor, admin |
| `/alarmas-rondin` | AlarmasRondin | supervisor, admin |
| `/validacion-puesto` | ValidacionPuesto | supervisor, admin |
| `/registros-sesion` | RegistrosSesion | supervisor, admin |
| `/reportes-supervisor` | ReportesSupervisor | supervisor, admin |
| `/dashboard-operativo` | DashboardOperativo | supervisor, admin |
| `/gestion-rh` | GestionRH | supervisor, admin |
| `/metas` | MetasServicio | supervisor, admin |
| `/reporte-asistencias` | ReporteAsistencias | supervisor, admin |
| `/servicios` | Servicios | admin |
| `/estadisticas` | EstadisticasAdmin | admin |
| `/nips` | RegistrationNips | admin |
| `/auditoria` | AuditLog | admin |
| `/identidad` | Branding | admin |
| `/soporte-config` | SoporteConfig | admin |
| `/cliente-reporte-config` | ClienteReporteConfig | admin |

> El rol `cliente` solo alcanza `/dashboard`, `/perfil`, `/notificaciones` y `/comunicados`;
> el resto de rutas operativas lo excluyen explícitamente.
## 1. Autenticación, sesión y perfil

### Login (inicio de sesión)
- **Qué hace:** Autentica al usuario contra Supabase Auth con email/contraseña; tras validar la sesión, reclama la sesión activa (single-session), dispara notificación de inicio, marca pendiente de captura fotográfica (solo guardias) y registra evento en auditoría; redirige a `/dashboard` o a `next` si viene en la query string (solo rutas relativas).
- **Quién puede usarla:** Ruta pública, cualquier visitante no autenticado. Si ya hay sesión, se redirige automáticamente.
- **Dónde está en la interfaz:** `/login` — pantalla inicial (`/` redirige aquí). Enlaces desde `/registro` y `/forgot-password` regresan aquí.
- **Archivos:** `src/pages/Login.tsx`, `src/lib/auth-context.tsx`, `src/App.tsx`.
- **Componentes:** `Login`, `Button`, `Input`, `Label`.
- **Funciones/hooks:** `useAuth().login()`, `useBrandLogo()`, `useToast()`, efecto que navega tras `isAuthenticated`.
- **Tablas:** `profiles`, `user_roles` (lectura de perfil vía `fetchUserProfile`).
- **Campos:** `profiles.*`, `user_roles.role`, `profiles.active_session_id`.
- **Servicios/endpoints:** `supabase.auth.signInWithPassword`; internamente dispara `marcarCapturaLoginPendiente`, `notifySesionInicio`, `logAudit` (RPC `log_audit_event`).
- **Seguridad/RLS:** Sin `ProtectedRoute` (pública). RLS de `profiles`/`user_roles`: usuario ve su propio registro (`auth.uid() = user_id`), admin/supervisor ven todos.
- **Depende de / de quién depende:** Depende de `auth-context.tsx` (login/claimActiveSession) y de `branding.tsx` (logo). De él dependen `ProtectedRoute`, `SessionCaptureGate` (captura post-login) y todo el resto de la app.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/Login.tsx → handleSubmit` → `src/lib/auth-context.tsx → login()` → `auth.users` (Supabase Auth) / `profiles`, `user_roles` → lógica de reclamo de sesión y disparo de foto/notificación/auditoría.
- **Consideraciones:** Traduce errores técnicos a mensajes en español (email no confirmado, rate limit, red). El `useEffect` evita condición de carrera esperando a que cargue el perfil antes de navegar.

### Registro con NIP
- **Qué hace:** Crea una cuenta nueva validando primero un código NIP (sin consumirlo) vía RPC, crea el usuario en Supabase Auth (el trigger `handle_new_user` asigna rol `guardia` por defecto), inicia sesión y consume el NIP vía RPC para asignar el rol definitivo. Si falla el consumo (carrera), invoca la edge function `cleanup-orphan-user` para eliminar la cuenta huérfana.
- **Quién puede usarla:** Público (no autenticado); requiere un NIP válido generado previamente por un admin.
- **Dónde está en la interfaz:** `/registro`, enlazado desde `/login` ("¿No tienes cuenta? Regístrate").
- **Archivos:** `src/pages/Register.tsx`, `src/lib/auth-context.tsx` (método `register`), `supabase/functions/cleanup-orphan-user/index.ts`.
- **Componentes:** `Register`, `Input`, `Button`, selector de rol (informativo; el rol real lo define el NIP).
- **Funciones/hooks:** `useAuth().register()`, RPC `validate_registration_nip`, RPC `consume_registration_nip`, `supabase.functions.invoke('cleanup-orphan-user')`.
- **Tablas:** `auth.users` (signUp), `profiles` (trigger `handle_new_user`), `user_roles`, `registration_nips`.
- **Campos:** `registration_nips.code/role/used/used_by/used_at/expires_at`; `profiles.nombre/apellido/numero_empleado/email`; `user_roles.role`.
- **Servicios/endpoints:** RPC `validate_registration_nip`, RPC `consume_registration_nip` (`SECURITY DEFINER`, valida `auth.uid() = _user_id`), edge function `cleanup-orphan-user`.
- **Seguridad/RLS:** `registration_nips` solo gestionable por admin (`has_role admin`) salvo las RPC dedicadas. `cleanup-orphan-user` solo borra si el usuario invocante aún no tiene rol asignado.
- **Depende de / de quién depende:** Depende de NIPs creados en `RegistrationNips.tsx`. De él depende `SessionCaptureGate` (si el rol asignado es guardia).
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/Register.tsx → handleSubmit` → RPC `validate_registration_nip`/`consume_registration_nip` → tablas `registration_nips`, `user_roles`, `profiles` → edge function `cleanup-orphan-user` para el rollback.
- **Consideraciones:** El rol elegido en el formulario es solo un placeholder visual; el NIP es la fuente de verdad del rol. Mensajes humanizados para NIP inválido/usado/vencido, email duplicado, contraseña filtrada y rate limit.

### Recuperación de contraseña
- **Qué hace:** Envía un correo de recuperación mediante Supabase Auth con `redirectTo` a `/reset-password`.
- **Quién puede usarla:** Público (no autenticado).
- **Dónde está en la interfaz:** `/forgot-password`, enlazado desde `/login`.
- **Archivos:** `src/pages/ForgotPassword.tsx`, `supabase/functions/auth-email-hook/index.ts` (plantilla `recovery`).
- **Componentes:** `ForgotPassword`, `Input`, `Button`.
- **Funciones/hooks:** `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
- **Tablas:** Ninguna directa desde el cliente; el hook de correo registra en `email_send_log` vía `enqueue_email`.
- **Campos:** solo `email`.
- **Servicios/endpoints:** `auth.resetPasswordForEmail`; edge function `auth-email-hook` renderiza y encola el correo tipo `recovery`.
- **Seguridad/RLS:** Ruta pública; el hook verifica la firma del webhook con `LOVABLE_API_KEY`.
- **Depende de / de quién depende:** Alimenta a `/reset-password`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/ForgotPassword.tsx` → `supabase.auth.resetPasswordForEmail` → plantilla `supabase/functions/_shared/email-templates/recovery.tsx` vía `auth-email-hook`.
- **Consideraciones:** No revela si el correo existe (mensaje genérico).

### Reseteo de contraseña
- **Qué hace:** Resuelve el enlace de recuperación en todas sus variantes (hash con `access_token`/`refresh_token`, PKCE `?code=`, `token_hash` OTP o sesión de recuperación activa), detecta enlaces vencidos/ inválidos y permite fijar la nueva contraseña.
- **Quién puede usarla:** Público, pero requiere enlace válido.
- **Dónde está en la interfaz:** `/reset-password` (llegada solo por correo).
- **Archivos:** `src/pages/ResetPassword.tsx`.
- **Componentes:** `ResetPassword`, `Input`, `Button`.
- **Funciones/hooks:** `supabase.auth.onAuthStateChange`, `setSession`, `exchangeCodeForSession`, `verifyOtp`, `getSession`, `updateUser`.
- **Tablas:** Ninguna directa.
- **Servicios/endpoints:** Supabase Auth.
- **Seguridad/RLS:** Sin `ProtectedRoute`; sin token válido queda bloqueado en "Enlace no válido".
- **Depende de / de quién depende:** Depende del correo generado por `ForgotPassword` / `auth-email-hook`; al terminar navega a `/dashboard`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/ResetPassword.tsx → resolveLink()/handleSubmit()` → Supabase Auth (sin tablas propias).
- **Consideraciones:** Cubre 4 formatos de enlace por compatibilidad; valida longitud mínima (6) y coincidencia.

### Captura de foto de sesión al entrar/salir
- **Qué hace:** Bloquea la app con una pantalla de cámara en vivo cuando un usuario con rol `guardia` inicia sesión o cierra sesión (`logout()` espera la foto antes de invalidar el token). Registra foto + GPS + dispositivo en `sesion_registros` y notifica a supervisores/admins.
- **Quién puede usarla:** Solo se activa para `role === 'guardia'`; automático, no navegable.
- **Dónde está en la interfaz:** Overlay `fixed inset-0 z-[200]` montado globalmente por `<SessionCaptureGate />` en `App.tsx`.
- **Archivos:** `src/components/SessionCaptureGate.tsx`, `src/components/SessionPhotoCapture.tsx`, `src/lib/sesion-registros.ts`, `src/lib/auth-context.tsx`, `src/lib/device-info.ts`, `src/lib/image-compress.ts`.
- **Componentes:** `SessionCaptureGate`, `SessionPhotoCapture`.
- **Funciones/hooks:** `marcarCapturaLoginPendiente`, `capturaLoginPendiente`, `limpiarCapturaLoginPendiente`, `setLogoutCaptureHandler`/`getLogoutCaptureHandler`, `registrarSesion`, `capturarUbicacion`, `subirFotoSesion`, `getDeviceInfo`, `compressImage`, evento `CAPTURA_LOGIN_EVENT`.
- **Tablas:** `sesion_registros` (insert), `profiles` (nombre para la notificación), `asistencias` (turno activo al cerrar sesión).
- **Campos:** `sesion_registros.user_id/evento/foto_url/lat/lng/precision_metros/ubicacion_error/dispositivo`.
- **Servicios/endpoints:** Storage `evidencias` (`${userId}/sesiones/${evento}-timestamp.jpg`), geolocalización del navegador, `notifySesionValidacion` / `notifySesionCierre` / `notifySesionCierreEnTurno`.
- **Seguridad/RLS:** `sesion_registros`: INSERT solo `auth.uid() = user_id`; SELECT propio o admin/supervisor.
- **Depende de / de quién depende:** Depende de `auth-context.tsx`; alimenta la bitácora `RegistrosSesion.tsx`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/auth-context.tsx → login()/logout()` → `src/components/SessionCaptureGate.tsx` → `src/components/SessionPhotoCapture.tsx` → `src/lib/sesion-registros.ts → registrarSesion()` → tabla `sesion_registros` / bucket `evidencias`.
- **Consideraciones:** Nunca usa galería (`capture="user"` como fallback); timeouts de 20s foto / 12s GPS; en logout la captura ocurre ANTES de invalidar el token porque RLS exige `auth.uid()` activo; el usuario puede cancelar el cierre de sesión, no el ingreso.

### Bitácora de registros de sesión
- **Qué hace:** Lista y filtra (fecha, usuario, evento) los registros de `sesion_registros` con miniatura firmada, coordenadas, precisión, error de ubicación, dispositivo, enlace a OpenStreetMap y mapa integrado.
- **Quién puede usarla:** supervisor, admin.
- **Dónde está en la interfaz:** `/registros-sesion`, desde el panel de administración/supervisión.
- **Archivos:** `src/pages/RegistrosSesion.tsx`, `src/lib/sesion-registros.ts`.
- **Componentes:** `RegistrosSesion`, `SignedImg`, `MapView` (lazy).
- **Funciones/hooks:** `listSesionRegistros(filtros)`.
- **Tablas:** `sesion_registros`, `profiles` (lista de usuarios del filtro).
- **Campos:** todas las columnas de `sesion_registros`; `profiles.user_id/nombre/apellido`.
- **Servicios/endpoints:** Storage `evidencias` con URLs firmadas.
- **Seguridad/RLS:** `ProtectedRoute roles={['supervisor','admin']}`; RLS permite SELECT total solo a admin/supervisor.
- **Depende de / de quién depende:** Depende de los registros generados por `SessionCaptureGate`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/RegistrosSesion.tsx` → `listSesionRegistros()` → tabla `sesion_registros` → política RLS de supervisor/admin.
- **Consideraciones:** Límite de 500 registros; el mapa solo grafica puntos con lat/lng.

### Perfil de usuario y avatar
- **Qué hace:** Muestra nombre, número de empleado, correo y rol; permite subir/actualizar el avatar, activar notificaciones push y cerrar sesión.
- **Quién puede usarla:** Cualquier usuario autenticado.
- **Dónde está en la interfaz:** `/perfil`, ítem "Perfil" del `BottomNav` en todos los roles.
- **Archivos:** `src/pages/Perfil.tsx`.
- **Componentes:** `Perfil`, `Avatar`, `BottomNav`, `PushToggle`.
- **Funciones/hooks:** `useAuth()` (`user`, `logout`), `handleAvatarUpload`.
- **Tablas:** `profiles` (update `avatar_url`).
- **Campos:** `profiles.avatar_url`.
- **Servicios/endpoints:** Storage público `avatars`, path `${user.id}/avatar.<ext>`.
- **Seguridad/RLS:** `ProtectedRoute` (cualquier rol); bucket `avatars` con lectura pública y escritura del propio usuario.
- **Depende de / de quién depende:** Depende de `auth-context.tsx`; el logout dispara la captura fotográfica de salida si es guardia.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/Perfil.tsx → handleAvatarUpload()` → bucket `avatars` → `profiles.avatar_url` → `src/lib/auth-context.tsx → fetchUserProfile()`.
- **Consideraciones:** Límite de 5 MB; el avatar se refresca con `?t=timestamp`, pero el contexto de auth se actualiza al recargar/reingresar.

### Navegación por rol (rutas protegidas y menú inferior)
- **Qué hace:** Define rutas públicas y protegidas por rol, y renderiza distinto menú inferior y distinto dashboard según `user.role`.
- **Quién puede usarla:** Según el mapa de rutas de §0.
- **Dónde está en la interfaz:** Rutas en `src/App.tsx`; navegación en `BottomNav` (`guardItems`, `supervisorItems`, `adminItems`, `clienteItems`).
- **Archivos:** `src/App.tsx`, `src/components/ProtectedRoute.tsx`, `src/components/BottomNav.tsx`, `src/components/NavLink.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Index.tsx`.
- **Componentes:** `ProtectedRoute`, `BottomNav`, `NavLink`, `Dashboard`.
- **Funciones/hooks:** `useAuth()` (`user`, `isAuthenticated`, `loading`), `useLocation`, `useNavigate`.
- **Tablas:** ninguna directa; depende del `role` resuelto en `auth-context.tsx`.
- **Seguridad/RLS:** `ProtectedRoute` es defensa en profundidad de UI; la seguridad real está en RLS.
- **Depende de / de quién depende:** Depende de `AuthProvider`; de él dependen todas las páginas internas.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/App.tsx` (ruta y roles) → `src/components/ProtectedRoute.tsx` → `src/components/BottomNav.tsx` (ítem visible) → política RLS equivalente en la tabla consultada.
- **Consideraciones:** Code-splitting con `lazy()`; `Index.tsx` solo redirige a `/login`.

### Branding (identidad visual)
- **Qué hace:** Provee logo y paleta configurables globalmente (fila única en `branding`), aplicados como variables CSS y cacheados en `localStorage` para carga instantánea.
- **Quién puede usarla:** Lectura: cualquiera (incluso sin sesión, porque se usa en `/login`). Edición: solo admin en `/identidad`.
- **Dónde está en la interfaz:** `<BrandingProvider>` global; consumido en Login, Register, ForgotPassword, ResetPassword, `AppHeader` y `BottomNav`.
- **Archivos:** `src/lib/branding.tsx`, `src/pages/Branding.tsx`.
- **Componentes:** `BrandingProvider`.
- **Funciones/hooks:** `useBranding()`, `useBrandLogo()`, `applyBrandingColors()`, `hexToHsl()`, `hslToHex()`, `signLogo()`.
- **Tablas:** `branding` (fila `id = true`).
- **Campos:** `logo_url, primary_hsl, primary_glow_hsl, accent_hsl, background_hsl, card_hsl, soporte_whatsapp`.
- **Servicios/endpoints:** Storage privado `branding` (URL firmada de 1 año).
- **Seguridad/RLS:** `branding_read_all` (SELECT público), `branding_admin_insert`/`branding_admin_update` (solo admin).
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/branding.tsx → refresh()` → tabla `branding` → bucket `branding` → `src/pages/Branding.tsx` para la edición.
- **Consideraciones:** Cachea en `localStorage` (`defender.branding.v1`) para evitar parpadeo; ante error usa `DEFAULT_COLORS` y el logo local.

### Gestión de NIPs de registro
- **Qué hace:** Permite al administrador generar, copiar, listar (activos/vencidos/usados) y eliminar códigos NIP de 6 caracteres que definen el rol asignado al registrarse, con vencimiento opcional y etiqueta.
- **Quién puede usarla:** Solo admin.
- **Dónde está en la interfaz:** `/nips`.
- **Archivos:** `src/pages/RegistrationNips.tsx`.
- **Componentes:** `RegistrationNips`, `NipRow`, `AppHeader`, `BottomNav`.
- **Funciones/hooks:** `generateCode()`, `load()`, `create()`, `remove()`, `copy()`.
- **Tablas:** `registration_nips`.
- **Campos:** `code, role, label, used, used_at, used_by, expires_at, created_by, created_at`.
- **Servicios/endpoints:** Acceso directo con RLS de admin; consumo desde `Register.tsx` vía RPC.
- **Seguridad/RLS:** Política `FOR ALL` solo `has_role(admin)`; auditado por el trigger `audit_registration_nips`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/RegistrationNips.tsx → create()/remove()` → tabla `registration_nips` → RLS admin-only → trigger de auditoría → `src/pages/Register.tsx` (consumo).
- **Consideraciones:** El código excluye caracteres ambiguos (`0/O/1/I`); vencimiento `0` = sin expiración.

### Auditoría (bitácora de eventos)
- **Qué hace:** Registra eventos de aplicación (login, logout, exportaciones, aprobaciones, errores) en una tabla inmutable, más los cambios automáticos de tablas críticas vía triggers.
- **Quién puede usarla:** Escritura: cualquier autenticado a través de `log_audit_event` (el actor se deriva de `auth.uid()`). Lectura: solo admin en `/auditoria`.
- **Dónde está en la interfaz:** `/auditoria` para consulta; el registro ocurre en segundo plano.
- **Archivos:** `src/lib/audit.ts`, `src/pages/AuditLog.tsx`, `src/lib/auth-context.tsx`.
- **Funciones/hooks:** `logAudit({ accion, tabla, registroId, datos })`.
- **Tablas:** `audit_log`; triggers en `servicios`, `checkpoints`, `guardia_servicios`, `user_roles`, `registration_nips`.
- **Campos:** `actor_id, actor_email, accion, tabla, registro_id, datos_antes, datos_despues, dispositivo, created_at`.
- **Servicios/endpoints:** RPC `log_audit_event` (`SECURITY DEFINER`).
- **Seguridad/RLS:** SELECT solo admin; UPDATE/DELETE bloqueados por el trigger `audit_log_block_mutation`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/audit.ts → logAudit()` → RPC `log_audit_event` → tabla `audit_log` → trigger `audit_row_change` si se desea auditar una tabla nueva.
- **Consideraciones:** `logAudit` nunca lanza excepción (best-effort); la inmutabilidad es a nivel de base de datos.
## 2. Operación del guardia

### Control de turno (inicio/fin, horas extra, asistencias, faltas)
- **Qué hace:** Permite iniciar y finalizar el turno. Al iniciar crea un registro en `turnos` y una `asistencia` con el fin esperado según el tipo de turno del servicio (12h, 24h, corrido). Calcula si el turno se completó, si hubo horas extra o si terminó incompleto. Al finalizar pide guardia entrante y comentario, y ofrece capturar una nota de relevo. Los turnos "corrido" generan asistencias automáticas diarias (`generarAsistenciasCorridoFaltantes`). El cron `auto-close-shifts` cierra turnos abandonados >48 h, marca la asistencia incompleta y registra la falta.
- **Quién puede usarla:** guardia (componente montado en `GuardDashboard`).
- **Dónde está en la interfaz:** `/dashboard`, sección "Control de Turno", bajo el banner de nota de relevo.
- **Archivos:** `src/components/ShiftControl.tsx`, `src/lib/asistencias-helpers.ts`, `src/lib/notas-relevo.ts`, `src/lib/guardia-servicios.ts`, `supabase/functions/auto-close-shifts/index.ts`, `supabase/functions/check-relevo-pendiente/index.ts`.
- **Componentes:** `ShiftControl`.
- **Funciones/hooks:** `startShift`, `endShift`, `loadActiveTurno`, `loadServicios`, `generarAsistenciasCorridoFaltantes`, `tipoTurnoHoras`, `tipoTurnoLabel`, `crearNotaRelevo`.
- **Tablas:** `turnos`, `asistencias`, `faltas`, `notas_relevo`, `servicios`, `guardia_servicios`.
- **Campos:** `turnos`: guardia_id, servicio_id, inicio, fin, status, comentario_cambio, guardia_entrante. `asistencias`: guardia_id, servicio_id, turno_id, tipo_turno, inicio, fin, fin_esperado, duracion_minutos, status, horas_extra, observaciones, auto_generado.
- **Servicios/endpoints:** Edge functions `auto-close-shifts` y `check-relevo-pendiente` (esta última avisa por push a supervisores cuando el turno llega a su fin esperado sin relevo).
- **Seguridad/RLS:** `/dashboard` protegida por `ProtectedRoute`; escrituras acotadas por RLS a `guardia_id = auth.uid()`. Las edge functions usan `SUPABASE_SERVICE_ROLE_KEY`.
- **Depende de / de quién depende:** Depende de `loadServiciosParaUsuario` (servicio principal). Alimenta `DailyProgress`, `PendientesList`, `useRondinAlarm` y `useGlobalZoneMonitor`, que requieren turno activo. Notifica con `notifyTurnoInicio`/`notifyTurnoFin`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/components/ShiftControl.tsx → startShift/endShift` → tablas `turnos`/`asistencias` → lógica de horas requeridas y extra; `src/lib/asistencias-helpers.ts → tipoTurnoHoras`; `supabase/functions/auto-close-shifts`.
- **Consideraciones:** Las horas extra solo aplican si se cumplió el tiempo requerido; los turnos "corrido" no requieren cierre diario.

### Nota de relevo
- **Qué hace:** Al finalizar turno el guardia saliente deja pendientes e instrucciones (opcionalmente marcadas como importantes) para el siguiente guardia del mismo servicio, que debe confirmar "Entendido, recibí el relevo".
- **Quién puede usarla:** guardia.
- **Dónde está en la interfaz:** Formulario dentro de "Finalizar Turno" en `/dashboard`; visualización en la parte superior de `/dashboard` (`NotaRelevoEntrante`).
- **Archivos:** `src/lib/notas-relevo.ts`, `src/components/NotaRelevoEntrante.tsx`, `src/components/ShiftControl.tsx`.
- **Componentes:** `NotaRelevoEntrante`.
- **Funciones/hooks:** `crearNotaRelevo`, `cargarNotasPendientes`, `cargarNotasServicio`, `marcarNotaLeida`.
- **Tablas:** `notas_relevo`.
- **Campos:** servicio_id, turno_id, autor_id, autor_nombre, pendientes, instrucciones, importante, leida_por, leida_at, created_at.
- **Seguridad/RLS:** La consulta filtra por servicios asignados y excluye las notas del propio autor; RLS permite ver al autor, a guardias del servicio y a supervisor/admin.
- **Depende de / de quién depende:** Depende de `loadServiciosParaUsuario`; se dispara desde `ShiftControl.endShift`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/notas-relevo.ts → crearNotaRelevo/cargarNotasPendientes` → tabla `notas_relevo` → filtros por servicio y autor.
- **Consideraciones:** Si pendientes e instrucciones están vacíos no se crea la nota. Retención de 30 días.

### Rondines con reporte por punto y geocerca
- **Qué hace:** Check-in validando que el guardia esté dentro del radio GPS; escaneo de cada checkpoint con foto en vivo (rechaza archivos de galería por antigüedad), estado `sin_novedad`/`con_novedad` y observación obligatoria (≥10 caracteres), validando distancia a cada punto. El checkout exige un reporte general (≥10 caracteres) y bloquea el cierre si faltan puntos obligatorios, salvo que el servicio permita rondines incompletos.
- **Quién puede usarla:** guardia, supervisor, admin.
- **Dónde está en la interfaz:** `/rondines`, botón "Iniciar Rondín" en Acciones Rápidas de `GuardDashboard`.
- **Archivos:** `src/pages/Rondines.tsx`, `src/hooks/use-zone-monitor.ts`, `src/lib/guardia-servicios.ts`, `src/components/SignedImg.tsx`, `src/lib/offline-photo-queue.ts`.
- **Componentes:** página `Rondines` (usa `Dialog` para escaneo y checkout).
- **Funciones/hooks:** `handleCheckIn`, `openScanDialog`, `confirmScan`, `submitCheckout`, `getDistanceMeters`, `getCurrentPositionRobust`, `useZoneMonitor`, `notifyRondinCheckIn`, `notifyRondinPunto`, `notifyRondinCheckOut`.
- **Tablas:** `rondines`, `rondin_scans`, `checkpoints`, `servicios`.
- **Campos:** `rondines`: guardia_id, servicio_id, checkin_at, checkin_lat, checkin_lng, checkout_at, status, reporte. `rondin_scans`: rondin_id, checkpoint_id, lat, lng, foto_url, observacion, estado, scanned_at. `checkpoints`: nombre, lat, lng, radius_metros, obligatorio.
- **Servicios/endpoints:** Storage `evidencias` vía `uploadPhotoResilient`; notificaciones a supervisión.
- **Seguridad/RLS:** Ruta con roles `['guardia','supervisor','admin']`; RLS de `rondines`/`rondin_scans` limita al propio guardia.
- **Depende de / de quién depende:** Usa `useZoneMonitor` y la cola de fotos offline; alimenta `DailyProgress`, `Historial` y la alarma de rondín (que redirige aquí).
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/Rondines.tsx → handleCheckIn/confirmScan/submitCheckout` → tablas `rondines`/`rondin_scans` → validación GPS y obligatoriedad de puntos.
- **Consideraciones:** Distancia permitida = radio del punto + min(precisión GPS, 50 m). Se rechazan fotos con `lastModified` de más de 2 minutos. `servicios.permitir_rondin_incompleto` relaja el bloqueo.

### Alarma de rondín con cuenta regresiva
- **Qué hace:** Con turno activo en un servicio con `rondin_intervalo_minutos` configurado, dispara periódicamente una alarma que bloquea la pantalla completa, suena y otorga 3 minutos (`RESPUESTA_MAX_MIN`) para aceptar e iniciar el rondín; si no se atiende, marca falta y notifica al supervisor con el retraso.
- **Quién puede usarla:** guardia (el hook solo actúa para ese rol); el componente se monta globalmente.
- **Dónde está en la interfaz:** Overlay global montado en `App.tsx`.
- **Archivos:** `src/hooks/use-rondin-alarm.ts`, `src/components/RondinAlarmMonitor.tsx`, `src/lib/alert-sound.ts`, `src/lib/notification-helpers.ts`.
- **Componentes:** `RondinAlarmMonitor`.
- **Funciones/hooks:** `useRondinAlarm`, `aceptar`, `tick`, `createNotification`, `playAlertSound`.
- **Tablas:** `rondin_alarmas`, `turnos`, `servicios`.
- **Campos:** `rondin_alarmas`: servicio_id, guardia_id, turno_id, scheduled_at, notified_at, responded_at, delay_seconds, cumplido, falta_generada. `servicios`: rondin_intervalo_minutos, rondin_tolerancia_minutos.
- **Servicios/endpoints:** Realtime en canal `rondin-alarm-turno`; notificaciones tipo `rondin_alarma`/`incidencia`; Notification API del navegador.
- **Seguridad/RLS:** Componente global; escrituras acotadas por RLS de `rondin_alarmas` (guardia dueño, supervisor y admin).
- **Depende de / de quién depende:** Depende de turno activo con servicio configurado en `/alarmas-rondin`; al aceptar navega a `/rondines`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/hooks/use-rondin-alarm.ts → tick` → tabla `rondin_alarmas` → programación/tolerancia; `RESPUESTA_MAX_MIN` para cambiar el límite de 3 minutos.
- **Consideraciones:** Poll cada 15 s; reabre la alarma si la app se recarga y sigue vigente; suena con `playAlertSound('alta')`.

### Validación de puesto programada (lado guardia)
- **Qué hace:** Al llegar un horario programado (dentro de la tolerancia) bloquea la pantalla exigiendo fotografía en vivo; captura fecha, hora, GPS y precisión, y compara contra el checkpoint esperado para determinar `valida`, `fuera_area` o `sin_ubicacion`, notificando al supervisor.
- **Quién puede usarla:** guardia (el gate solo actúa para ese rol); la programación la crean supervisor/admin.
- **Dónde está en la interfaz:** Overlay global (`ValidacionPuestoGate` en `App.tsx`), sin ruta propia.
- **Archivos:** `src/components/ValidacionPuestoGate.tsx`, `src/lib/validacion-puesto.ts`, `src/lib/sesion-registros.ts`, `src/lib/device-info.ts`, `src/lib/alert-sound.ts`.
- **Componentes:** `ValidacionPuestoGate`.
- **Funciones/hooks:** `listConfigsDelGuardia`, `slotVigente`, `slotKey`, `respondidosHoy`, `registrarValidacion`, `distanciaMetros`.
- **Tablas:** `validacion_puesto_config`, `validaciones_puesto`, `checkpoints`, `guardia_servicios`.
- **Campos:** config: nombre, servicio_id, checkpoint_id, horarios, dias, tolerancia_minutos, radio_metros, guardia_ids, activo. Registro: config_id, guardia_id, servicio_id, checkpoint_id, programado_at, respondido_at, foto_url, lat, lng, precision_metros, distancia_metros, dentro_area, resultado, dispositivo.
- **Servicios/endpoints:** Storage `evidencias` (`.../validacion-puesto/...`); `notifyValidacionPuesto`.
- **Seguridad/RLS:** El guardia solo ve programaciones activas donde está listado o, si la lista está vacía, las de su servicio (`guardia_has_servicio`).
- **Depende de / de quién depende:** Depende de las programaciones creadas en `/validacion-puesto`; poll cada 10 s y revalidación al recuperar foco/conexión.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/validacion-puesto.ts → slotVigente/registrarValidacion` → tabla `validaciones_puesto` → tolerancia y comparación de distancia; `src/components/ValidacionPuestoGate.tsx` → flujo de cámara.
- **Consideraciones:** Solo se atiende un slot a la vez (el más reciente); el margen de precisión GPS se limita a 50 m.

### Visitas concurrentes
- **Qué hace:** Registra visitantes con nombre, motivo, persona a visitar, área destino y fotos obligatorias de placa e INE. Permite múltiples visitas abiertas al mismo tiempo, cada una con su propia salida (foto de salida).
- **Quién puede usarla:** guardia, supervisor, admin.
- **Dónde está en la interfaz:** `/visitas`, botón "Visitas" en Acciones Rápidas de `GuardDashboard`.
- **Archivos:** `src/pages/Visitas.tsx`, `src/components/VisitaDetailDialog.tsx`, `src/components/SignedImg.tsx`, `src/lib/storage-helpers.ts`, `src/lib/offline-photo-queue.ts`.
- **Componentes:** página `Visitas`, `VisitaDetailDialog`.
- **Funciones/hooks:** `loadVisitas`, `handleRegister`, `handleExit`, `uploadPhoto`, `notifyVisitaEntrada`, `notifyVisitaEntradaSalida`.
- **Tablas:** `visitas`.
- **Campos:** guardia_id, nombre_visitante, motivo, persona_a_visitar, area_destino, foto_placa_url, foto_ine_url, foto_salida_url, hora_entrada, hora_salida, status.
- **Servicios/endpoints:** Storage `visitas` (subcarpetas `placas`, `ine`, `salidas`).
- **Seguridad/RLS:** Ruta con roles `['guardia','supervisor','admin']`; RLS por `guardia_id`, lectura ampliada a supervisor/admin/cliente del servicio.
- **Depende de / de quién depende:** Alimenta `Historial` (pestaña visitas) y las vistas de supervisión.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/Visitas.tsx → handleRegister/handleExit` → tabla `visitas` → validación de campos y fotos obligatorias.
- **Consideraciones:** Carga simultáneamente las visitas abiertas (sin filtro de fecha) y el historial cerrado del día, para no perder visitas abiertas de días anteriores.

### Pendientes del puesto
- **Qué hace:** Muestra al guardia con turno activo las tareas configuradas para su servicio, con prioridad, frecuencia (única / cada turno / cada X horas) y vigencia. El guardia las marca como cumplidas adjuntando foto y nota; el sistema recalcula el cumplimiento según la frecuencia.
- **Quién puede usarla:** Cumplimiento: guardia. Configuración: supervisor y admin en `/pendientes`.
- **Dónde está en la interfaz:** Sección "Pendientes del puesto" en `/dashboard`; configuración en `/pendientes`.
- **Archivos:** `src/components/PendientesList.tsx`, `src/pages/PendientesPuesto.tsx`.
- **Componentes:** `PendientesList`, página `PendientesPuesto`.
- **Funciones/hooks:** `load`, `confirmar`, `useRealtimeTable('pendientes_puesto' | 'pendientes_completados')`, `crear`, `toggleActivo`, `eliminar`.
- **Tablas:** `pendientes_puesto`, `pendientes_completados`, `turnos`.
- **Campos:** catálogo: servicio_id, guardia_id, titulo, descripcion, prioridad, frecuencia, horas_intervalo, activo, vigencia_inicio, vigencia_fin, created_by. Cumplimiento: pendiente_id, guardia_id, turno_id, nota, foto_url, created_at.
- **Servicios/endpoints:** Storage `pendientes`; realtime sobre ambas tablas.
- **Seguridad/RLS:** `/pendientes` restringida a `['supervisor','admin']`; el guardia solo ve los pendientes de sus servicios asignados.
- **Depende de / de quién depende:** Requiere turno activo con `servicio_id`; alimenta el contador de `DailyProgress`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/components/PendientesList.tsx → load/confirmar` → tablas `pendientes_puesto`/`pendientes_completados` → lógica de vigencia y frecuencia; `src/pages/PendientesPuesto.tsx` para las reglas de creación.
- **Consideraciones:** Si el pendiente tiene `guardia_id`, solo ese guardia lo ve; si no, aplica a todos los del servicio.

### Reporte de novedades
- **Qué hace:** Registra tantas novedades como sea necesario durante el turno (descripción ≥10 caracteres, ubicación en texto, foto opcional, GPS automático) marcadas como "normal" o "importante" (esta última alerta de inmediato a supervisor/admin). Permite filtrar las del día, descargar PDF y enviar el consolidado (`reportes_turno`) al supervisor; si el supervisor pide correcciones (`retroalimentacion`), el guardia puede reenviar.
- **Quién puede usarla:** guardia, supervisor, admin en `/reportes`; vista agregada multi-guardia en `/novedades` para supervisor/admin.
- **Dónde está en la interfaz:** `/reportes`, botón "Reporte de Novedades" en Acciones Rápidas; supervisión en `/novedades`.
- **Archivos:** `src/pages/ReporteNovedades.tsx`, `src/pages/NovedadesReportes.tsx`, `src/lib/novedades.ts`, `src/lib/pdf-report.ts`, `src/lib/image-compress.ts`.
- **Funciones/hooks:** `createNovedad`, `listNovedades`, `deleteNovedad`, `tryGetPosition`, `formatFechaHora`, `notifyNovedad`, `generateReportPdf`.
- **Tablas:** `novedades`, `reportes_turno`.
- **Campos:** `novedades`: guardia_id, servicio_id, turno_id, descripcion, importancia, lat, lng, ubicacion_texto, foto_url, alerta_enviada_at. `reportes_turno`: guardia_id, incidencias, actividades, observaciones, firmado, status, retroalimentacion.
- **Servicios/endpoints:** Storage `evidencias`; PDF generado en el cliente.
- **Seguridad/RLS:** El guardia solo edita o borra sus novedades **del mismo día**; supervisor/admin leen todo; el cliente ve las de sus servicios.
- **Depende de / de quién depende:** Alimenta `DailyProgress`, `Historial` y `ReporteDetailDialog`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/novedades.ts → createNovedad/listNovedades` → tabla `novedades`; `src/pages/ReporteNovedades.tsx → enviarConsolidado` → tabla `reportes_turno`.
- **Consideraciones:** El consolidado exige al menos una novedad del día; reenviar tras retroalimentación resetea `status` a `pendiente`.

### Historial
- **Qué hace:** Muestra al guardia su actividad histórica en pestañas: Resumen (estadísticas de los últimos 6 meses), Reportes de turno, Visitas, Préstamos/RH, Rondines y Alertas de zona, con detalle en diálogos.
- **Quién puede usarla:** guardia, supervisor, admin.
- **Dónde está en la interfaz:** `/historial`, botón "Mi Historial" en Acciones Rápidas.
- **Archivos:** `src/pages/Historial.tsx`, `src/components/ReporteDetailDialog.tsx`, `src/components/VisitaDetailDialog.tsx`.
- **Funciones/hooks:** `loadStats`, `loadTab`, `getTrend`, `useRealtimeTable('notificaciones')`.
- **Tablas:** `rondines`, `visitas`, `notificaciones` (tipo `zona`), `reportes_turno`, `registros_rh`.
- **Seguridad/RLS:** Todas las consultas filtran `guardia_id = user.id`, reforzado por RLS.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/Historial.tsx → loadTab/loadStats` → tablas por pestaña → límite de 50 registros y agregación mensual.
- **Consideraciones:** Comparación porcentual contra el mes anterior.

### Progreso diario / metas
- **Qué hace:** Calcula el avance del guardia frente a las metas diarias del servicio (`metas_servicio`): rondines, reportes y pendientes, con porcentaje, insignias y puntos. Al cumplir la meta inserta/actualiza `cuadro_honor` y muestra confeti.
- **Quién puede usarla:** guardia (visualización); metas configuradas por supervisor/admin en `/metas`.
- **Dónde está en la interfaz:** Sección "Tu meta de hoy" en `/dashboard`.
- **Archivos:** `src/components/DailyProgress.tsx`, `src/lib/goals-helpers.ts`.
- **Funciones/hooks:** `computeGuardProgress`, `upsertCuadroHonorIfMet`, `getServicioForGuard`.
- **Tablas:** `metas_servicio`, `rondines`, `reportes_turno`, `pendientes_completados`, `cuadro_honor`, `profiles`, `servicios`.
- **Campos:** metas: rondines_diarios, reportes_diarios, pendientes_diarios, hora_inicio, hora_fin. `cuadro_honor`: guardia_id, servicio_id, fecha, rondines_completados, reportes_completados, puntos, insignias.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/goals-helpers.ts → computeGuardProgress` → tablas de metas y actividad → cálculo de porcentaje e insignias; `upsertCuadroHonorIfMet` → tabla `cuadro_honor`.
- **Consideraciones:** Valores por defecto si no hay meta (4 rondines, 1 reporte, 08:00–20:00); recalcula cada 30 s; la insignia "racha_semanal" exige 7 días cumplidos.

### Monitor de geocerca global
- **Qué hace:** Con turno activo, vigila la posición GPS (`watchPosition`) contra el centro de zona del servicio (primer checkpoint con coordenadas, radio ampliado 10×). Al salir del radio notifica a supervisor/admin, muestra notificación del sistema operativo y un toast, con enfriamiento de 15 minutos. Existe además un monitor por pantalla (`useZoneMonitor`, enfriamiento de 60 min) usado en `/rondines`.
- **Quién puede usarla:** guardia (los hooks solo actúan para ese rol); supervisor y admin reciben la alerta.
- **Dónde está en la interfaz:** Sin UI propia; corre en segundo plano (`GlobalZoneMonitor` en `App.tsx`).
- **Archivos:** `src/hooks/use-global-zone-monitor.ts`, `src/components/GlobalZoneMonitor.tsx`, `src/hooks/use-zone-monitor.ts`.
- **Funciones/hooks:** `useGlobalZoneMonitor`, `checkZone`, `getDistanceMeters`, `notifyZonaExit`, `useZoneMonitor`.
- **Tablas:** `turnos`, `checkpoints`, `servicios` (lectura); `notificaciones` (escritura tipo `zona`).
- **Servicios/endpoints:** Realtime canal `global-zone-turno`; Notification API del navegador.
- **Depende de / de quién depende:** Requiere turno activo y checkpoints con GPS; genera los datos de `Historial` (pestaña alertas) y de la supervisión en `/mapa`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/hooks/use-global-zone-monitor.ts → checkZone/loadTurnoYZona` → tablas `checkpoints`/`turnos` → factor de radio (×10) y enfriamiento; `src/hooks/use-zone-monitor.ts` para el monitor local.
- **Consideraciones:** Requiere permiso de notificaciones del navegador; coexisten dos monitores (global de 15 min y local de rondines de 60 min), por lo que pueden solaparse alertas.

### Cola offline (escrituras y fotos)
- **Qué hace:** 1) `offline-queue.ts` encola en `localStorage` escrituras JSON "fire-and-forget" cuando falla la red y las reintenta al reconectar (máx. 10 intentos). 2) `offline-photo-queue.ts` guarda las fotos comprimidas en IndexedDB cuando falla la subida y las sube al reconectar, permitiendo insertar la fila referenciando una ruta determinística. Un indicador y un banner informan al usuario.
- **Quién puede usarla:** Todos los roles; crítico para el guardia en campo.
- **Dónde está en la interfaz:** Badge flotante "N pendiente(s) de sincronizar" y banner "Sin conexión — reintentando automáticamente…".
- **Archivos:** `src/lib/offline-queue.ts`, `src/lib/offline-photo-queue.ts`, `src/components/OfflineQueueIndicator.tsx`, `src/components/ConnectionBanner.tsx`, `src/hooks/use-online-status.ts`.
- **Funciones/hooks:** `queuedInsert`, `queuedUpdate`, `flushOfflineQueue`, `initOfflineQueue`, `subscribeOfflineQueue`, `uploadPhotoResilient`, `initPhotoQueue`, `pendingPhotoCount`, `useOnlineStatus`.
- **Tablas:** las del llamador; el almacenamiento local usa `localStorage` e IndexedDB (`defender-offline`/`photoQueue`).
- **Servicios/endpoints:** Buckets `evidencias`, `visitas`, `pendientes`; `react-query` invalida todas las consultas al reconectar.
- **Depende de / de quién depende:** Lo usan `Rondines.tsx`, `Visitas.tsx`, `PendientesList.tsx` y `ReporteNovedades.tsx`; se inicializa en `App.tsx`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/offline-queue.ts → flushOfflineQueue/MAX_ATTEMPTS`; `src/lib/offline-photo-queue.ts → drain/uploadPhotoResilient`.
- **Consideraciones:** No usar `offline-queue` cuando se necesita el resultado inmediato (por ejemplo el `id` insertado); tras 10 intentos el ítem se descarta con `console.warn`.
## 3. Supervisión y administración

### Panel de Administrador
- **Qué hace:** Pantalla principal del rol admin: KPIs (usuarios totales, guardias, rondines de hoy, emergencias sin atender), accesos rápidos a todos los módulos y gestión completa de usuarios (cambiar rol, cambiar estatus, asignar supervisor, asignar/quitar servicios a guardias y clientes, marcar servicio principal, eliminar usuario).
- **Quién puede usarla:** admin.
- **Dónde está en la interfaz:** `/dashboard` (se renderiza automáticamente para el rol admin); desde su grilla se navega a los demás módulos.
- **Archivos:** `src/pages/AdminDashboard.tsx`.
- **Componentes:** `UnreadMessagesBanner`, `UnreadAlertsBanner`, `BottomNav`.
- **Funciones/hooks:** `loadData`, `removeUser`, `changeRole` (RPC), `addServicioToGuardia`, `removeServicioFromGuardia`, `setServicioPrincipal`, `assignSupervisor`, `changeStatus`, `addServicioToCliente`, `removeServicioFromCliente`.
- **Tablas:** `profiles`, `user_roles`, `servicios`, `guardia_servicios`, `cliente_servicios`, `rondines`, `emergencias`.
- **Campos:** `profiles.status`, `profiles.supervisor_asignado_id`, `profiles.servicio_asignado_id`, `guardia_servicios.es_principal`.
- **Servicios/endpoints:** RPC `promote_user` (cambio de rol validado en el servidor).
- **Seguridad/RLS:** Las escrituras están protegidas por RLS de admin en `profiles`, `guardia_servicios` y `cliente_servicios`; el rol solo cambia vía `promote_user` (`SECURITY DEFINER`). `user_roles` no admite escritura directa.
- **Depende de / de quién depende:** Depende de `servicios`; alimenta todos los módulos que filtran por servicio o guardia asignado.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/AdminDashboard.tsx → loadData/changeRole` → `profiles`/`user_roles` → lógica de roles y asignaciones.
- **Consideraciones:** Marcar el servicio principal es una operación de dos pasos (desmarcar el anterior y marcar el nuevo) por el índice único parcial en `guardia_servicios.es_principal`; el trigger `sync_servicio_principal` refleja el cambio en `profiles.servicio_asignado_id`.

### Panel de Supervisor
- **Qué hace:** KPIs (guardias, rondines de hoy, alertas sin atender), accesos rápidos y listado de "Elementos Activos" (guardias con rondín en curso, sitio y hora del último evento).
- **Quién puede usarla:** supervisor.
- **Dónde está en la interfaz:** `/dashboard` para el rol supervisor.
- **Archivos:** `src/pages/SupervisorDashboard.tsx`.
- **Componentes:** `UnreadMessagesBanner`, `UnreadAlertsBanner`, `BottomNav`.
- **Funciones/hooks:** `loadData`.
- **Tablas:** `user_roles`, `rondines`, `emergencias`, `profiles`, `servicios`.
- **Campos:** `rondines.status/guardia_id/servicio_id/created_at`.
- **Seguridad/RLS:** RLS de `rondines` y `emergencias` permite lectura a supervisor y admin.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/SupervisorDashboard.tsx → loadData` → `rondines`/`profiles`/`servicios` → agregación de elementos activos.
- **Consideraciones:** El indicador "Tiempo Resp." se muestra como `—` (no implementado).

### Dashboard operativo
- **Qué hace:** Panel analítico con selector de periodo (día/semana/mes): rondines totales/completos/incompletos, incidencias, alertas de zona, turnos iniciados y finalizados, visitas, cumplimiento por servicio y ranking de guardias con más incidencias.
- **Quién puede usarla:** supervisor, admin.
- **Dónde está en la interfaz:** `/dashboard-operativo`.
- **Archivos:** `src/pages/DashboardOperativo.tsx`.
- **Funciones/hooks:** `loadData`, `getSinceDate`.
- **Tablas:** `rondines`, `notificaciones` (tipo `zona`), `turnos`, `visitas`, `reportes_turno`, `profiles`, `servicios`.
- **Seguridad/RLS:** `ProtectedRoute roles={['supervisor','admin']}`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/DashboardOperativo.tsx → loadData` → `rondines`/`reportes_turno`/`notificaciones` → cálculo de KPIs y cumplimiento.
- **Consideraciones:** Las incidencias se detectan porque `reportes_turno.incidencias` no está vacío (texto libre, no booleano).

### Gestión de servicios y checkpoints
- **Qué hace:** CRUD de servicios (nombre, cliente, dirección, tipo de turno 12h/24h/corrido) y de checkpoints por servicio (nombre, ubicación, lat/lng, radio permitido, obligatorio).
- **Quién puede usarla:** admin.
- **Dónde está en la interfaz:** `/servicios`.
- **Archivos:** `src/pages/Servicios.tsx`.
- **Funciones/hooks:** `fetchServicios`, `addService`, `updateTipoTurno`, `updateRondinConfig`, `removeService`, `addCheckpoint`, `removeCheckpoint`, `toggleCheckpointObligatorio`, `togglePermitirIncompleto`.
- **Tablas:** `servicios`, `checkpoints`.
- **Campos:** `servicios.nombre/cliente/direccion/tipo_turno/rondin_intervalo_minutos/rondin_tolerancia_minutos/permitir_rondin_incompleto`; `checkpoints.nombre/ubicacion/lat/lng/radius_metros/obligatorio`.
- **Seguridad/RLS:** Ruta solo admin; escritura en ambas tablas restringida a admin y supervisor por RLS; los cambios quedan en `audit_log` por trigger.
- **Depende de / de quién depende:** Es el catálogo raíz del que dependen metas, alarmas de rondín, validación de puesto, asistencias, asignaciones y todo el módulo de rondines.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/Servicios.tsx → addService/addCheckpoint` → `servicios`/`checkpoints` → validación de coordenadas.
- **Consideraciones:** La programación de alarmas de rondín se movió al módulo `/alarmas-rondin`; Servicios solo la referencia.

### Asignación de guardias y servicio principal
- **Qué hace:** Asigna servicios a guardias (`guardia_servicios`), marca cuál es el principal (el único que el guardia opera activamente), asigna servicios a clientes (`cliente_servicios`) y define el supervisor de cada usuario.
- **Quién puede usarla:** admin.
- **Dónde está en la interfaz:** `/dashboard` (AdminDashboard), sección "Gestión de Usuarios".
- **Archivos:** `src/pages/AdminDashboard.tsx`, `src/lib/guardia-servicios.ts`.
- **Funciones/hooks:** `addServicioToGuardia`, `removeServicioFromGuardia`, `setServicioPrincipal`, `assignSupervisor`, `loadServiciosParaUsuario`.
- **Tablas:** `guardia_servicios`, `cliente_servicios`, `profiles`.
- **Campos:** `guardia_servicios.guardia_id/servicio_id/es_principal`, `cliente_servicios.cliente_id/servicio_id`, `profiles.supervisor_asignado_id`.
- **Seguridad/RLS:** Inserción/borrado limitados a admin (y supervisor en `guardia_servicios`); `loadServiciosParaUsuario` aplica la regla "el guardia solo opera su servicio principal".
- **Depende de / de quién depende:** De esto dependen rondines, asistencias, metas, cuadro de honor, portal del cliente y todas las políticas RLS basadas en servicio.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/AdminDashboard.tsx → setServicioPrincipal` → `guardia_servicios` (índice único parcial) → trigger `sync_servicio_principal`; `src/lib/guardia-servicios.ts → loadServiciosParaUsuario`.

### Metas por servicio
- **Qué hace:** Define por servicio las metas diarias de rondines, reportes y pendientes, y la ventana horaria de evaluación.
- **Quién puede usarla:** supervisor, admin (doble verificación: ruta y guard interno).
- **Dónde está en la interfaz:** `/metas`.
- **Archivos:** `src/pages/MetasServicio.tsx`.
- **Funciones/hooks:** `load`, `updateField`, `save`.
- **Tablas:** `servicios`, `metas_servicio`.
- **Campos:** `metas_servicio.servicio_id/rondines_diarios/reportes_diarios/pendientes_diarios/hora_inicio/hora_fin/created_by`.
- **Servicios/endpoints:** `upsert` con `onConflict: 'servicio_id'`.
- **Depende de / de quién depende:** Alimenta `DailyProgress`, `cuadro_honor` y la función `cumplimiento_metas_guardia` usada por los reconocimientos.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/MetasServicio.tsx → save` → `metas_servicio` → upsert por `servicio_id`.
- **Consideraciones:** Una meta por servicio (no por guardia); sin registro se usan valores por defecto (4 rondines, 1 reporte, 08:00–20:00).

### Programación de alarmas de rondín
- **Qué hace:** Configura por servicio cada cuántos minutos suena la alarma bloqueante de rondín, la tolerancia antes de considerar retraso y si se permite cerrar rondines incompletos.
- **Quién puede usarla:** supervisor, admin.
- **Dónde está en la interfaz:** `/alarmas-rondin`, botón "Programación rondines".
- **Archivos:** `src/pages/AlarmasRondin.tsx`.
- **Funciones/hooks:** `fetchServicios`, `updateAlarma`, `togglePermitirIncompleto`.
- **Tablas:** `servicios`.
- **Campos:** `rondin_intervalo_minutos`, `rondin_tolerancia_minutos`, `permitir_rondin_incompleto`.
- **Depende de / de quién depende:** Lo consumen `use-rondin-alarm.ts` y `RondinAlarmMonitor` (montado en `App.tsx`).
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/AlarmasRondin.tsx → updateAlarma` → `servicios` → intervalo/tolerancia → `src/hooks/use-rondin-alarm.ts` (consumidor).
- **Consideraciones:** Módulo separado de Servicios para mayor visibilidad; escribe las mismas columnas.

### Programación de validación de puesto (lado admin)
- **Qué hace:** Crea programaciones de validación (servicio, checkpoint esperado, uno o varios horarios en formato 12 h AM/PM, días de la semana, tolerancia, radio y guardias específicos o todos los del servicio), permite activarlas/desactivarlas y eliminarlas, y consulta los registros ya realizados (foto, ubicación, resultado) con filtros y mapa.
- **Quién puede usarla:** supervisor, admin.
- **Dónde está en la interfaz:** `/validacion-puesto`, pestañas "Programación" y "Validaciones".
- **Archivos:** `src/pages/ValidacionPuesto.tsx`, `src/lib/validacion-puesto.ts`.
- **Componentes:** `MapView` (lazy), `SignedImg`, `BottomNav`.
- **Funciones/hooks:** `cargarConfigs`, `cargarRegistros`, `guardar`, `toggleActivo`, `eliminar`; lib: `listConfigs`, `saveConfig`, `deleteConfig`, `listValidaciones`, `distanciaMetros`, `periodoDelDia`, `horaCorta`.
- **Tablas:** `validacion_puesto_config`, `validaciones_puesto`, `servicios`, `checkpoints`, `profiles`.
- **Campos:** config: `horarios[]` (`HH:MM:SS`), `dias[]` (0–6), `tolerancia_minutos`, `radio_metros`, `guardia_ids[]`, `activo`. Registros: `foto_url`, `lat/lng`, `precision_metros`, `distancia_metros`, `dentro_area`, `resultado`.
- **Servicios/endpoints:** Storage `evidencias` con URLs firmadas; geolocalización del navegador.
- **Seguridad/RLS:** Gestión solo para staff (`Staff gestiona programaciones`); el guardia únicamente lee las activas que le aplican.
- **Depende de / de quién depende:** Su contraparte es `ValidacionPuestoGate` (lado guardia).
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/ValidacionPuesto.tsx → guardar/cargarConfigs` → `src/lib/validacion-puesto.ts → saveConfig/listConfigs` → tablas de configuración y registro → `ValidacionPuestoGate` para el lado guardia.
- **Consideraciones:** Los horarios se capturan en 12 h y se convierten a 24 h (`a24`) antes de guardar; la etiqueta día/noche usa `periodoDelDia` (día 06:00–17:59).

### Gestión de RH (vacaciones, incapacidades, permisos, turnos extra, relevos no cubiertos)
- **Qué hace:** Registra eventos de RH por guardia (turno extra, préstamo con monto, vacaciones, incapacidad y permiso con rango de fechas). Los registros creados por supervisor quedan `pendiente`; los creados por admin quedan `aprobado`. El admin aprueba o rechaza los pendientes. Incluye el bloque "Relevos no cubiertos" con exportación a PDF.
- **Quién puede usarla:** supervisor y admin (crear/consultar); solo admin aprueba o rechaza.
- **Dónde está en la interfaz:** `/gestion-rh`.
- **Archivos:** `src/pages/GestionRH.tsx`, `src/components/RelevosNoCubiertos.tsx`.
- **Funciones/hooks:** `loadData`, `handleSubmit`, `updateStatus`, `useRealtimeTable('registros_rh')`; en el bloque de relevos: `load`, `exportarPdf`.
- **Tablas:** `registros_rh`, `profiles`, `user_roles`, `notificaciones` (tipo `relevo_pendiente`).
- **Campos:** `registros_rh.guardia_id/tipo/fecha/fecha_fin/monto/nota/status/created_by`; `notificaciones.metadata` (turno_id, guardia, servicio, fin_esperado).
- **Servicios/endpoints:** Realtime sobre `registros_rh`; PDF vía `generateReportPdf`; cron `check-relevo-pendiente` alimenta los relevos no cubiertos.
- **Seguridad/RLS:** `registros_rh`: gestión completa para supervisor y admin, lectura propia para el guardia.
- **Depende de / de quién depende:** Los tipos aprobados de vacaciones/incapacidad/permiso los lee `ReporteAsistencias` (y la función `es_ausencia_justificada`) para justificar faltas.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/GestionRH.tsx → handleSubmit/updateStatus` → `registros_rh` → estados pendiente/aprobado/rechazado; `src/pages/ReporteAsistencias.tsx → calcularFaltas` (consumidor).
- **Consideraciones:** El estado inicial según el rol de quien crea es una regla implementada en el frontend.

### Préstamos con flujo de aprobación
- **Qué hace:** Solicitud del guardia (monto, motivo, observaciones) con flujo `pendiente_supervisor` → `pendiente_admin` → `aprobado_transito` → `depositado`, o `rechazado` con motivo. Muestra la bitácora de cada movimiento y avisos de horario de RH.
- **Quién puede usarla:** guardia (crear y ver las suyas), supervisor (primera aprobación o rechazo), admin (segunda aprobación, confirmación de depósito y rechazo).
- **Dónde está en la interfaz:** `/prestamos`, botón "Préstamos" en los tres paneles.
- **Archivos:** `src/pages/Prestamos.tsx`, `src/lib/prestamos.ts`.
- **Funciones/hooks:** `load`, `handleCrear`, `toggleHistorial`, `handleRechazar`; lib: `crearPrestamo`, `aprobarSupervisor`, `aprobarAdmin`, `confirmarDeposito`, `rechazarPrestamo`, `listarPrestamos`, `historialPrestamo`, `avisoTiempoRespuesta`.
- **Tablas:** `prestamos`, `prestamo_historial`, `profiles`, `comunicados`, `notificaciones`.
- **Campos:** `folio, monto, motivo, observaciones, estado, rechazo_motivo, rechazo_comentario, aprobado_supervisor_at, aprobado_admin_at, depositado_at, rechazado_at`.
- **Servicios/endpoints:** RPC `prestamo_crear`, `prestamo_aprobar_supervisor`, `prestamo_aprobar_admin`, `prestamo_confirmar_deposito`, `prestamo_rechazar` (todas `SECURITY DEFINER`), más `prestamo_log` y `prestamo_comunicado_privado`.
- **Seguridad/RLS:** `prestamos` no admite UPDATE ni DELETE desde el cliente: **toda transición de estado ocurre en las RPC**, que validan rol y etapa. `prestamo_historial` es de solo lectura y solo para el guardia dueño, su supervisor y admin.
- **Depende de / de quién depende:** Depende de `profiles.supervisor_asignado_id`; genera comunicados privados y notificaciones en cada etapa.
- **Si quiero modificar esta función, debo revisar/modificar:** las RPC `prestamo_*` (la lógica de negocio vive en la base de datos) → `src/lib/prestamos.ts` (envoltorio) → `src/pages/Prestamos.tsx` (solo UI).
- **Consideraciones:** El rechazo exige motivo del catálogo `MOTIVOS_RECHAZO` (comentario obligatorio si es "Otro"); "aprobado" y "depositado" son estados distintos.

### Reporte de asistencias con exportación
- **Qué hace:** Genera el reporte de asistencias por servicio y rango: entradas/salidas, duración, horas extra y estatus; calcula faltas comparando los días del rango contra las asistencias completas y las cruza con `registros_rh` aprobados para marcarlas como ausencia justificada. Exporta a Excel (dos hojas: Asistencias y Faltas) y a PDF con el logo de la empresa.
- **Quién puede usarla:** supervisor, admin.
- **Dónde está en la interfaz:** `/reporte-asistencias`.
- **Archivos:** `src/pages/ReporteAsistencias.tsx`, `src/lib/asistencias-helpers.ts`, `src/lib/pdf-report.ts`.
- **Funciones/hooks:** `loadServicios`, `generarReporte`, `calcularFaltas`, `exportarExcel`, `exportarPdf`.
- **Tablas:** `asistencias`, `servicios`, `profiles`, `guardia_servicios`, `registros_rh`.
- **Campos:** `asistencias.guardia_id/servicio_id/tipo_turno/inicio/fin/fin_esperado/duracion_minutos/status/observaciones/horas_extra`.
- **Servicios/endpoints:** `xlsx` (SheetJS) para Excel y `generateReportPdf` (jsPDF) para PDF.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/ReporteAsistencias.tsx → calcularFaltas` → `asistencias`/`registros_rh` → lógica de justificación de faltas.
- **Consideraciones:** El cálculo de faltas se hace en el cliente día por día; puede ser costoso en rangos largos.

### Validación de reportes por el supervisor
- **Qué hace:** Lista los reportes de turno enviados por los guardias, filtrables por estado, y permite aprobarlos o devolverlos con retroalimentación, notificando al guardia.
- **Quién puede usarla:** supervisor, admin.
- **Dónde está en la interfaz:** `/reportes-supervisor`.
- **Archivos:** `src/pages/ReportesSupervisor.tsx`.
- **Componentes:** `ReporteDetailDialog`, `BottomNav`.
- **Funciones/hooks:** `loadReports`, `handleApprove`, `handleSendFeedback`, `notifyReporteAprobado`, `notifyReporteRetro`.
- **Tablas:** `reportes_turno`, `profiles`.
- **Campos:** `status`, `revisado_por`, `retroalimentacion`, `incidencias`, `actividades`, `observaciones`, `firmado`.
- **Seguridad/RLS:** Solo supervisor y admin pueden actualizar `reportes_turno`; el registro no se puede borrar.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/ReportesSupervisor.tsx → handleApprove/handleSendFeedback` → `reportes_turno` → estados pendiente/aprobado/retroalimentacion.
- **Consideraciones:** La retroalimentación tiene un límite de 1000 caracteres.

### Métricas operativas
- **Qué hace:** Resumen semanal: rondines de 7 días, incidencias detectadas, gráfico por día y ranking por sitio.
- **Quién puede usarla:** supervisor, admin.
- **Dónde está en la interfaz:** `/metricas`.
- **Archivos:** `src/pages/Metricas.tsx`.
- **Funciones/hooks:** `loadMetrics`.
- **Tablas:** `rondines`, `servicios`, `reportes_turno`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/Metricas.tsx → loadMetrics` → `rondines`/`reportes_turno`.
- **Consideraciones:** Versión simplificada de `EstadisticasAdmin`; "Tiempo Resp." es un marcador de posición.

### Estadísticas generales
- **Qué hace:** Panel histórico de 6 o 12 meses con KPIs mensuales, gráficos de rondines y visitas, tabla resumen, top 5 de guardias y exportación a CSV.
- **Quién puede usarla:** admin.
- **Dónde está en la interfaz:** `/estadisticas`.
- **Archivos:** `src/pages/EstadisticasAdmin.tsx`.
- **Funciones/hooks:** `loadAll`, `exportCSV`.
- **Tablas:** `profiles`, `user_roles`, `rondines`, `visitas`, `emergencias`, `notificaciones`, `reportes_turno`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/EstadisticasAdmin.tsx → loadAll` → tablas operativas → agregación mensual.
- **Consideraciones:** Todo el cálculo es en el cliente sobre el rango completo, sin paginación. Debido a la retención de 30 días, los meses anteriores aparecerán vacíos salvo que se consulten los respaldos.

### Mapa en tiempo real
- **Qué hace:** Muestra en mapa y lista la última ubicación registrada de cada guardia con rondín de hoy, marcando "sin señal" si el dato tiene más de 5 minutos; se actualiza cada minuto y por realtime.
- **Quién puede usarla:** supervisor, admin.
- **Dónde está en la interfaz:** `/mapa`.
- **Archivos:** `src/pages/MapaSupervisor.tsx`.
- **Componentes:** `MapView` (lazy), `AppHeader`, `BottomNav`.
- **Funciones/hooks:** `loadGuards`, `useRealtimeTable('rondines')`, intervalo de 60 s.
- **Tablas:** `rondines`, `profiles`.
- **Campos:** `checkin_lat`, `checkin_lng`, `status`, `created_at`, `guardia_id`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/MapaSupervisor.tsx → loadGuards` → `rondines` → umbral de frescura (`FRESH_MINUTES`).
- **Consideraciones:** Solo aparecen guardias con rondín iniciado hoy; no hay rastreo continuo fuera de los eventos de rondín.

### Actividad por guardia
- **Qué hace:** Vista detallada de un guardia (por query params `id` y `name`) con pestañas de reportes, visitas, RH/préstamos, rondines, alertas de zona y turnos, con diálogos de detalle.
- **Quién puede usarla:** guardia, supervisor, admin (en la práctica se navega desde el AdminDashboard).
- **Dónde está en la interfaz:** `/actividad-guardia?id=...&name=...`, ícono de "ojo" en la lista de usuarios.
- **Archivos:** `src/pages/GuardActivityPage.tsx`.
- **Componentes:** `ReporteDetailDialog`, `VisitaDetailDialog`, `BottomNav`.
- **Funciones/hooks:** `loadTab`.
- **Tablas:** `reportes_turno`, `visitas`, `registros_rh`, `rondines`, `notificaciones`, `turnos`.
- **Seguridad/RLS:** El `guardia_id` viaja por query param, pero la RLS de cada tabla es la que decide qué puede leerse (un guardia no obtiene datos de otro).
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/GuardActivityPage.tsx → loadTab` → tabla de la pestaña correspondiente.
- **Consideraciones:** Límite de 100 registros por pestaña.

### Bitácora de auditoría
- **Qué hace:** Muestra el registro inmutable de eventos (cambios en tablas críticas, inicios/cierres de sesión, exportaciones, aprobaciones, errores) con búsqueda por texto y filtro por tabla; incluye un botón para disparar un respaldo manual.
- **Quién puede usarla:** admin.
- **Dónde está en la interfaz:** `/auditoria`.
- **Archivos:** `src/pages/AuditLog.tsx`, `src/lib/audit.ts`.
- **Funciones/hooks:** `load`, `runBackup`; lib: `logAudit`.
- **Tablas:** `audit_log` (solo lectura).
- **Servicios/endpoints:** Edge function `db-export-backup`; RPC `log_audit_event` para la escritura.
- **Seguridad/RLS:** SELECT solo admin; UPDATE/DELETE bloqueados por trigger.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/audit.ts → logAudit` → RPC `log_audit_event` → `audit_log`; `src/pages/AuditLog.tsx → load` para el filtrado.

### Identidad de marca
- **Qué hace:** Permite subir el logotipo (comprimido automáticamente) y definir la paleta (principal, brillo, acento, fondo, tarjetas) con paletas predefinidas o selectores individuales y vista previa en vivo.
- **Quién puede usarla:** admin.
- **Dónde está en la interfaz:** `/identidad`.
- **Archivos:** `src/pages/Branding.tsx`, `src/lib/branding.tsx`.
- **Funciones/hooks:** `handleLogo`, `save`, `resetDefaults`; lib: `applyBrandingColors`, `hexToHsl`, `hslToHex`, `signLogo`.
- **Tablas:** `branding` (fila única).
- **Servicios/endpoints:** Storage `branding`; `compressImage`.
- **Depende de / de quién depende:** El `BrandingProvider` global pinta toda la app y los PDFs (`pdf-report.ts`) usan el logo y el color corporativo.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/Branding.tsx → save/handleLogo` → tabla `branding` → `src/lib/branding.tsx → BrandingProvider`.
- **Consideraciones:** El cambio aplica a todos los usuarios; no es una preferencia personal.

### Teléfonos de los botones del sitio (soporte y emergencia)
- **Qué hace:** Configura el número de WhatsApp que recibe los reportes de falla del botón de ayuda (con validación y prueba de envío) y administra los números de llamada directa del panel de emergencia (etiqueta, descripción, número, activo, orden).
- **Quién puede usarla:** admin.
- **Dónde está en la interfaz:** `/soporte-config`.
- **Archivos:** `src/pages/SoporteConfig.tsx`, `src/components/admin/NumerosEmergenciaEditor.tsx`, `src/lib/soporte-config.ts`.
- **Funciones/hooks:** `guardar`; lib: `fetchSoporteWhatsapp`, `setSoporteWhatsapp`, `formatSoporteWhatsapp`, `normalizarNumero`, `construirEnlaceWhatsapp`; editor: `cargar`, `guardar`, `agregar`, `eliminar`.
- **Tablas:** `branding.soporte_whatsapp`, `numeros_emergencia`.
- **Campos:** `numeros_emergencia.label/descripcion/numero/orden/activo`.
- **Seguridad/RLS:** Escritura solo admin en ambas tablas; `numeros_emergencia` es de lectura para cualquier autenticado.
- **Depende de / de quién depende:** Lo consumen `SoporteChat` (global) y `EmergencyButton`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/soporte-config.ts → setSoporteWhatsapp/fetchSoporteWhatsapp` → `branding.soporte_whatsapp`; `NumerosEmergenciaEditor` → `numeros_emergencia`.
- **Consideraciones:** A los números de 10 dígitos se les antepone la LADA 52.

### Cuadro de honor (consulta)
- **Qué hace:** Ranking de guardias por puntos acumulados en tres periodos (hoy/semana/mes), con insignias, podio y los reconocimientos publicados (incluido el bono si aplica).
- **Quién puede usarla:** guardia, supervisor, admin.
- **Dónde está en la interfaz:** `/cuadro-honor`.
- **Archivos:** `src/pages/CuadroHonor.tsx`, `src/lib/goals-helpers.ts`, `src/lib/reconocimientos.ts`.
- **Funciones/hooks:** `load`; lib: `listarReconocimientos`, `formatMoneda`.
- **Tablas:** `cuadro_honor`, `profiles`, `reconocimientos`.
- **Campos:** `cuadro_honor.fecha/rondines_completados/reportes_completados/puntos/insignias`.
- **Seguridad/RLS:** El guardia ve sus propias filas de `cuadro_honor`; supervisor y admin ven todas; los reconocimientos publicados son visibles para todos.
- **Depende de / de quién depende:** Las filas de `cuadro_honor` las escribe `upsertCuadroHonorIfMet` desde `DailyProgress` cuando el guardia cumple su meta.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/CuadroHonor.tsx → load` → `cuadro_honor`/`reconocimientos` → agregación por periodo; `src/lib/goals-helpers.ts → upsertCuadroHonorIfMet` para cómo se generan los puntos.
- **Consideraciones:** El ranking se agrega en el cliente sumando los registros diarios del periodo.

### Reconocimientos con bono
- **Qué hace:** Registra un reconocimiento (guardia, posición, periodo, motivo). El cumplimiento de metas (0–100 %) se calcula con una función de base de datos y el bono **solo se otorga a la posición #1 con 100 % de cumplimiento**. Al publicar se notifica a todo el personal y se genera un comunicado automático.
- **Quién puede usarla:** supervisor, admin.
- **Dónde está en la interfaz:** `/reconocimientos`.
- **Archivos:** `src/pages/Reconocimientos.tsx`, `src/lib/reconocimientos.ts`.
- **Funciones/hooks:** `load`, `handleCrear`, `handlePublicar`, `handleEliminar`; lib: `crearReconocimiento`, `actualizarReconocimiento`, `eliminarReconocimiento`, `publicarReconocimiento`, `obtenerCumplimiento`, `esElegibleBono`, `normalizarBono`.
- **Tablas:** `reconocimientos`, `cuadro_honor`, `notificaciones`, `comunicados`, `profiles`.
- **Campos:** `guardia_id, posicion, periodo, motivo, bono, publicado, publicado_at, created_by`.
- **Servicios/endpoints:** RPC `cumplimiento_metas_guardia` (cálculo) y RPC `publicar_reconocimiento` (`SECURITY DEFINER`).
- **Seguridad/RLS:** La regla del bono se aplica **en el servidor**: `publicar_reconocimiento` recalcula el cumplimiento y fija `bono = 0` salvo posición 1 con cumplimiento ≥ 100 %. El frontend solo replica la validación para dar retroalimentación inmediata.
- **Si quiero modificar esta función, debo revisar/modificar:** RPC `publicar_reconocimiento` y `cumplimiento_metas_guardia` (regla real del bono) → `src/lib/reconocimientos.ts → esElegibleBono/normalizarBono` (validación de UI) → `src/pages/Reconocimientos.tsx`.
- **Consideraciones:** Al publicar se crean tanto notificaciones como un comunicado con el resultado y el bono.
## 4. Comunicación, notificaciones, emergencias, portal cliente e infraestructura

### Chat operativo
- **Qué hace:** Mensajería 1 a 1 entre empleados. Cada usuario ve una lista de contactos filtrada por su rol, abre un hilo y envía/recibe mensajes en tiempo real; los recibidos se marcan como leídos al abrir el hilo.
- **Quién puede usarla:** guardia, supervisor, admin (el cliente no tiene acceso).
- **Dónde está en la interfaz:** `/chat`, desde el BottomNav y desde el banner de mensajes sin leer.
- **Archivos:** `src/pages/Chat.tsx`, `src/hooks/use-chat-notifications.tsx`, `src/components/UnreadMessagesBanner.tsx`.
- **Funciones/hooks:** `loadContacts`, `loadMessages`, `sendMessage`, `useChatNotifications` (canal único `global-chat-notif-{userId}`, evento `chat:read`).
- **Tablas/campos:** `chat_messages` (`sender_id`, `receiver_id`, `message`, `read`, `created_at`); `profiles`, `user_roles` para contactos.
- **Seguridad/RLS:** SELECT si el usuario es emisor o receptor; INSERT solo como emisor; UPDATE solo el receptor y **solo la columna `read`** (grant por columna + trigger `chat_messages_only_read_update`). El filtrado por rol de la lista de contactos es de frontend.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/Chat.tsx → loadContacts/sendMessage` → `chat_messages` → filtros por rol; `src/hooks/use-chat-notifications.tsx → refreshUnread` → contador global.
- **Consideraciones:** La suscripción realtime es única por página (no depende del contacto seleccionado) para evitar duplicados.

### Chat RH confidencial con folios
- **Qué hace:** Canal privado con RH por tema (nómina, permisos, incapacidad, conflicto, dudas). Cada conversación genera un folio `RH-<timestamp>` y admite marcar mensajes como confidenciales.
- **Quién puede usarla:** guardia, supervisor, admin (cada quien ve solo lo suyo; admin ve todo).
- **Dónde está en la interfaz:** `/chat-rh`.
- **Archivos:** `src/pages/ChatRH.tsx`.
- **Tablas/campos:** `chat_rh` (`user_id`, `topic`, `folio`, `message`, `sender`, `confidential`, `created_at`).
- **Seguridad/RLS:** el usuario gestiona (ALL) sus registros; admin puede leer todos.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/pages/ChatRH.tsx → loadMessages/sendMessage` → `chat_rh` → folio y bandera confidencial.
- **Consideraciones:** El folio se genera en el cliente; los botones "Adjuntar" y "Solicitar cita" están en la UI sin lógica implementada.

### Comunicados
- **Qué hace:** Avisos internos con título, contenido, prioridad e imagen. Se pueden guardar como borrador, programar (`publicar_at`) o publicar de inmediato notificando a los guardias; la lectura de cada usuario queda registrada. Existen además comunicados privados dirigidos a un solo usuario (`destinatario_id`), usados por el flujo de préstamos.
- **Quién puede usarla:** crear/gestionar → admin (todos) y supervisor (solo generales); leer → todos los roles.
- **Dónde está en la interfaz:** `/comunicados`.
- **Archivos:** `src/pages/Comunicados.tsx`, `src/lib/comunicados.ts`.
- **Funciones:** `listarComunicados`, `crearComunicado`, `actualizarComunicado`, `eliminarComunicado`, `publicarComunicado` (RPC), `subirImagenComunicado`, `marcarLeido`, `misLecturas`, `conteoLecturas`.
- **Tablas/campos:** `comunicados` (`titulo`, `contenido`, `prioridad`, `imagen_url`, `estado`, `publicar_at`, `publicado_at`, `autor_id`, `autor_nombre`, `destinatario_id`), `comunicado_lecturas` (`comunicado_id`, `user_id`, `leido_at`).
- **Servicios/endpoints:** RPC `publicar_comunicado`, RPC `publicar_comunicados_programados` (cron cada 5 min), RPC `prestamo_comunicado_privado`.
- **Seguridad/RLS:** SELECT si `estado='publicado'` y (`destinatario_id` nulo o igual al usuario); admin gestiona todo; supervisor solo los generales.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/comunicados.ts → crearComunicado/publicarComunicado` → `comunicados`/`comunicado_lecturas` → estados borrador/programado/publicado.
- **Consideraciones:** Las imágenes se comprimen y se guardan en el bucket privado `evidencias`.

### Centro de notificaciones
- **Qué hace:** Historial de alertas categorizado (emergencia, novedades, turnos, operación, visitas, accesos, sistema) y por severidad, con filtro, marcado de leído y toggle de sonido.
- **Quién puede usarla:** todos; admin y supervisor ven las de todos los guardias, el resto solo las propias.
- **Dónde está en la interfaz:** `/notificaciones`.
- **Archivos:** `src/pages/Notificaciones.tsx`, `src/lib/notification-types.ts`, `src/lib/notification-helpers.ts`, `src/hooks/use-realtime.ts`.
- **Funciones/hooks:** `useRealtimeTable('notificaciones')`, `getNotifMeta`, `createNotification` y los helpers `notifyX`.
- **Tablas/campos:** `notificaciones` (`tipo`, `mensaje`, `guardia_id`, `supervisor_id`, `leida`, `foto_url`, `metadata`, `created_at`).
- **Seguridad/RLS:** guardias ven las propias; supervisor/admin ven todas; cualquier autenticado inserta; no se puede borrar.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/notification-types.ts → NOTIF_TYPES` (catálogo de icono/color/categoría/severidad) → `src/lib/notification-helpers.ts → createNotification` → `notificaciones` → `src/pages/Notificaciones.tsx`.
- **Consideraciones:** Todo tipo nuevo debe añadirse a `NOTIF_TYPES` o cae en el fallback genérico; `createNotification` pasa por la cola offline y dispara push en paralelo.

### Banners de no leídos
- **Qué hace:** Avisos en el inicio: "Tienes N alertas por revisar" y "Tienes N mensajes sin leer", que desaparecen al leer.
- **Quién puede usarla:** todos (el conteo de alertas respeta el filtro por rol).
- **Dónde está en la interfaz:** dashboard principal.
- **Archivos:** `src/components/UnreadAlertsBanner.tsx`, `src/components/UnreadMessagesBanner.tsx`.
- **Tablas:** `notificaciones` (conteo exacto con `head: true`), `chat_messages` (vía `useChatNotifications`).
- **Si quiero modificar esta función, debo revisar/modificar:** `src/components/UnreadAlertsBanner.tsx → refresh()` → `notificaciones` → conteo por rol.

### Sonido de alertas
- **Qué hace:** Genera con WebAudio un tono por severidad ante cada notificación nueva, muestra un toast con acción "Ver" y vibra en severidades altas.
- **Quién puede usarla:** todos (mismo filtro por rol).
- **Dónde está en la interfaz:** global (montado en `App.tsx`); el interruptor está en `/notificaciones`.
- **Archivos:** `src/components/GlobalAlertSound.tsx`, `src/lib/alert-sound.ts`.
- **Funciones:** `initAlertSound`, `playAlertSound`, `isAlertSoundEnabled`, `setAlertSoundEnabled` (persistido en `localStorage`).
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/alert-sound.ts → PATTERNS` → tonos por severidad; `GlobalAlertSound.tsx → canal alertas-sonido` → `notificaciones`.
- **Consideraciones:** El audio requiere un primer gesto del usuario; el silencio se guarda por dispositivo.

### Push web (VAPID)
- **Qué hace:** Notificaciones del sistema operativo con la app cerrada. El usuario activa push por dispositivo y cada notificación de negocio envía un push a los endpoints registrados.
- **Quién puede usarla:** cualquier usuario en navegador compatible (en iOS requiere instalar la PWA, 16.4+).
- **Dónde está en la interfaz:** tarjeta `PushToggle` en configuración/perfil.
- **Archivos:** `src/components/PushToggle.tsx`, `src/lib/push-notifications.ts`, `public/push-handler.js`, `supabase/functions/get-vapid-public-key`, `generate-vapid-keys`, `send-push`.
- **Funciones:** `enablePush`, `disablePush`, `isPushEnabled`, `isPushSupported`, `sendPushTo`.
- **Tablas/campos:** `push_subscriptions` (`user_id`, `endpoint` único, `p256dh`, `auth`, `user_agent`, `last_seen_at`).
- **Seguridad:** `send-push` usa `service_role` y elimina suscripciones caducas (404/410); requiere los secretos `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/push-notifications.ts → enablePush/sendPushTo` → `push_subscriptions`; `supabase/functions/send-push/index.ts` → envío real.

### Botón de emergencia y números directos
- **Qué hace:** Botón de pánico disponible en la app operativa: captura GPS, inserta en `emergencias` y, si falla el GPS, genera además la alerta "guardia no ubicable". Muestra los números de emergencia configurables con marcado directo (`tel:`).
- **Quién puede usarla:** guardia, supervisor, admin.
- **Dónde está en la interfaz:** botón flotante persistente; los números se administran en `/soporte-config`.
- **Archivos:** `src/components/EmergencyButton.tsx`, `src/lib/notification-helpers.ts` (`notifySinUbicacion`).
- **Tablas/campos:** `emergencias` (`guardia_id`, `tipo`, `lat`, `lng`, `atendida`), `numeros_emergencia`.
- **Seguridad/RLS:** el guardia inserta y ve las propias; supervisor y admin ven todas; el cliente ve las de sus guardias.
- **Si quiero modificar esta función, debo revisar/modificar:** `EmergencyButton.tsx → handleEmergency` → `emergencias`/`numeros_emergencia`.

### Chat de soporte por WhatsApp
- **Qué hace:** Widget de ayuda que arma un reporte de falla (categoría, descripción, nombre, servicio, ruta y datos del dispositivo) y lo envía por WhatsApp al número configurado; si el navegador bloquea la apertura, ofrece enlace y copiar mensaje.
- **Quién puede usarla:** cualquier usuario autenticado (montado globalmente).
- **Dónde está en la interfaz:** botón flotante en toda la app; el número solo se edita en `/soporte-config` (admin).
- **Archivos:** `src/components/SoporteChat.tsx`, `src/lib/soporte-config.ts`, `src/lib/device-info.ts`.
- **Si quiero modificar esta función, debo revisar/modificar:** `SoporteChat.tsx → enviar()` → construcción del mensaje y enlace `wa.me`.
- **Consideraciones:** No se guarda registro interno del reporte; todo sale por WhatsApp.

### Portal del cliente — Dashboard
- **Qué hace:** Panel ejecutivo del rol cliente con filtro por servicio y fechas: KPIs (rondines, cumplimiento, incidencias, guardias activos), gráficas, semáforo por servicio, top de guardias puntuales y exportación a Excel y PDF con la marca.
- **Quién puede usarla:** cliente, limitado a sus servicios en `cliente_servicios`.
- **Archivos:** `src/pages/ClienteDashboard.tsx`, `src/lib/cliente-report-config.ts`, `src/lib/pdf-report.ts`.
- **Tablas:** `cliente_servicios`, `servicios`, `guardia_servicios`, `rondines`, `turnos`, `profiles`, `reportes_turno`, `cliente_reporte_config`.
- **Seguridad/RLS:** el cliente solo ve sus filas de `cliente_servicios` y los datos de esos servicios.
- **Si quiero modificar esta función, debo revisar/modificar:** `ClienteDashboard.tsx → loadAll/kpis` → tablas operativas → cálculo de KPIs.
- **Consideraciones:** Las consultas iniciales se acotan a 90 días; sin servicios asignados se muestra pantalla vacía.

### Portal del cliente — Datos capturados
- **Qué hace:** Pestaña "Datos" con tablas de todos los registros habilitados por el admin (turnos, asistencias, rondines, novedades, visitas, validaciones, sesiones, alertas, comunicados) con miniaturas de evidencia y exportación a PDF.
- **Archivos:** `src/components/cliente/DatosCapturadosTab.tsx`, `src/lib/cliente-datos-capturados.ts`.
- **Funciones:** `cargarDatosCapturados(clienteId, desde, hasta, config, servicioFiltro)` → `BloqueDatos[]`.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/cliente-datos-capturados.ts → cargarDatosCapturados` → tablas operativas; `cliente-report-config.ts → REPORT_SECTIONS`.
- **Consideraciones:** Solo se muestran bloques con datos; el PDF depende de `show_export_pdf`.

### Portal del cliente — Reporte personalizado
- **Qué hace:** Editor (admin) de un reporte narrativo por cliente y periodo con secciones activables que combinan texto libre e indicadores; se guarda como borrador o se publica. El cliente solo lista y descarga los publicados.
- **Archivos:** `src/components/cliente/ReportePersonalizadoTab.tsx`, `src/lib/cliente-reporte-personalizado.ts`.
- **Funciones:** `listarReportes`, `guardarReporte`, `eliminarReporte`, `buildMetrics`, `descargarReportePersonalizadoPdf`, `seccionesPorDefecto`.
- **Tablas/campos:** `cliente_reportes` (`titulo`, `periodo_inicio/fin`, `estado`, `secciones` jsonb, `servicio_id`, `autor_id/nombre`, `publicado_at`).
- **Si quiero modificar esta función, debo revisar/modificar:** `cliente-reporte-personalizado.ts → guardarReporte/buildMetrics` → `cliente_reportes` → secciones y métricas.

### Portal del cliente — Configuración de visibilidad (admin)
- **Qué hace:** Panel donde el admin elige, cliente por cliente, qué KPIs, gráficas, listados y datos son visibles (más de 30 interruptores) y accede al editor de reporte de ese cliente.
- **Quién puede usarla:** solo admin.
- **Dónde está en la interfaz:** `/cliente-reporte-config`.
- **Archivos:** `src/pages/ClienteReporteConfig.tsx`, `src/lib/cliente-report-config.ts`.
- **Tablas:** `cliente_reporte_config` (una fila por `cliente_id`, columnas `show_*`), upsert con `onConflict: 'cliente_id'`.
- **Si quiero modificar esta función, debo revisar/modificar:** añadir columna `show_*` en la tabla → entrada en `REPORT_SECTIONS` → consumo en `ClienteDashboard`/`DatosCapturadosTab`.
- **Consideraciones:** Sin fila para el cliente se aplican los valores por defecto (todo visible).

### PWA y funcionamiento offline
- **Qué hace:** La app se instala como PWA (manifest, iconos, `start_url=/dashboard`) con Service Worker Workbox (`NetworkFirst` para navegación) y encola escrituras y fotos mientras no hay red, reintentando al reconectar.
- **Archivos:** `vite.config.ts`, `public/push-handler.js`, `src/hooks/use-online-status.ts`, `src/lib/realtime.ts`, `src/App.tsx` (`initOfflineQueue`, `initPhotoQueue`), `ConnectionBanner`, `OfflineQueueIndicator`.
- **Funciones/hooks:** `useOnlineStatus` (eventos del navegador + sondeo de sesión cada 15 s), `subscribeTable`/`recoverAll` (un canal por tabla, recuperación al volver online o al enfocar la pestaña).
- **Si quiero modificar esta función, debo revisar/modificar:** `vite.config.ts → VitePWA` (manifest y caché); `src/lib/realtime.ts → subscribeTable/recoverAll`.
- **Consideraciones:** El precache admite hasta 8 MB por archivo; `/~oauth` y `/api` quedan fuera del `navigateFallback`.

### Retención de datos (30 días)
- **Qué hace:** Job diario que elimina todo dato operativo con más de 30 días, incluidas las fotos en Storage.
- **Archivos:** `supabase/functions/purge-retention/index.ts`, `supabase/functions/_shared/retention.ts` (`RETENTION_DAYS = 30`, `RETENTION_TARGETS`).
- **Tablas afectadas:** `rondin_scans`, `rondin_alarmas`, `rondines`, `asistencias`, `faltas`, `notas_relevo`, `turnos`, `cuadro_honor`, `reportes_turno`, `novedades`, `pendientes_completados`, `notificaciones`, `emergencias`, `visitas`, `sesion_registros`, `validaciones_puesto`, `chat_messages`, `comunicado_lecturas`.
- **Nunca se borra:** `profiles`, `user_roles`, `servicios`, catálogos, configuración y `audit_log`.
- **Dónde se consulta:** sin UI; el resumen queda en `audit_log` (`retencion_purga`), visible en `/auditoria`.
- **Si quiero modificar esta función, debo revisar/modificar:** `_shared/retention.ts → RETENTION_TARGETS/RETENTION_DAYS` → tablas listadas; `purge-retention/index.ts → purgeTarget`.
- **Consideraciones:** Procesa en páginas de 500 filas; si una tabla falla, el resto continúa y el error se registra.

### Respaldos programados
- **Qué hace:** Exportación semanal (pg_cron) o manual de las tablas clave a JSON en el bucket privado `backups`, en carpetas `YYYY-MM-DD/` con `manifest.json`; purga carpetas de más de 90 días.
- **Archivos:** `supabase/functions/db-export-backup/index.ts`.
- **Si quiero modificar esta función, debo revisar/modificar:** `db-export-backup/index.ts → TABLES` → tablas respaldadas.
- **Consideraciones:** Incluye `chat_messages` y `chat_rh`, por lo que el bucket debe permanecer privado.

### Correos transaccionales
- **Qué hace:** Procesa las colas `auth_emails` (prioritaria) y `transactional_emails` con `pgmq`: reintentos, TTL por cola, manejo de 429/403, deduplicación por `message_id` y cola muerta tras 5 intentos.
- **Archivos:** `supabase/functions/process-email-queue/index.ts`.
- **Tablas/RPC:** `email_send_state`, `email_send_log`, `email_unsubscribe_tokens`, `suppressed_emails`; RPC `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`.
- **Seguridad:** solo invocable con `service_role` (verifica claims del JWT).
- **Si quiero modificar esta función, debo revisar/modificar:** `process-email-queue/index.ts` → `email_send_state`/`email_send_log` → reintentos, TTL y DLQ.

### Servidor MCP (Guardian Connect)
- **Qué hace:** Expone herramientas a clientes MCP autenticados por OAuth para consultar datos operativos en nombre del usuario, respetando su RLS.
- **Archivos:** `src/lib/mcp/index.ts`, `src/lib/mcp/supabase.ts`, `src/lib/mcp/tools/*.ts`, `supabase/functions/mcp/index.ts` (autogenerado), `src/pages/OAuthConsent.tsx`.
- **Tools:** `list_servicios`, `list_asistencias`, `list_reportes_turno`, `list_visitas`, `list_alertas`, `crear_pendiente_puesto`.
- **Seguridad:** `supabaseForUser` reenvía el token del usuario (nunca `service_role`), por lo que aplica la RLS normal.
- **Si quiero modificar esta función, debo revisar/modificar:** `src/lib/mcp/tools/*.ts → defineTool` → tabla correspondiente → registrar en `src/lib/mcp/index.ts` (el bundle de `supabase/functions/mcp` se regenera solo).

## 5. Catálogo de notificaciones

| Evento | Lógica que la genera | Tabla | Destinatario | Módulo donde aparece |
|---|---|---|---|---|
| Inicio de sesión | `notification-helpers.ts → notifySesionInicio` | `notificaciones` (`sesion`) | El propio usuario | Notificaciones, Registros de sesión |
| Cierre de sesión | `notifySesionCierre` | `notificaciones` (`sesion`) | El propio usuario | Notificaciones, Registros de sesión |
| Cierre de sesión con turno activo | `notifySesionCierreEnTurno` | `notificaciones` (`sesion_en_turno`) | Usuario, visible a supervisor/admin | Notificaciones |
| Validación fotográfica de acceso | `notifySesionValidacion` | `notificaciones` (`sesion`) | El propio usuario | Registros de sesión |
| Inicio de turno | `notifyTurnoInicio` | `notificaciones` (`turno_inicio`) | Guardia, visible a supervisor/admin | Notificaciones, Dashboard operativo |
| Fin de turno | `notifyTurnoFin` | `notificaciones` (`turno_fin`) | Guardia, visible a supervisor/admin | Notificaciones, Dashboard operativo |
| Check-in de rondín | `notifyRondinCheckIn` | `notificaciones` (`rondin`) | Guardia, visible a supervisor/admin | Notificaciones, Rondines |
| Punto de rondín verificado | `notifyRondinPunto` | `notificaciones` (`rondin`) | Guardia, visible a supervisor/admin | Notificaciones, Rondines |
| Check-out de rondín | `notifyRondinCheckOut` | `notificaciones` (`rondin`) | Guardia, visible a supervisor/admin | Notificaciones, Rondines |
| Alarma de rondín programada | `use-rondin-alarm.ts` + `notification-helpers` (`rondin_alarma`) | `notificaciones`, `rondin_alarmas` | Guardia (y supervisor si no responde en 3 min) | Modal bloqueante, Notificaciones |
| Salida de zona | `notifyZonaExit` | `notificaciones` (`zona`) | Guardia, visible a supervisor/admin | Notificaciones, Mapa supervisor |
| Guardia sin ubicación | `notifySinUbicacion` | `notificaciones` (`sin_ubicacion`) | Guardia, visible a supervisor/admin | Notificaciones, Emergencias |
| Incidencia registrada | `notifyIncidencia` | `notificaciones` (`incidencia`) | Guardia, visible a supervisor/admin | Notificaciones, Reportes |
| Reporte aprobado | `notifyReporteAprobado` | `notificaciones` (`reporte`) | Guardia y supervisor | Reportes supervisor |
| Reporte con retroalimentación | `notifyReporteRetro` | `notificaciones` (`reporte`) | Guardia y supervisor | Reportes supervisor |
| Entrada de visita | `notifyVisitaEntrada` | `notificaciones` (`visita`) | Guardia, visible a supervisor/admin/cliente | Visitas |
| Visita completa | `notifyVisitaEntradaSalida` | `notificaciones` (`visita`) | Guardia, visible a supervisor/admin/cliente | Visitas |
| Relevo no cubierto | `notifyRelevoPendiente` (cron `check-relevo-pendiente`) | `notificaciones` (`relevo_pendiente`) | Supervisores y admin | Gestión RH → Relevos no cubiertos |
| Novedad de turno | `notifyNovedad` (importante = false) | `notificaciones` (`novedad`) | Guardia y supervisor asignado | Novedades |
| Novedad importante | `notifyNovedad` (importante = true) | `notificaciones` (`novedad_importante`) | Guardia y supervisor asignado | Novedades |
| Validación de puesto correcta | `notifyValidacionPuesto` (`valida`) | `notificaciones` (`validacion_puesto`) | Guardia y supervisor | Validación de puesto |
| Validación de puesto fallida | `notifyValidacionPuesto` (`fuera_area`/`sin_ubicacion`) | `notificaciones` (`validacion_puesto_fallida`) | Guardia y supervisor | Validación de puesto |
| Comunicado publicado | RPC `publicar_comunicado` | `notificaciones` (`comunicado`) | Guardias o el destinatario privado | Comunicados |
| Reconocimiento publicado | RPC `publicar_reconocimiento` | `notificaciones` (`reconocimiento`) + `comunicados` | Todo el personal | Cuadro de honor |
| Préstamo (alta, aprobación, rechazo, depósito) | RPC `prestamo_*` → `prestamo_comunicado_privado` | `notificaciones` (`prestamo`) + `comunicados` privado | Guardia, su supervisor y admin según la etapa | Préstamos, Comunicados |
| Mensaje de chat nuevo | `use-chat-notifications.tsx` (realtime, sin fila en `notificaciones`) | `chat_messages` | Receptor | Chat |
## 6. Flujos completos paso a paso

### 6.1 Inicio de sesión → rol → dashboard

```text
/login (src/pages/Login.tsx)
  → supabase.auth.signInWithPassword()          [Auth de Lovable Cloud]
  → AuthProvider (src/lib/auth-context.tsx) recibe onAuthStateChange
      · guarda session/user
      · consulta public.user_roles (role del usuario)
      · consulta public.profiles (nombre, avatar, servicio_asignado_id, status)
  → SessionCaptureGate: exige foto en vivo + GPS
      · sube a Storage bucket `evidencias`
      · INSERT public.sesion_registros (evento='login', foto_url, lat, lng,
        precision_metros, dispositivo)
  → /dashboard (src/pages/Dashboard.tsx) redirige según rol:
      guardia → GuardDashboard | supervisor → SupervisorDashboard
      admin → AdminDashboard   | cliente  → ClienteDashboard
  → ProtectedRoute valida rol en cada navegación posterior
```

### 6.2 Registro con NIP

```text
/registro (src/pages/Register.tsx)
  → RPC validate_registration_nip(code)  → devuelve app_role o lanza excepción
  → supabase.auth.signUp()
  → trigger auth.users.on_auth_user_created → handle_new_user()
      · INSERT public.profiles
      · INSERT public.user_roles (siempre 'guardia' de inicio)
  → RPC consume_registration_nip(code, user_id)
      · marca registration_nips.used/used_by/used_at
      · reemplaza public.user_roles con el rol del NIP
  → sesión iniciada → /dashboard
```

### 6.3 Turno del guardia

```text
GuardDashboard → ShiftControl (src/components/ShiftControl.tsx)
  Iniciar: INSERT public.turnos (status='activo') + INSERT public.asistencias
           (tipo_turno del servicio, inicio, fin_esperado calculado)
           + notificación al supervisor/admin (public.notificaciones)
  Durante: rondines, novedades, visitas, pendientes, validaciones de puesto
  Finalizar: UPDATE turnos.fin/status, UPDATE asistencias
           (fin, duracion_minutos, horas_extra, status)
           + nota de relevo opcional (public.notas_relevo)
  Sin cierre: edge function `auto-close-shifts` (cron horario) cierra el turno
  Sin relevo: edge function `check-relevo-pendiente` (cron cada minuto) avisa
```

### 6.4 Rondín con evidencia por punto

```text
/rondines → INSERT public.rondines (status, checkin_at, checkin_lat/lng)
  por cada checkpoint: validación de distancia (haversine) contra
  checkpoints.lat/lng y radius_metros
  → foto (Storage `evidencias`) + observación + estado
  → INSERT public.rondin_scans (rondin_id, checkpoint_id, foto_url,
    observacion, estado, lat, lng, scanned_at)
  → cierre: UPDATE rondines.checkout_at/status/reporte
  → notificación a supervisores (public.notificaciones)
```

### 6.5 Alarma programada de rondín

```text
/alarmas-rondin (admin/supervisor) define intervalo y tolerancia por servicio
  → servicios.rondin_intervalo_minutos / rondin_tolerancia_minutos
  → src/hooks/use-rondin-alarm.ts calcula el siguiente disparo
  → INSERT/UPDATE public.rondin_alarmas (scheduled_at, notified_at)
  → RondinAlarmMonitor muestra pantalla bloqueante con cuenta regresiva
  → respuesta: responded_at, delay_seconds, cumplido
  → sin respuesta: falta_generada + alerta al supervisor
```

### 6.6 Validación de puesto programada

```text
/validacion-puesto (admin/supervisor) crea public.validacion_puesto_config
  (horarios[], dias[], tolerancia_minutos, radio_metros, guardia_ids[], checkpoint_id)
  → ValidacionPuestoGate + src/lib/validacion-puesto.ts (slotVigente)
  → al llegar la hora: pantalla bloqueante con cámara en vivo
  → registrarValidacion(): sube foto, captura GPS, calcula distanciaMetros()
  → INSERT public.validaciones_puesto con resultado
    'valida' | 'fuera_area' | 'sin_ubicacion'
  → consulta posterior en la misma pantalla /validacion-puesto
```

### 6.7 Solicitud de préstamo

```text
/prestamos (guardia) → RPC prestamo_crear(monto, motivo, observaciones)
  · genera folio, estado='pendiente_supervisor'
  · prestamo_log() → public.prestamo_historial
  · prestamo_comunicado_privado() → public.comunicados (destinatario_id) +
    public.notificaciones
Supervisor → RPC prestamo_aprobar_supervisor  → estado='pendiente_admin'
Admin      → RPC prestamo_aprobar_admin       → estado='aprobado_transito'
Admin      → RPC prestamo_confirmar_deposito  → estado='depositado'
Cualquiera autorizado → RPC prestamo_rechazar → estado='rechazado'
Cada paso escribe en prestamo_historial y notifica de forma PRIVADA.
```

### 6.8 Comunicado

```text
/comunicados (admin/supervisor) → INSERT public.comunicados (estado
  'borrador' | 'programado' | 'publicado')
  → publicación inmediata: RPC publicar_comunicado(id)
  → publicación programada: cron `publicar-comunicados-programados`
    (cada 5 min) → publicar_comunicados_programados()
  → ambos llaman notificar_comunicado(id) → INSERT public.notificaciones
    para guardia/supervisor/admin
  → lectura del usuario → INSERT public.comunicado_lecturas
```

### 6.9 Portal del cliente

```text
Login del cliente → Dashboard → ClienteDashboard
  → public.cliente_servicios define qué servicios ve
  → public.cliente_reporte_config define qué bloques se muestran
  → funciones cliente_has_servicio() / cliente_has_guardia() habilitan las
    políticas RLS de lectura sobre datos operativos
  → pestaña REPORTE → public.cliente_reportes (solo lectura si estado='publicado')
```

### 6.10 Purga de retención (30 días)

```text
cron `purge-retention-daily` (03:30) → edge function purge-retention
  → recorre RETENTION_TARGETS de supabase/functions/_shared/retention.ts
  → borra primero los objetos de Storage (evidencias, visitas, pendientes)
  → luego elimina las filas anteriores a RETENTION_DAYS (30)
  → NO toca profiles, user_roles, servicios, checkpoints, metas, catálogos,
    NIPs, branding, configuración ni audit_log
```
## 7. Base de datos

### 7.1 Tablas por dominio

| Dominio | Tablas |
| --- | --- |
| Identidad y acceso | `profiles`, `user_roles`, `registration_nips`, `sesion_registros`, `push_subscriptions` |
| Catálogo operativo | `servicios`, `checkpoints`, `guardia_servicios`, `cliente_servicios`, `metas_servicio`, `pendientes_puesto`, `numeros_emergencia`, `branding` |
| Turnos y asistencia | `turnos`, `asistencias`, `faltas`, `notas_relevo` |
| Rondines | `rondines`, `rondin_scans`, `rondin_alarmas` |
| Validación de puesto | `validacion_puesto_config`, `validaciones_puesto` |
| Reportes | `reportes_turno`, `novedades`, `pendientes_completados`, `visitas` |
| RH y préstamos | `registros_rh`, `prestamos`, `prestamo_historial` |
| Comunicación | `chat_messages`, `chat_rh`, `comunicados`, `comunicado_lecturas`, `notificaciones`, `emergencias` |
| Reconocimientos | `cuadro_honor`, `reconocimientos` |
| Cliente | `cliente_reporte_config`, `cliente_reportes` |
| Correo | `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails` |
| Cumplimiento | `audit_log` |

Tipo enumerado: `app_role = ('guardia','supervisor','admin','cliente')`.

### 7.2 Llaves foráneas reales

```text
profiles.user_id                 -> auth.users.id
profiles.servicio_asignado_id    -> servicios.id
profiles.supervisor_asignado_id  -> profiles.user_id
user_roles.user_id               -> auth.users.id
checkpoints.servicio_id          -> servicios.id
guardia_servicios.servicio_id    -> servicios.id
metas_servicio.servicio_id       -> servicios.id
turnos.servicio_id               -> servicios.id
rondines.guardia_id              -> auth.users.id
rondines.servicio_id             -> servicios.id
rondin_scans.rondin_id           -> rondines.id
rondin_scans.checkpoint_id       -> checkpoints.id
rondin_alarmas.servicio_id       -> servicios.id
novedades.servicio_id            -> servicios.id
notas_relevo.servicio_id         -> servicios.id
visitas.servicio_id              -> servicios.id
cuadro_honor.servicio_id         -> servicios.id
validacion_puesto_config.servicio_id   -> servicios.id
validacion_puesto_config.checkpoint_id -> checkpoints.id
validaciones_puesto.config_id    -> validacion_puesto_config.id
validaciones_puesto.servicio_id  -> servicios.id
validaciones_puesto.checkpoint_id-> checkpoints.id
prestamo_historial.prestamo_id   -> prestamos.id
comunicado_lecturas.comunicado_id-> comunicados.id
reportes_turno.guardia_id        -> auth.users.id
reportes_turno.revisado_por      -> auth.users.id
chat_messages.sender_id/receiver_id -> auth.users.id
chat_rh.user_id                  -> auth.users.id
emergencias.guardia_id           -> auth.users.id
sesion_registros.user_id         -> auth.users.id
push_subscriptions.user_id       -> auth.users.id
cliente_reporte_config.cliente_id-> auth.users.id
servicios.created_by             -> auth.users.id
```

Varias columnas (`guardia_id`, `supervisor_id`, `created_by`, `autor_id`,
`destinatario_id`, `turno_id`) referencian usuarios o turnos **sin FK declarada**;
la integridad la garantizan las políticas RLS y la lógica de la app.

### 7.3 Dependencias entre tablas

`servicios` es la tabla raíz del modelo operativo: de ella cuelgan
`checkpoints`, `guardia_servicios`, `cliente_servicios`, `metas_servicio`,
`turnos`, `rondines`, `novedades`, `visitas`, `notas_relevo`,
`validacion_puesto_config` y `rondin_alarmas`.
`guardia_servicios` y `cliente_servicios` son las tablas puente que alimentan
las funciones de RLS (`guardia_has_servicio`, `cliente_has_servicio`,
`cliente_has_guardia`); **cambiar la asignación de servicios cambia lo que ve
cada usuario en toda la aplicación**.

### 7.4 Políticas RLS (resumen por tabla)

Patrón general:

- **Guardia** solo ve sus propias filas (`auth.uid() = guardia_id` / `user_id`)
  o las del servicio que tiene asignado en `guardia_servicios`.
- **Supervisor** y **Admin** leen todo mediante `has_role(auth.uid(), '<rol>')`.
- **Cliente** lee solo lo alcanzable por `cliente_has_servicio()` /
  `cliente_has_guardia()`.

Casos particulares que conviene conocer antes de tocar el esquema:

| Tabla | Regla destacada |
| --- | --- |
| `audit_log` | Solo `SELECT` para admin; `INSERT/UPDATE/DELETE` bloqueados por trigger `audit_log_block_mutation` |
| `chat_messages` | Sin `DELETE`; el receptor solo puede actualizar la columna `read` (grant a nivel de columna + trigger `chat_messages_only_read_update`) |
| `comunicados` | Se ven si `estado='publicado'` y (`destinatario_id IS NULL` o es el propio usuario) → así funcionan los avisos privados de préstamos |
| `prestamos` | `INSERT` solo con `guardia_id = auth.uid()` y `estado='pendiente_supervisor'`; sin `UPDATE/DELETE` directo (todo pasa por RPC) |
| `prestamo_historial` | Solo lectura y solo para el guardia dueño, su supervisor asignado y admin |
| `novedades` | El guardia solo edita/borra las creadas **el mismo día** |
| `validacion_puesto_config` | El guardia solo ve las activas donde está listado o, si la lista está vacía, las de su servicio |
| `user_roles` | Solo lectura; la escritura pasa por `consume_registration_nip` o `promote_user` |
| `branding`, `numeros_emergencia` | Lectura abierta; escritura solo admin |
| `email_*`, `suppressed_emails` | Exclusivas de `service_role` |

### 7.5 Triggers

| Tabla | Trigger | Efecto |
| --- | --- | --- |
| `auth.users` | `on_auth_user_created` | `handle_new_user()`: crea `profiles` y rol inicial `guardia` |
| `audit_log` | `audit_log_no_update` (UPDATE/DELETE) | Lanza excepción: bitácora inmutable |
| `checkpoints`, `servicios`, `guardia_servicios`, `user_roles`, `registration_nips` | `audit_*` | `audit_row_change()` registra el cambio en `audit_log` |
| `guardia_servicios` | `trg_guardia_servicios_principal` / `_del` | Sincroniza `profiles.servicio_asignado_id` con el servicio principal |
| `chat_messages` | `trg_chat_messages_only_read` | Impide modificar cualquier campo distinto de `read` |
| Múltiples | `*_updated_at` | `update_updated_at_column()` refresca `updated_at` |

### 7.6 Funciones SQL principales

| Función | Uso |
| --- | --- |
| `has_role(uuid, app_role)` | Base de casi todas las políticas RLS |
| `get_user_role(uuid)` | Rol único del usuario |
| `get_assigned_supervisor(uuid)` | Supervisor del guardia (`profiles.supervisor_asignado_id`) |
| `guardia_has_servicio(uuid, uuid)` | Guardia ↔ servicio (RLS de programaciones) |
| `cliente_has_servicio` / `cliente_has_guardia` | Alcance de lectura del portal del cliente |
| `validate_registration_nip` / `consume_registration_nip` | Registro con NIP y asignación de rol |
| `promote_user(uuid, app_role)` | Cambio de rol (solo admin) |
| `prestamo_crear`, `prestamo_aprobar_supervisor`, `prestamo_aprobar_admin`, `prestamo_confirmar_deposito`, `prestamo_rechazar`, `prestamo_log`, `prestamo_comunicado_privado`, `prestamo_nombre` | Flujo completo de préstamos |
| `publicar_comunicado`, `publicar_comunicados_programados`, `notificar_comunicado` | Comunicados y su difusión |
| `publicar_reconocimiento`, `cumplimiento_metas_guardia` | Cuadro de honor y bono automático |
| `log_audit_event`, `audit_row_change`, `audit_log_block_mutation` | Bitácora inmutable |
| `es_ausencia_justificada` | Excluye faltas con vacaciones/incapacidad/permiso aprobados |
| `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`, `email_queue_wake`, `email_queue_dispatch` | Cola de correo transaccional |

Todas son `SECURITY DEFINER` con `search_path` fijo y sin permiso de ejecución
para el rol anónimo.

### 7.7 Buckets de Storage

| Bucket | Público | Contenido |
| --- | --- | --- |
| `avatars` | sí | Foto de perfil |
| `evidencias` | no | Rondines, novedades, validación de puesto, fotos de sesión |
| `visitas` | no | INE, placas y salida de visitantes |
| `pendientes` | no | Evidencia de pendientes cumplidos |
| `branding` | no | Logotipo de la empresa |
| `backups` | no | Respaldos JSON semanales |

Los buckets privados se leen con URL firmada (`src/components/SignedImg.tsx`,
`src/lib/storage-helpers.ts`).

### 7.8 Tareas programadas (`pg_cron`)

| Job | Frecuencia | Acción |
| --- | --- | --- |
| `auto-close-shifts-hourly` | `0 * * * *` | Edge function `auto-close-shifts` |
| `check-relevo-pendiente-every-minute` | `* * * * *` | Edge function `check-relevo-pendiente` |
| `publicar-comunicados-programados` | `*/5 * * * *` | `publicar_comunicados_programados()` |
| `purge-retention-daily` | `30 3 * * *` | Edge function `purge-retention` |
| `db-export-backup-weekly` | `0 4 * * 0` | Edge function `db-export-backup` |
| `process-email-queue` | cada 5 s (auto-armado) | `email_queue_dispatch()` |
## 8. Índice rápido de funcionalidades

| Funcionalidad | Ruta / UI | Archivos principales | Tablas principales |
| --- | --- | --- | --- |
| Login | `/` | `src/pages/Login.tsx`, `src/lib/auth-context.tsx` | `profiles`, `user_roles` |
| Registro con NIP | `/registro` | `src/pages/Registro.tsx` | `registration_nips`, `profiles`, `user_roles` |
| Recuperación / reseteo de contraseña | `/recuperar`, `/reset` | `src/pages/RecuperarPassword.tsx`, `ResetPassword.tsx` | (Auth + colas de correo) |
| Foto de sesión (entrada/salida) | Global (gate) | `SessionCaptureGate.tsx`, `SessionPhotoCapture.tsx` | `sesion_registros`, `notificaciones` |
| Registros de sesión | `/registros-sesion` | `src/pages/RegistrosSesion.tsx` | `sesion_registros` |
| Perfil y avatar | `/perfil` | `src/pages/Perfil.tsx` | `profiles` |
| Navegación por rol | Global | `src/App.tsx`, `ProtectedRoute.tsx`, `BottomNav.tsx` | `user_roles` |
| Identidad de marca | `/identidad` | `src/pages/Branding.tsx`, `src/lib/branding.tsx` | `branding` |
| NIPs de registro | Panel admin | `src/pages/NipsAdmin.tsx` | `registration_nips` |
| Auditoría | `/auditoria` | `src/pages/AuditLog.tsx`, `src/lib/audit.ts` | `audit_log` |
| Control de turno | `/turno` | `src/pages/ShiftControl.tsx` | `turnos`, `asistencias`, `faltas`, `notas_relevo` |
| Nota de relevo | `/turno` | `ShiftControl.tsx`, `NotaRelevo*` | `notas_relevo` |
| Rondines | `/rondines` | `src/pages/Rondines.tsx` | `rondines`, `rondin_scans`, `checkpoints` |
| Alarma de rondín (guardia) | Global (modal) | `RondinAlarmMonitor.tsx`, `use-rondin-alarm.ts` | `rondin_alarmas`, `servicios` |
| Programación de alarmas | `/alarmas-rondin` | `src/pages/AlarmasRondin.tsx` | `servicios` |
| Validación de puesto (guardia) | Global (gate) | `ValidacionPuestoGate.tsx`, `src/lib/validacion-puesto.ts` | `validacion_puesto_config`, `validaciones_puesto` |
| Validación de puesto (admin) | `/validacion-puesto` | `src/pages/ValidacionPuesto.tsx` | `validacion_puesto_config`, `validaciones_puesto` |
| Visitas | `/visitas` | `src/pages/Visitas.tsx` | `visitas` |
| Pendientes del puesto | `/pendientes-puesto` | `src/pages/PendientesPuesto.tsx` | `pendientes_puesto`, `pendientes_completados` |
| Reporte de novedades | `/novedades` | `src/pages/ReporteNovedades.tsx` | `novedades` |
| Reporte de turno y validación | `/reporte-turno`, `/reportes-supervisor` | `ReporteTurno.tsx`, `ReportesSupervisor.tsx` | `reportes_turno` |
| Progreso diario / metas | Dashboard guardia | `DailyProgress.tsx`, `src/lib/goals-helpers.ts` | `metas_servicio`, `cuadro_honor` |
| Geocerca global | Global | `use-global-zone-monitor.ts` | `checkpoints`, `notificaciones` |
| Cola offline | Global | `src/lib/offline-queue.ts`, `photo-queue.ts` | (todas, diferido) |
| Panel admin | `/dashboard` | `src/pages/AdminDashboard.tsx` | `profiles`, `user_roles`, `guardia_servicios`, `cliente_servicios` |
| Panel supervisor | `/dashboard` | `src/pages/SupervisorDashboard.tsx` | `rondines`, `emergencias`, `profiles` |
| Dashboard operativo | `/dashboard-operativo` | `src/pages/DashboardOperativo.tsx` | `rondines`, `turnos`, `visitas`, `reportes_turno` |
| Servicios y checkpoints | `/servicios` | `src/pages/Servicios.tsx` | `servicios`, `checkpoints` |
| Metas por servicio | `/metas` | `src/pages/MetasServicio.tsx` | `metas_servicio` |
| Gestión de RH | `/gestion-rh` | `GestionRH.tsx`, `RelevosNoCubiertos.tsx` | `registros_rh`, `notificaciones` |
| Préstamos | `/prestamos` | `src/pages/Prestamos.tsx`, `src/lib/prestamos.ts` | `prestamos`, `prestamo_historial`, `comunicados` |
| Reporte de asistencias | `/reporte-asistencias` | `ReporteAsistencias.tsx`, `pdf-report.ts` | `asistencias`, `registros_rh` |
| Métricas / estadísticas | `/metricas`, `/estadisticas` | `Metricas.tsx`, `EstadisticasAdmin.tsx` | `rondines`, `visitas`, `emergencias` |
| Mapa en tiempo real | `/mapa` | `src/pages/MapaSupervisor.tsx`, `MapView.tsx` | `rondines`, `profiles` |
| Actividad por guardia | `/actividad-guardia` | `src/pages/GuardActivityPage.tsx` | `reportes_turno`, `visitas`, `rondines`, `turnos` |
| Cuadro de honor | `/cuadro-honor` | `src/pages/CuadroHonor.tsx` | `cuadro_honor`, `reconocimientos` |
| Reconocimientos y bonos | `/reconocimientos` | `Reconocimientos.tsx`, `src/lib/reconocimientos.ts` | `reconocimientos`, `metas_servicio` |
| Chat operativo | `/chat` | `Chat.tsx`, `use-chat-notifications.tsx` | `chat_messages` |
| Chat RH | `/chat-rh` | `src/pages/ChatRH.tsx` | `chat_rh` |
| Comunicados | `/comunicados` | `Comunicados.tsx`, `src/lib/comunicados.ts` | `comunicados`, `comunicado_lecturas` |
| Notificaciones | `/notificaciones` | `Notificaciones.tsx`, `notification-types.ts`, `notification-helpers.ts` | `notificaciones` |
| Sonido y banners de alertas | Global | `GlobalAlertSound.tsx`, `UnreadAlertsBanner.tsx`, `UnreadMessagesBanner.tsx` | `notificaciones`, `chat_messages` |
| Push web | Perfil / configuración | `PushToggle.tsx`, `push-notifications.ts`, `send-push` | `push_subscriptions` |
| Botón de emergencia | Global | `EmergencyButton.tsx` | `emergencias`, `numeros_emergencia` |
| Soporte por WhatsApp | Global | `SoporteChat.tsx`, `soporte-config.ts` | `branding.soporte_whatsapp` |
| Teléfonos del sitio | `/soporte-config` | `SoporteConfig.tsx`, `NumerosEmergenciaEditor.tsx` | `branding`, `numeros_emergencia` |
| Portal cliente (dashboard) | Dashboard cliente | `ClienteDashboard.tsx` | `cliente_servicios`, `rondines`, `turnos` |
| Portal cliente (datos) | Pestaña "Datos" | `DatosCapturadosTab.tsx`, `cliente-datos-capturados.ts` | tablas operativas |
| Portal cliente (reporte) | Pestaña "Reporte" | `ReportePersonalizadoTab.tsx`, `cliente-reporte-personalizado.ts` | `cliente_reportes` |
| Config. visibilidad cliente | `/cliente-reporte-config` | `ClienteReporteConfig.tsx`, `cliente-report-config.ts` | `cliente_reporte_config` |
| PWA / offline | Global | `vite.config.ts`, `realtime.ts`, `use-online-status.ts` | — |
| Retención 30 días | Cron | `purge-retention`, `_shared/retention.ts` | tablas operativas |
| Respaldos | Cron / `/auditoria` | `db-export-backup` | todas (export) |
| Correos transaccionales | Cron | `process-email-queue` | `email_send_log`, `email_send_state` |
| Servidor MCP | Edge function `mcp` | `src/lib/mcp/*`, `OAuthConsent.tsx` | según la tool |
