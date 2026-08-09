# Defender Seguridad Privada — Sistema de Operación

Plataforma web (PWA) para la gestión operativa de seguridad privada: turnos y asistencias, rondines con evidencia georreferenciada, control de visitas, reportes, recursos humanos, chat interno, notificaciones push y portal de clientes.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Arquitectura, modelo de datos, buckets, funciones programadas |
| [IMPLEMENTACION_COMPLETA.md](IMPLEMENTACION_COMPLETA.md) | Bitácora funcional de todo lo implementado |
| Guía Funcional (PDF) | Manual de uso por rol, generado en la carpeta de documentos |

## Roles

- **Guardia** — turno, rondines, visitas, pendientes, reportes, chat.
- **Supervisor** — mapa en vivo, validación de reportes, RH, métricas, alertas de relevo.
- **Administrador** — servicios, usuarios, NIPs, auditoría, identidad de marca, configuración del reporte al cliente.
- **Cliente** — portal de solo lectura con KPIs y exportación a Excel.

## Stack

React 18 · Vite · TypeScript · Tailwind CSS · shadcn/ui · Lovable Cloud (Postgres + RLS, Auth, Storage, Edge Functions, Realtime) · PWA con Web Push (VAPID) · Leaflet + OpenStreetMap.

## Desarrollo local

```sh
npm i
npm run dev
```

Pruebas:

```sh
npx vitest run
```

## Características clave

- Sesión persistente, sesión única por usuario y cierre sincronizado entre pestañas.
- Operación offline: colas de escritura (localStorage) y de fotos (IndexedDB) con reintento automático.
- Geocerca obligatoria y foto en vivo para evidencia de rondín.
- Bitácora de auditoría inmutable, retención automática de fotos y respaldo semanal de la base de datos.
- Chat de soporte flotante en toda la app: reporta fallas por WhatsApp (+52 442 635 6998, configurable por admin) con contexto de usuario, pantalla y dispositivo.
- Logotipo y paleta de colores configurables por el administrador desde `/identidad`.
