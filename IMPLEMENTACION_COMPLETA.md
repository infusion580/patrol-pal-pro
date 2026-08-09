# IMPLEMENTACIÓN COMPLETA — Defender Seguridad Privada

Documento vivo con todo lo entregado en la fase "aplicación empresarial moderna" (tipo WhatsApp Web / Teams / Slack).

---

## 1. Persistencia de sesión

**Objetivo:** el usuario entra una sola vez y permanece autenticado hasta cerrar sesión o hasta que expire el Refresh Token.

- `src/integrations/supabase/client.ts` usa `persistSession + autoRefreshToken` → el Access Token se renueva en segundo plano.
- `src/lib/auth-context.tsx` reescrito:
  - `onAuthStateChange` suscrito **antes** de `getSession()` (patrón oficial, no pierde eventos durante el bootstrap).
  - Maneja `TOKEN_REFRESHED` (silencioso) y `SIGNED_OUT` (limpia estado y redirige).
  - Si el Refresh Token expira o es revocado → purga `sb-*-auth-token` y redirige a `/login`.
  - `logout()` **async completo**: `signOut({ scope: 'local' })` + limpieza de localStorage + limpieza de caches del Service Worker + toast + notificación cross-tab.
  - **BroadcastChannel** `defender-auth-bus`: cerrar sesión en una pestaña cierra todas las demás.
- `src/components/ProtectedRoute.tsx`: loader durante hidratación, redirect conservando `location.state.from`, validación opcional de `roles`.
- `src/App.tsx`: todas las rutas privadas envueltas en `<ProtectedRoute>` con `roles` explícitos para Admin/Supervisor. `/login`, `/register`, `/reset-password` permanecen públicas.

---

## 2. Reconexión + estado online/offline

- `src/hooks/use-online-status.ts`: escucha `online`/`offline` + ping ligero a Supabase cada 15s cuando está caído (detecta captive portals que reportan online pero bloquean tráfico).
- `src/components/ConnectionBanner.tsx`: banner rojo fijo cuando cae la red; al reconectar dispara toast e invalida todas las queries de react-query para re-sincronizar la vista activa.
- `QueryClient` en `App.tsx`: `refetchOnReconnect`, `refetchOnWindowFocus`, `staleTime: 30s`, retry con backoff exponencial.

---

## 3. Cola offline para escrituras JSON

- `src/lib/offline-queue.ts`: cola persistente en `localStorage` con `queuedInsert` / `queuedUpdate`. Guarda operaciones fallidas y las reintenta en el evento `online`, tope de 10 intentos por item.
- `src/components/OfflineQueueIndicator.tsx`: badge flotante con conteo pendiente.
- `src/lib/notification-helpers.ts`: **todas** las notificaciones operativas (turno, rondín, zona, incidencia, emergencia) pasan por la cola → ningún evento se pierde por corte de red.
- `App.tsx` inicializa la cola al bootear (`initOfflineQueue()`).

---

## 4. Cola offline para fotos (IndexedDB)

**Nuevo bloque:** cubre las mutaciones que suben imágenes (rondín scan, pendientes completados, INE/placa/salida de visita).

- `src/lib/offline-photo-queue.ts`:
  - Object store IndexedDB `photoQueue` (blobs + metadata).
  - `uploadPhotoResilient(bucket, path, file)` intenta subir de inmediato; si está offline o falla, encola el blob y devuelve el `path` deterministico para que el caller inserte el registro de BD sin bloquearse.
  - Retry automático en el evento `online`, tope de 10 intentos por foto, tratamiento idempotente de "already exists".
  - `initPhotoQueue()` bootstrap en `App.tsx`.
- Call sites migrados:
  - `src/pages/Rondines.tsx` (bucket `evidencias`).
  - `src/components/PendientesList.tsx` (bucket `pendientes`).
  - `src/pages/Visitas.tsx` (bucket `visitas`, INE + placas + salida).
- UX: cuando una foto se encola aparece toast **"📥 Foto en cola — se subirá al recuperar la señal."** El guardia continúa su flujo sin ver errores.

---

## 5. Web Push nativo (VAPID) — end-to-end

**Backend**
- Tabla `push_subscriptions` con RLS (usuario ve solo las suyas; `service_role` las lee para enviar).
- Edge function `generate-vapid-keys` (helper, ya ejecutado).
- Edge function `get-vapid-public-key` (expone la pública).
- Edge function `send-push` (`web-push` npm, validación Zod, purga automática de suscripciones 404/410).
- Secretos: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

**Cliente**
- `public/push-handler.js` con handlers `push` y `notificationclick`, importado dentro del SW existente vía `workbox.importScripts` (un solo SW por scope).
- `src/lib/push-notifications.ts`: `enablePush()`, `disablePush()`, `isPushEnabled()`, `sendPushTo()`. Idempotente vía upsert por endpoint.
- `src/components/PushToggle.tsx`: tarjeta en **Perfil** para activar/desactivar por dispositivo, con mensaje amable si el navegador no soporta (iOS <16.4, modo privado).

**Integración automática**
- `createNotification` en `src/lib/notification-helpers.ts` dispara push OS-level en paralelo al insert (fire-and-forget). Cubre: inicio/fin de turno, rondín, salida de zona, incidencia, emergencia, chat operativo.

---

## 6. Cómo probar

| Escenario | Pasos | Resultado esperado |
|---|---|---|
| Sesión persistente | Login → recargar → cerrar y abrir navegador | Sigue autenticado |
| Cross-tab logout | Abrir `/dashboard` en dos pestañas → logout en una | La otra vuelve a `/login` sin recargar |
| Guard route | Guardia intenta abrir `/servicios` por URL | Redirige a `/dashboard` |
| Corte de red | Desconectar wifi mientras se navega | Banner rojo, badge de cola, reconecta y re-sincroniza solo |
| Rondín offline | Escanear checkpoint con foto sin red | Toast "Foto en cola", registro de BD guardado; al reconectar la foto sube y la evidencia queda visible |
| Push nativo | Activar en Perfil → recibir turno/rondín | Notificación OS aunque la pestaña esté cerrada (PWA instalada) |
| Refresh token vencido | Borrar `sb-*-auth-token` en DevTools → recargar | Redirige a `/login` sin errores |

---

## 7. Control de turnos, asistencias y faltas

- Configuración por servicio: `tipo_turno` (12 h, 24 h, de corrido) y duración base.
- `src/components/ShiftControl.tsx` registra inicio/fin de jornada, calcula fin esperado y **horas extra en vivo** (cada bloque adicional cuenta como turno extra hasta el cierre).
- Tabla `asistencias` (registro automático al iniciar turno) y `faltas` (no inicio de turno o turno marcado incompleto).
- `src/pages/ReporteAsistencias.tsx`: KPIs, filtros por servicio/rango y exportación a Excel (.xlsx).
- Ausencias justificadas (vacaciones/incapacidad en `registros_rh`) se excluyen del conteo de faltas.
- Edge function `auto-close-shifts` (cron) cierra turnos olvidados.

---

## 8. Operación en campo

- **Rondines** (`src/pages/Rondines.tsx`): geocerca obligatoria (`getCurrentPositionRobust`), foto tomada **en vivo** (`capture="environment"` + validación de `lastModified` ≤ 2 min), reporte escrito por rondín y bloqueo de cierre hasta completar todos los checkpoints.
- **Alarmas de rondín** por servicio (intervalo + tolerancia) con `RondinAlarmMonitor.tsx`.
- **Geocerca global**: `use-global-zone-monitor.ts` alerta al salir de la zona desde cualquier pantalla.
- **Visitas**: captura de INE, placas, motivo, a quién visita y área; notificación consolidada de entrada/salida con duración.
- **Pendientes del puesto**: tareas por servicio, evidencia fotográfica opcional, 15 puntos por tarea hacia metas y Cuadro de Honor.
- **Relevo pendiente**: `check-relevo-pendiente` (cron cada minuto) avisa a supervisores 5 min antes del fin de turno si no hay guardia entrante.

---

## 9. Seguridad y cumplimiento

- Roles en tabla aparte (`user_roles`) + `has_role()` SECURITY DEFINER; registro solo con NIP emitido por admin (`registration_nips`, RPC `validate_registration_nip`).
- Sesión única por usuario (`profiles.active_session_id` + monitor de 20 s).
- Buckets privados (`evidencias`, `visitas`, `pendientes`, `avatars`, `backups`, `branding`) con políticas por propietario y lectura vía URL firmada (`SignedImg.tsx`).
- `audit_log` inmutable (append-only) con triggers en tablas críticas y visor admin en `/auditoria`; incluye dispositivo/navegador (`device-info.ts`) e inicios de sesión.
- Retención automática: `purge-retention` (cron diario) borra fotos de INE > 90 días y evidencia de rondín > 365 días.
- Respaldos: `db-export-backup` (cron semanal) exporta las tablas al bucket privado `backups`, retención 90 días.

---

## 10. Portal del Cliente

- Rol `cliente` con acceso de solo lectura a sus servicios (`cliente_servicios`).
- `ClienteDashboard.tsx`: KPIs, gráficas, semáforo de cumplimiento y descarga de reporte en Excel.
- `ClienteReporteConfig.tsx` (admin): define qué datos se muestran al cliente.

---

## 11. Identidad de marca configurable

- Tabla singleton `branding` (logo + paleta HSL), lectura pública y escritura solo admin.
- `src/lib/branding.tsx`: provider que aplica variables CSS (`--primary`, `--accent`, `--background`, `--card`, `--brand-logo`) y cachea en localStorage.
- `/identidad` (admin): subida de logotipo (comprimido a 600 px, URL firmada por 1 año), paletas predefinidas y selectores de color con vista previa en vivo.

---

## 12. Calidad

- Suite de pruebas (Vitest) sobre reglas críticas: horas extra, faltas, geocerca, ausencias justificadas.
- `src/lib/error-monitor.ts` registra excepciones del cliente en `audit_log`.
- Realtime centralizado en `src/lib/realtime.ts` (canales compartidos, sin reconexiones duplicadas).
- Accesibilidad: `aria-label` consistente, `h-dvh` para viewport móvil, objetivos táctiles grandes.

---

**Estado:** compila limpio, sin errores de tipos. Todos los flujos existentes preservados.
