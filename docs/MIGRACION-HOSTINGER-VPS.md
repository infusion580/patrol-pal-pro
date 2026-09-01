# Migración de Defender a un VPS de Hostinger

Guía paso a paso para mover la aplicación completa (frontend + base de datos + almacenamiento +
funciones + tareas programadas) desde Lovable Cloud a un VPS propio de Hostinger.

Última actualización: septiembre 2026.

---

## 0. Resumen del resultado final

```text
                 Internet (https://guardiadefender.org)
                                │
                        ┌───────▼────────┐
                        │  Nginx + TLS   │  (Certbot / Let's Encrypt)
                        └───┬────────┬───┘
              /             │        │            /api, /auth, /storage
   ┌──────────────────┐     │        │     ┌──────────────────────────┐
   │  Frontend build  │◀────┘        └────▶│  Supabase self-hosted    │
   │  (dist/ estático)│                     │  Docker Compose:        │
   └──────────────────┘                     │  kong · postgrest       │
                                            │  gotrue · storage       │
                                            │  realtime · functions   │
                                            │  postgres + pg_cron     │
                                            └──────────────────────────┘
```

Todo corre en un solo VPS. El frontend es estático (Vite build) y el backend es Supabase
self-hosted en Docker.

---

## 1. Requisitos previos

| Recurso | Mínimo recomendado |
|---|---|
| Plan VPS Hostinger | KVM 2 (2 vCPU, 8 GB RAM, 100 GB NVMe) |
| Sistema operativo | Ubuntu 24.04 LTS (plantilla limpia, sin panel) |
| Dominio | El que ya usas: `guardiadefender.org` (+ `www`) |
| Acceso | SSH como `root` desde hPanel → VPS → Configuración SSH |
| Local | `psql`, `pg_dump` 16+, `rclone` o `aws-cli`, Node 20 |

Datos que debes tener a la mano antes de empezar:

- Cadena de conexión de la base de datos origen (Lovable Cloud) y su contraseña.
- Credenciales S3 del Storage origen (endpoint, access key, secret key).
- Los secretos actuales: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
  y la clave del proveedor de correo si usas notificaciones por email.

> Importante: en Lovable Cloud la `service_role key` y la contraseña de la base de datos no son
> visibles. Si no las tienes, primero conecta el proyecto a un Supabase propio o solicita el
> respaldo `db-export-backup` (bucket `backups`) y migra a partir de ese export.

---

## 2. Preparar el VPS

Conéctate por SSH:

```bash
ssh root@IP_DEL_VPS
```

Actualiza y crea un usuario de trabajo:

```bash
apt update && apt -y upgrade
adduser defender
usermod -aG sudo defender
rsync --archive --chown=defender:defender ~/.ssh /home/defender
```

Firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Docker y Docker Compose:

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker defender
docker compose version
```

A partir de aquí trabaja como `defender`: `su - defender`.

---

## 3. Apuntar el dominio (hPanel de Hostinger)

En hPanel → Dominios → DNS / Nameservers:

| Tipo | Nombre | Valor | TTL |
|---|---|---|---|
| A | `@` | IP del VPS | 300 |
| A | `www` | IP del VPS | 300 |

Espera a que resuelva:

```bash
dig +short guardiadefender.org
```

Debe devolver la IP del VPS antes de emitir el certificado TLS.

---

## 4. Instalar Supabase self-hosted

```bash
mkdir -p ~/apps && cd ~/apps
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker ~/apps/backend
cd ~/apps/backend
cp .env.example .env
```

Genera secretos:

```bash
openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # JWT_SECRET (mínimo 32 caracteres)
openssl rand -hex 16   # DASHBOARD_PASSWORD
```

Con el `JWT_SECRET` genera las llaves `ANON_KEY` y `SERVICE_ROLE_KEY` en
`https://supabase.com/docs/guides/self-hosting#api-keys` (generador de llaves) y colócalas en `.env`.

Valores clave del archivo `.env`:

```ini
POSTGRES_PASSWORD=<generado>
JWT_SECRET=<generado>
ANON_KEY=<generado>
SERVICE_ROLE_KEY=<generado>

SITE_URL=https://guardiadefender.org
API_EXTERNAL_URL=https://guardiadefender.org
SUPABASE_PUBLIC_URL=https://guardiadefender.org
ADDITIONAL_REDIRECT_URLS=https://www.guardiadefender.org

DISABLE_SIGNUP=false
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false

STUDIO_DEFAULT_ORGANIZATION=Defender
STUDIO_DEFAULT_PROJECT=Defender
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<generado>
```

Levanta el stack:

```bash
docker compose pull
docker compose up -d
docker compose ps          # todos los servicios en "healthy"
```

Verificación local:

```bash
curl -s localhost:8000/auth/v1/health
```

---

## 5. Migrar la base de datos

El repositorio ya incluye el script que hace el proceso completo.

```bash
cd ~/apps/defender          # el código del proyecto, clonado en el VPS
cp scripts/migrate.env.example scripts/migrate.env
nano scripts/migrate.env
```

Completa:

```ini
SRC_HOST=db.<proyecto-origen>.supabase.co
SRC_PORT=5432
SRC_USER=postgres
SRC_PASSWORD=<contraseña origen>
SRC_DB=postgres

DST_HOST=127.0.0.1
DST_PORT=5432
DST_USER=postgres
DST_PASSWORD=<POSTGRES_PASSWORD del .env>
DST_DB=postgres

APP_SCHEMAS=public
MIGRATE_AUTH=true          # copia auth.users y auth.identities con hashes bcrypt
PGSSLMODE=require
JOBS=4
```

Prueba en seco y luego ejecuta:

```bash
./scripts/migrate-defender.sh --dry-run
./scripts/migrate-defender.sh --all
```

El script exporta roles, extensiones, esquema, GRANTs + políticas RLS, datos y `auth.users`;
verifica checksums SHA-256; restaura en orden y ejecuta **10 validaciones automáticas**
(RLS activo, políticas presentes, `search_path` en funciones `SECURITY DEFINER`, GRANTs,
triggers, enum `app_role`, secuencias, llaves foráneas y conteo de filas origen vs destino).
Si alguna falla, el script termina con error: corrígela antes de continuar.

Los artefactos quedan en `migracion-AAAAMMDD-HHMMSS/` (dumps + `checksums.sha256` + log).

> Como `MIGRATE_AUTH=true` copia los hashes bcrypt, **los usuarios conservan su contraseña**.
> No hay que reinvitar a nadie.

---

## 6. Migrar el almacenamiento (fotos y evidencias)

Buckets a copiar: `evidencias`, `visitas`, `pendientes`, `avatars`, `branding`, `backups`.

El mismo script lo hace si activas la sección de Storage en `scripts/migrate.env`:

```ini
MIGRATE_STORAGE=true
STORAGE_BUCKETS=                       # vacío = todos
SRC_S3_ENDPOINT=https://<proyecto>.storage.supabase.co/storage/v1/s3
SRC_S3_REGION=us-east-1
SRC_S3_ACCESS_KEY=...
SRC_S3_SECRET_KEY=...
DST_S3_ENDPOINT=https://guardiadefender.org/storage/v1/s3
DST_S3_REGION=us-east-1
DST_S3_ACCESS_KEY=...
DST_S3_SECRET_KEY=...
SRC_PUBLIC_STORAGE_URL=https://<proyecto>.supabase.co/storage/v1/object/public
DST_PUBLIC_STORAGE_URL=https://guardiadefender.org/storage/v1/object/public
```

Después de copiar, confirma que los buckets siguen siendo **privados** (excepto `avatars`, que
tiene lectura pública explícita) y que las políticas de Storage llegaron con el dump del esquema:

```sql
select name, public from storage.buckets order by name;
```

---

## 7. Edge Functions

Las funciones no viajan en el dump; se despliegan aparte. En self-hosted corren en el contenedor
`supabase/edge-runtime` que ya está en el compose.

```bash
# copia el código al volumen que monta el contenedor
cp -r ~/apps/defender/supabase/functions/* ~/apps/backend/volumes/functions/
docker compose restart functions
```

Funciones que deben quedar activas:

`auto-close-shifts`, `check-relevo-pendiente`, `purge-retention`, `db-export-backup`,
`send-push`, `get-vapid-public-key`, `cleanup-orphan-user`, `auth-email-hook`,
`process-email-queue`, `mcp`.

Secretos de las funciones — crea `~/apps/backend/volumes/functions/.env`:

```ini
SUPABASE_URL=https://guardiadefender.org
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
SUPABASE_DB_URL=postgres://postgres:<pass>@db:5432/postgres
VAPID_PUBLIC_KEY=<el mismo de producción>
VAPID_PRIVATE_KEY=<el mismo de producción>
VAPID_SUBJECT=mailto:soporte@guardiadefender.org
```

> Conserva **las mismas llaves VAPID**. Si las cambias, todas las suscripciones Web Push
> existentes dejan de funcionar y los usuarios deben volver a activar notificaciones.

---

## 8. Tareas programadas (pg_cron)

Tampoco viajan en el dump. Recrea los jobs conectándote a la base destino:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('auto-close-shifts', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://guardiadefender.org/functions/v1/auto-close-shifts',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
  );
$$);

select cron.schedule('check-relevo-pendiente', '* * * * *',  $$ ... check-relevo-pendiente ... $$);
select cron.schedule('purge-retention',        '0 3 * * *',  $$ ... purge-retention ...        $$);
select cron.schedule('db-export-backup',       '0 4 * * 0',  $$ ... db-export-backup ...       $$);
```

Verifica:

```sql
select jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 20;
```

---

## 9. Compilar y publicar el frontend

En el VPS (o en tu equipo y subes `dist/`):

```bash
cd ~/apps/defender
cat > .env <<'EOF'
VITE_SUPABASE_URL="https://guardiadefender.org"
VITE_SUPABASE_PUBLISHABLE_KEY="<ANON_KEY del VPS>"
VITE_SUPABASE_PROJECT_ID="defender"
EOF

npm ci
npm run build          # genera dist/
sudo mkdir -p /var/www/defender
sudo rsync -a --delete dist/ /var/www/defender/
```

> Estas variables se incrustan en el bundle **en tiempo de compilación**. Cada vez que cambies el
> dominio o la llave anónima hay que volver a compilar; no basta con editar el `.env`.

---

## 10. Nginx + certificado TLS

```bash
sudo apt -y install nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/defender
```

```nginx
server {
  listen 80;
  server_name guardiadefender.org www.guardiadefender.org;

  root /var/www/defender;
  index index.html;

  # Assets con hash: caché larga
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # El service worker y el manifest NUNCA se cachean
  location ~* ^/(sw\.js|registerSW\.js|manifest\.webmanifest)$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }

  # Backend Supabase (Kong escucha en 8000)
  location ~ ^/(rest|auth|storage|realtime|functions)/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 25m;      # fotos de rondín y evidencias
    proxy_read_timeout 300s;
  }

  # SPA: cualquier ruta profunda devuelve index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/defender /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d guardiadefender.org -d www.guardiadefender.org
```

Certbot instala la renovación automática (`systemctl list-timers | grep certbot`).

**HTTPS es obligatorio**: sin él no funcionan geolocalización, cámara, service worker ni Web Push.

---

## 11. Correo transaccional

Recuperación de contraseña y avisos salen por SMTP. En `~/apps/backend/.env`:

```ini
SMTP_ADMIN_EMAIL=soporte@guardiadefender.org
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_SENDER_NAME=Defender Seguridad Privada
MAILER_URLPATHS_RECOVERY=/reset-password
```

Luego `docker compose up -d auth`. Publica SPF, DKIM y DMARC del dominio remitente en el DNS de
hPanel para que los correos no caigan en spam.

---

## 12. Lista de verificación post-migración

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Abrir `https://guardiadefender.org` | Carga sin errores en consola |
| 2 | Iniciar sesión con un usuario existente | Entra con su contraseña anterior |
| 3 | Refrescar en una ruta profunda (`/rondines`) | No devuelve 404 (fallback SPA) |
| 4 | Iniciar y finalizar turno | Se crea el registro de asistencia |
| 5 | Rondín con foto y GPS | La foto sube y se ve con URL firmada |
| 6 | Registrar una visita con foto de INE | Guarda y se visualiza |
| 7 | Chat 1 a 1 y chat RH | Mensajes en tiempo real (Realtime) |
| 8 | Activar notificaciones push | Llega la notificación de prueba |
| 9 | Botón de pánico | Genera alerta a supervisores |
| 10 | Portal cliente | Solo ve lo permitido por la configuración |
| 11 | Exportar PDF y Excel | Descarga con logo y colores de marca |
| 12 | Instalar la PWA en Android/iOS | Se instala y abre a pantalla completa |
| 13 | Cambiar logo en `/identidad` | Cambian iconos de pestaña y PWA |
| 14 | `select count(*)` por tabla | Coincide con el origen |
| 15 | `cron.job_run_details` | Ejecuciones sin error |

---

## 13. Respaldos en el VPS

```bash
sudo mkdir -p /var/backups/defender
sudo tee /usr/local/bin/defender-backup.sh >/dev/null <<'EOF'
#!/bin/bash
set -e
STAMP=$(date +%F-%H%M)
docker exec supabase-db pg_dump -U postgres -Fc postgres \
  > /var/backups/defender/db-$STAMP.dump
tar czf /var/backups/defender/storage-$STAMP.tgz \
  -C /home/defender/apps/backend/volumes storage
find /var/backups/defender -type f -mtime +30 -delete
EOF
sudo chmod +x /usr/local/bin/defender-backup.sh
echo "0 2 * * * root /usr/local/bin/defender-backup.sh" | sudo tee /etc/cron.d/defender-backup
```

Copia los respaldos fuera del VPS (Hostinger Snapshots, S3 externo o `rclone`). Un respaldo en el
mismo disco no protege contra la pérdida del servidor.

---

## 14. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| Pantalla en blanco tras desplegar | `.env` sin `VITE_SUPABASE_*` al compilar | Rellenar y `npm run build` de nuevo |
| 404 al refrescar una ruta | Falta el fallback SPA | Añadir `try_files ... /index.html` |
| `Invalid JWT` en todas las llamadas | `ANON_KEY` no corresponde al `JWT_SECRET` | Regenerar llaves y recompilar el frontend |
| Fotos no se ven | Bucket privado sin URL firmada / política no migrada | Revisar políticas de `storage.objects` |
| Push no llega | Llaves VAPID distintas o sitio sin HTTPS | Restaurar las llaves originales y verificar TLS |
| Error de permisos en una tabla | Faltó el `GRANT` | Ejecutar el `GRANT` que sugiere el `HINT` |
| WebSocket cae cada 60 s | Nginx sin cabeceras `Upgrade` | Añadirlas al bloque `location` |
| Correo no llega | SMTP mal configurado o sin SPF/DKIM | Revisar `docker compose logs auth` |
| Subida de foto falla con 413 | `client_max_body_size` bajo | Subir a `25m` y recargar Nginx |

---

## 15. Plan de retorno (rollback)

1. No apagues el proyecto origen hasta completar la verificación del punto 12.
2. Mantén un TTL de DNS bajo (300 s) durante la migración.
3. Si algo falla: regresa el registro A al destino anterior y vuelve a compilar el frontend con las
   variables `VITE_SUPABASE_*` originales.
4. Los datos escritos en el VPS durante la ventana de prueba deben reexportarse antes de volver.

**Ventana de mantenimiento sugerida**: 2 a 3 horas en horario de bajo movimiento (madrugada),
con aviso previo a los guardias mediante el módulo de Comunicados.
