# Arquitectura — Defender Seguridad Privada

Última actualización: agosto 2026

## 1. Panorama

Aplicación web PWA para la operación de una empresa de seguridad privada: control de turnos, rondines con evidencia, visitas, reportes, RH, chat interno y portal para clientes.

```text
┌──────────────────────── Navegador / PWA ────────────────────────┐
│  React 18 + Vite + Tailwind + shadcn/ui                          │
│  ├─ AuthProvider  (sesión persistente, sesión única, cross-tab)  │
│  ├─ BrandingProvider (logo + paleta desde BD)                    │
│  ├─ Realtime manager (canales compartidos)                       │
│  ├─ Colas offline: localStorage (JSON) + IndexedDB (fotos)       │
│  └─ Service Worker: caché PWA + Web Push (VAPID)                 │
└───────────────┬──────────────────────────────────────────────────┘
                │ HTTPS (supabase-js)
┌───────────────▼──────────────── Backend (Lovable Cloud) ─────────┐
│  Auth  ·  Postgres + RLS  ·  Storage (buckets privados)          │
│  Edge Functions  ·  pg_cron  ·  Realtime                          │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Frontend

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Rutas | `src/App.tsx` | Rutas públicas y privadas envueltas en `ProtectedRoute` con `roles` |
| Sesión | `src/lib/auth-context.tsx` | Bootstrap, refresh silencioso, logout cross-tab (BroadcastChannel), sesión única |
| Marca | `src/lib/branding.tsx` | Variables CSS y logotipo dinámicos |
| Realtime | `src/lib/realtime.ts` | Un canal por tabla, compartido entre pantallas |
| Offline | `src/lib/offline-queue.ts`, `src/lib/offline-photo-queue.ts` | Reintento de escrituras y subidas |
| Notificaciones | `src/lib/notification-helpers.ts`, `src/lib/push-notifications.ts` | Inserción en BD + push OS |
| Ubicación | `src/lib/geo*.ts`, `src/hooks/use-global-zone-monitor.ts` | Geocerca y alertas de salida de zona |
| Auditoría | `src/lib/error-monitor.ts`, `src/lib/device-info.ts` | Errores y contexto de dispositivo |

Diseño: tokens semánticos HSL en `src/index.css` (`--primary`, `--accent`, `--background`, `--card`), sobrescribibles en caliente por el BrandingProvider.

## 3. Modelo de datos (esquema `public`)

| Dominio | Tablas |
|---|---|
| Identidad | `profiles`, `user_roles`, `registration_nips`, `branding` |
| Operación | `servicios`, `checkpoints`, `guardia_servicios`, `turnos`, `rondines`, `rondin_scans`, `rondin_alarmas` |
| Asistencia | `asistencias`, `faltas`, `registros_rh` |
| Evidencia | `reportes_turno`, `visitas`, `pendientes_puesto`, `pendientes_completados`, `emergencias` |
| Comunicación | `chat_messages`, `chat_rh`, `notificaciones`, `push_subscriptions` |
| Gamificación | `metas_servicio`, `cuadro_honor` |
| Cliente | `cliente_servicios`, `cliente_reporte_config` |
| Cumplimiento | `audit_log` |

Reglas transversales:
- RLS activo en todas las tablas + `GRANT` explícito por rol.
- Roles nunca en `profiles`: se validan con `has_role(auth.uid(), rol)` (SECURITY DEFINER).
- `audit_log` es append-only (sin UPDATE/DELETE).

## 4. Almacenamiento

Todos los buckets son **privados**; las imágenes se muestran con URL firmada (`SignedImg.tsx`).

| Bucket | Contenido | Retención |
|---|---|---|
| `evidencias` | Fotos de rondín | 365 días |
| `visitas` | INE, placas, salida | 90 días (fotos de INE) |
| `pendientes` | Evidencia de tareas | — |
| `avatars` | Foto de perfil | — |
| `branding` | Logotipo de la empresa | — |
| `backups` | Export semanal de la BD | 90 días |

## 5. Edge Functions y tareas programadas

| Función | Disparo | Propósito |
|---|---|---|
| `auto-close-shifts` | cron | Cierra turnos abiertos vencidos |
| `check-relevo-pendiente` | cron (1 min) | Alerta de relevo no cubierto (5 min antes) |
| `purge-retention` | cron diario | Borra fotos fuera de política de retención |
| `db-export-backup` | cron semanal | Respaldo de tablas a `backups` |
| `send-push` | invocación | Envío Web Push (VAPID) |
| `get-vapid-public-key` | invocación | Clave pública para suscripción |
| `cleanup-orphan-user` | invocación | Limpia usuarios sin perfil |
| `seed-demo-users` | manual | Datos de demostración |

## 6. Seguridad

- Registro solo con NIP válido (RPC `validate_registration_nip`); el NIP define el rol final.
- Sesión única por usuario (`profiles.active_session_id`).
- Geocerca obligatoria para iniciar rondín, verificar punto y subir evidencia.
- Fotos de rondín solo con cámara en vivo (sin galería).
- Secretos del backend nunca en el cliente; las funciones usan `service_role` del lado servidor.

## 7. Resiliencia

1. Escritura JSON → si falla, cola en `localStorage` y reintento al volver la red.
2. Foto → compresión (`image-compress.ts`, máx. 1600 px) → subida; si falla, cola en IndexedDB.
3. Reconexión → banner, invalidación de queries y re-sincronización automática.
4. Notificaciones → in-app + Web Push aunque la app esté cerrada (PWA instalada).
