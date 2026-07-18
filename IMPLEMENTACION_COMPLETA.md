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

## 7. Alcance intencional / próximos pasos sugeridos

- **Realtime robusto (canales globales + reconexión inteligente):** hoy cada página gestiona sus propios canales; funciona, pero unificarlos en un provider global reduciría reconexiones duplicadas tras suspender/reanudar el dispositivo.
- **Compresión de fotos antes de encolar:** las evidencias móviles pueden llegar a 4–6 MB. Un `canvas` resize a 1600px máx bajaría 60–70% el uso de IndexedDB en dispositivos con red intermitente prolongada.
- **Cifrado at-rest de la cola IndexedDB** para dispositivos compartidos, si operaciones lo requiere.

---

**Estado:** compila limpio, sin errores de tipos. Todos los flujos existentes preservados.
