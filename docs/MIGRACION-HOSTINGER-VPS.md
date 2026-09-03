# Migración de Defender a un VPS de Hostinger

Guía detallada, paso a paso, para mover la aplicación completa (frontend + base de datos +
almacenamiento + funciones + tareas programadas + correo + notificaciones push) desde Lovable Cloud
a un VPS propio de Hostinger, **conservando el dominio actual `guardiadefender.org`**.

Está escrita para ejecutarse de arriba hacia abajo. Cada bloque de comandos se puede copiar tal cual.
Donde algo puede salir mal, hay una nota de verificación inmediatamente después.

Última actualización: septiembre 2026.

---

## 0. Resumen del resultado final

```text
                 Internet (https://guardiadefender.org)
                                │
                        ┌───────▼────────┐
                        │  Nginx + TLS   │  (Certbot / Let's Encrypt)
                        └───┬────────┬───┘
              /             │        │            /rest, /auth, /storage,
   ┌──────────────────┐     │        │            /realtime, /functions
   │  Frontend build  │◀────┘        └────▶┌──────────────────────────┐
   │  (dist/ estático)│                    │  Supabase self-hosted    │
   └──────────────────┘                    │  Docker Compose:         │
                                           │  kong · postgrest        │
                                           │  gotrue · storage        │
                                           │  realtime · functions    │
                                           │  postgres + pg_cron      │
                                           └──────────────────────────┘
```

Todo corre en un solo VPS:

- El **frontend** es estático (build de Vite) servido por Nginx desde `/var/www/defender`.
- El **backend** es Supabase self-hosted en Docker; Kong escucha solo en `127.0.0.1:8000` y Nginx le
  hace proxy en las rutas `/rest`, `/auth`, `/storage`, `/realtime` y `/functions`.
- **Un solo dominio y un solo certificado**: no hace falta subdominio de API. Eso evita reconfigurar
  CORS y mantiene las cookies en el mismo origen.

### Tiempos estimados

| Fase | Duración |
|---|---|
| Preparar VPS + Docker | 30 min |
| Levantar Supabase self-hosted | 30 min |
| Migrar base de datos | 20–60 min (según volumen) |
| Migrar Storage | 15–90 min (según fotos) |
| Funciones + cron | 20 min |
| Frontend + Nginx + TLS | 30 min |
| Verificación (punto 14) | 45 min |

**Ventana de mantenimiento sugerida**: 3 a 4 horas en horario de bajo movimiento (madrugada), con
aviso previo a los guardias desde el módulo de **Comunicados**.

---

## 1. Requisitos previos

| Recurso | Mínimo recomendado |
|---|---|
| Plan VPS Hostinger | KVM 2 (2 vCPU, 8 GB RAM, 100 GB NVMe) |
| Sistema operativo | Ubuntu 24.04 LTS (plantilla limpia, **sin** panel ni CyberPanel) |
| Dominio | El que ya usas: `guardiadefender.org` (+ `www`) |
| Acceso | SSH como `root` desde hPanel → VPS → Configuración SSH |
| Equipo local | `psql`, `pg_dump` 16+, `rclone` o `aws-cli`, Node 20, `git` |

> **Por qué KVM 2 y no KVM 1**: el stack de Supabase levanta ~10 contenedores. Con 4 GB de RAM
> Postgres y Realtime compiten por memoria y el contenedor `storage` es el primero que muere
> (OOM) al subir fotos. Con 8 GB el sistema queda holgado para 100–200 guardias activos.

Datos que debes tener a la mano **antes** de empezar:

- Cadena de conexión de la base de datos origen (Lovable Cloud) y su contraseña.
- Credenciales S3 del Storage origen (endpoint, access key, secret key).
- Los secretos actuales: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, y la clave del
  proveedor de correo si usas notificaciones por email.

> **Importante**: en Lovable Cloud la `service_role key` y la contraseña de la base de datos no son
> visibles. Si no las tienes, hay dos caminos:
> 1. Conectar el proyecto a un Supabase propio (donde sí ves las credenciales) y migrar desde ahí.
> 2. Usar el respaldo lógico `db-export-backup` (bucket `backups`, un JSON por tabla) y reimportar
>    con un bucle de inserts. Este camino **no** trae `auth.users`, así que todos los usuarios
>    tendrían que restablecer contraseña.

### Checklist previo

- [ ] VPS creado y accesible por SSH
- [ ] TTL del DNS bajado a 300 s **24 horas antes** de la migración
- [ ] Credenciales de origen (BD y S3) verificadas con una conexión de prueba
- [ ] Respaldo reciente del origen descargado a tu equipo
- [ ] Aviso enviado a los usuarios por Comunicados

---

## 2. Preparar el VPS

Conéctate por SSH:

```bash
ssh root@IP_DEL_VPS
```

Actualiza y crea un usuario de trabajo (no operes como `root`):

```bash
apt update && apt -y upgrade
adduser defender
usermod -aG sudo defender
rsync --archive --chown=defender:defender ~/.ssh /home/defender
```

Zona horaria (importante: los turnos y el cron dependen de ella):

```bash
timedatectl set-timezone America/Mexico_City
timedatectl        # confirma "Time zone: America/Mexico_City"
```

Firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose
```

> **No abras el 5432 ni el 8000 al exterior.** Postgres y Kong quedan accesibles solo desde el
> propio host. Para conectarte con `psql` desde tu equipo usa un túnel SSH (ver punto 5).

Endurecimiento SSH básico:

```bash
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
sudo apt -y install fail2ban && sudo systemctl enable --now fail2ban
```

> Antes de desactivar la contraseña asegúrate de que tu llave pública ya funciona; abre una segunda
> sesión SSH de prueba **sin cerrar la actual**.

Swap (evita que el `pg_restore` mate contenedores por memoria):

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

Docker y Docker Compose:

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker defender
docker compose version
```

A partir de aquí trabaja como `defender`: `su - defender` (o vuelve a entrar por SSH con ese usuario
para que tome el grupo `docker`).

---

## 3. Apuntar el dominio (hPanel de Hostinger)

En hPanel → Dominios → DNS / Nameservers:

| Tipo | Nombre | Valor | TTL |
|---|---|---|---|
| A | `@` | IP del VPS | 300 |
| A | `www` | IP del VPS | 300 |

Si el dominio estaba conectado a Lovable, **quita primero** los registros A que apuntan a
`185.158.133.1` y el TXT `_lovable`; dos registros A con destinos distintos hacen que el tráfico
alterne entre servidores y el certificado falle.

Espera a que resuelva:

```bash
dig +short guardiadefender.org
dig +short www.guardiadefender.org
```

Ambos deben devolver **solo** la IP del VPS antes de emitir el certificado TLS. Si sigue mostrando
la IP vieja, la caché aún no expira; espera el TTL (5 min) y repite.

> **Continuidad del servicio**: mientras el DNS propaga, algunos usuarios verán el sitio viejo y
> otros el nuevo. Por eso la migración de datos se hace **antes** de cambiar el DNS y se declara una
> ventana de mantenimiento: cualquier dato escrito en el origen después del dump se perdería.

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

Con el `JWT_SECRET` genera las llaves `ANON_KEY` y `SERVICE_ROLE_KEY` con el generador de
`https://supabase.com/docs/guides/self-hosting#api-keys` y colócalas en `.env`.

> Las tres llaves están ligadas: `ANON_KEY` y `SERVICE_ROLE_KEY` son JWT firmados con el
> `JWT_SECRET`. Si cambias el secreto, hay que regenerar ambas llaves **y recompilar el frontend**.

Valores clave del archivo `.env`:

```ini
POSTGRES_PASSWORD=<generado>
JWT_SECRET=<generado>
ANON_KEY=<generado>
SERVICE_ROLE_KEY=<generado>

SITE_URL=https://guardiadefender.org
API_EXTERNAL_URL=https://guardiadefender.org
SUPABASE_PUBLIC_URL=https://guardiadefender.org
ADDITIONAL_REDIRECT_URLS=https://www.guardiadefender.org,https://guardiadefender.org/reset-password

DISABLE_SIGNUP=false
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
JWT_EXPIRY=3600

STUDIO_DEFAULT_ORGANIZATION=Defender
STUDIO_DEFAULT_PROJECT=Defender
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<generado>

FILE_SIZE_LIMIT=26214400          # 25 MB: fotos de rondín y evidencias
```

> `DISABLE_SIGNUP=false` es obligatorio: el registro con NIP crea el usuario desde el cliente. El
> control de acceso real lo hace `validate_registration_nip`, no el interruptor de GoTrue.

Guarda **todo** el `.env` en tu gestor de contraseñas antes de continuar.

Levanta el stack:

```bash
docker compose pull
docker compose up -d
docker compose ps          # todos los servicios en "healthy"
```

Verificación local:

```bash
curl -s localhost:8000/auth/v1/health
curl -s localhost:8000/rest/v1/ -H "apikey: <ANON_KEY>" | head
```

Si algún contenedor queda en `restarting`, revisa `docker compose logs -f <servicio>`. Las causas
más comunes son un `JWT_SECRET` menor a 32 caracteres o comillas mal cerradas en el `.env`.

El Studio queda en `localhost:8000` (usuario/contraseña del `.env`). **No lo expongas** en Nginx;
para usarlo abre un túnel: `ssh -L 8000:127.0.0.1:8000 defender@IP_DEL_VPS` y entra a
`http://localhost:8000` desde tu navegador.

---

## 5. Migrar la base de datos

El repositorio ya incluye el script que hace el proceso completo.

```bash
cd ~/apps
git clone <tu-repo> defender      # o sube el código con rsync/scp
cd ~/apps/defender
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

> Si el contenedor de Postgres no publica el 5432 en el host, o expones el puerto solo en local
> (`ports: - "127.0.0.1:5432:5432"` en el `docker-compose.yml`), o ejecutas el restore dentro del
> contenedor. La primera opción es la más cómoda y sigue siendo segura porque UFW bloquea el
> acceso externo.

Prueba en seco y luego ejecuta:

```bash
./scripts/migrate-defender.sh --dry-run
./scripts/migrate-defender.sh --all
```

El script exporta roles, extensiones, esquema, GRANTs + políticas RLS, datos y `auth.users`;
verifica checksums SHA-256; restaura en orden y ejecuta **10 validaciones automáticas**:

| # | Validación | Qué comprueba |
|---|---|---|
| 1 | RLS activo | Ninguna tabla de `public` quedó sin `ENABLE ROW LEVEL SECURITY` |
| 2 | Políticas presentes | El conteo de políticas coincide con el origen |
| 3 | `search_path` | Toda función `SECURITY DEFINER` tiene `set search_path = public` |
| 4 | GRANTs | `anon`, `authenticated` y `service_role` con los privilegios del origen |
| 5 | Triggers | Mismo número de triggers por tabla |
| 6 | Enum `app_role` | Contiene `guardia`, `supervisor`, `admin`, `cliente` |
| 7 | Secuencias | `setval` aplicado; el próximo id no colisiona |
| 8 | Llaves foráneas | Todas las FK válidas y sin filas huérfanas |
| 9 | Conteo de filas | Origen vs destino, tabla por tabla |
| 10 | Extensiones | `pgcrypto`, `uuid-ossp`, `pg_cron`, `pg_net` instaladas |

Si alguna falla, el script termina con error: corrígela antes de continuar.

Los artefactos quedan en `migracion-AAAAMMDD-HHMMSS/` (dumps + `checksums.sha256` + log).

> Como `MIGRATE_AUTH=true` copia los hashes bcrypt, **los usuarios conservan su contraseña**.
> No hay que reinvitar a nadie. Lo que **no** se copia es la configuración de GoTrue (plantillas de
> correo, proveedores sociales): eso se reconfigura en el `.env` del punto 4 y el 12.

### Verificación manual rápida

```sql
-- Usuarios y roles
select count(*) from auth.users;
select role, count(*) from public.user_roles group by role;

-- Tablas sin RLS (debe salir vacío)
select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- Tablas sin GRANT a authenticated (debe salir vacío o justificado)
select table_name from information_schema.tables t
where table_schema='public' and not exists (
  select 1 from information_schema.role_table_grants g
  where g.table_name=t.table_name and g.grantee='authenticated');
```

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

Las credenciales S3 del destino se generan en el Studio self-hosted
(Project Settings → Storage → S3 Access Keys) o con las variables `S3_PROTOCOL_ACCESS_KEY_ID` /
`S3_PROTOCOL_ACCESS_KEY_SECRET` del `.env` del backend.

> **Orden correcto**: primero la base de datos, después el Storage. La tabla `storage.objects`
> viaja en el dump y describe los archivos; si copias los binarios antes, el restore los sobrescribe
> y quedan referencias duplicadas.

Después de copiar, confirma que los buckets siguen siendo **privados** (excepto `avatars`, que tiene
lectura pública explícita) y que las políticas de Storage llegaron con el dump del esquema:

```sql
select name, public from storage.buckets order by name;
select policyname from pg_policies where schemaname='storage';
```

Compara el número de objetos por bucket entre origen y destino:

```bash
aws --endpoint-url "$SRC_S3_ENDPOINT" s3 ls s3://evidencias --recursive | wc -l
aws --endpoint-url "$DST_S3_ENDPOINT" s3 ls s3://evidencias --recursive | wc -l
```

---

## 7. Edge Functions

Las funciones no viajan en el dump; se despliegan aparte. En self-hosted corren en el contenedor
`supabase/edge-runtime` que ya está en el compose.

```bash
# copia el código al volumen que monta el contenedor
cp -r ~/apps/defender/supabase/functions/* ~/apps/backend/volumes/functions/
docker compose restart functions
docker compose logs -f functions      # confirma que cada función se registra sin error
```

Funciones que deben quedar activas:

| Función | Para qué sirve | Disparo |
|---|---|---|
| `auto-close-shifts` | Cierra turnos vencidos y calcula horas extra | cron `*/10 * * * *` |
| `check-relevo-pendiente` | Avisa a supervisores si no hay guardia entrante | cron `* * * * *` |
| `purge-retention` | Borra datos operativos de más de 30 días | cron `0 3 * * *` |
| `db-export-backup` | Export lógico semanal al bucket `backups` | cron `0 4 * * 0` |
| `send-push` | Envía Web Push a los suscriptores | app |
| `get-vapid-public-key` | Entrega la llave pública al navegador | app |
| `cleanup-orphan-user` | Elimina usuarios creados a medias en el registro | app |
| `auth-email-hook` | Correos de auth con plantilla propia | GoTrue |
| `process-email-queue` | Procesa la cola de correo transaccional | cron / app |
| `mcp` | Servidor MCP (Guardian Connect) | externo |

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

> Conserva **las mismas llaves VAPID**. Si las cambias, todas las suscripciones Web Push existentes
> dejan de funcionar y cada usuario debe volver a activar notificaciones desde su perfil.

Prueba una función manualmente:

```bash
curl -s -X POST http://127.0.0.1:8000/functions/v1/get-vapid-public-key \
  -H "Authorization: Bearer <ANON_KEY>"
```

> En self-hosted **no existe** `verify_jwt` por función como en `config.toml`; la verificación la
> hace el propio código de cada función. El código del proyecto ya valida el JWT donde corresponde,
> así que no hay que cambiar nada.

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
select jobname, status, return_message, start_time
from cron.job_run_details order by start_time desc limit 20;
```

> `pg_cron` usa la zona horaria del servidor de base de datos. Si el contenedor está en UTC, la
> purga de las `0 3 * * *` corre a las 21:00 hora de México. Ajusta el horario o fija
> `TZ=America/Mexico_City` en el servicio `db` del compose.
>
> `net.http_post` sale del contenedor de Postgres hacia el dominio público; requiere que el
> certificado ya esté emitido (punto 10). Programa los jobs **después** de tener HTTPS.

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
sudo chown -R www-data:www-data /var/www/defender
```

> Estas variables se incrustan en el bundle **en tiempo de compilación**. Cada vez que cambies el
> dominio o la llave anónima hay que volver a compilar; no basta con editar el `.env`.

> Si el VPS tiene poca RAM, el build de Vite puede morir. Compila en tu equipo y sube el resultado:
> `rsync -a --delete dist/ defender@IP:/tmp/dist && ssh ... sudo rsync -a --delete /tmp/dist/ /var/www/defender/`

### Script de despliegue reutilizable

```bash
sudo tee /usr/local/bin/defender-deploy.sh >/dev/null <<'EOF'
#!/bin/bash
set -e
cd /home/defender/apps/defender
git pull
npm ci
npm run build
rsync -a --delete dist/ /var/www/defender/
chown -R www-data:www-data /var/www/defender
nginx -t && systemctl reload nginx
echo "Despliegue completo: $(date)"
EOF
sudo chmod +x /usr/local/bin/defender-deploy.sh
```

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

  # Compresión
  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;

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
    proxy_buffering off;           # Realtime y respuestas en streaming
  }

  # SPA: cualquier ruta profunda devuelve index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/defender /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d guardiadefender.org -d www.guardiadefender.org
```

Certbot reescribe el bloque para el 443, añade la redirección desde el 80 e instala la renovación
automática:

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

**HTTPS es obligatorio**: sin él no funcionan geolocalización, cámara, service worker ni Web Push.

Cabeceras de seguridad recomendadas (añádelas dentro del `server` del 443):

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "SAMEORIGIN" always;
```

---

## 11. Elegir dominio principal (raíz o www)

La app usa `window.location.origin` para los redirects de recuperación de contraseña y OAuth. Si el
usuario entra por `www` y las URLs registradas son de la raíz, el enlace del correo falla. Fija una
sola forma canónica redirigiendo la otra:

```nginx
server {
  listen 443 ssl;
  server_name www.guardiadefender.org;
  # ... certificados que puso certbot ...
  return 301 https://guardiadefender.org$request_uri;
}
```

Y asegúrate de que `ADDITIONAL_REDIRECT_URLS` en `~/apps/backend/.env` incluya ambas variantes.

---

## 12. Correo transaccional

Recuperación de contraseña y avisos salen por SMTP. En `~/apps/backend/.env`:

```ini
SMTP_ADMIN_EMAIL=soporte@guardiadefender.org
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_SENDER_NAME=Defender Seguridad Privada
MAILER_URLPATHS_RECOVERY=/reset-password
MAILER_URLPATHS_CONFIRMATION=/login
```

Luego `docker compose up -d auth`.

**No uses el SMTP del VPS.** Los rangos de IP de VPS suelen estar en listas negras y el correo de
recuperación nunca llega. Usa un proveedor (Resend, Brevo, Postmark, SES) y publica en el DNS de
hPanel:

| Tipo | Nombre | Valor |
|---|---|---|
| TXT | `@` | `v=spf1 include:<proveedor> ~all` |
| TXT | `resend._domainkey` (o el que indique el proveedor) | clave DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:soporte@guardiadefender.org` |

Prueba:

```bash
docker compose logs -f auth      # y dispara "Olvidé mi contraseña" desde la app
```

---

## 13. Notificaciones push y PWA

- Las llaves VAPID son las mismas del origen (punto 7). Con eso, las suscripciones guardadas en la
  base siguen siendo válidas y no hay que volver a pedir permiso.
- El service worker se sirve desde la raíz; verifica que responda:
  `curl -I https://guardiadefender.org/sw.js` → `200` y `Cache-Control: no-store`.
- Si cambiaste de dominio (no es el caso aquí), **todas** las suscripciones se pierden: el push está
  ligado al origen.
- Prueba de extremo a extremo: entra desde un Android con Chrome, activa notificaciones en el perfil
  y dispara una alerta de pánico desde otra cuenta.

---

## 14. Lista de verificación post-migración

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
| 14 | Recuperación de contraseña | Correo llega y el enlace abre `/reset-password` |
| 15 | Registro con NIP | Rechaza NIP inválido, acepta el generado por admin |
| 16 | Alerta de salida de geocerca | Suena y notifica aunque la app esté en segundo plano |
| 17 | Validación de puesto programada | Modal bloqueante con cuenta de 3 minutos |
| 18 | `select count(*)` por tabla | Coincide con el origen |
| 19 | `cron.job_run_details` | Ejecuciones sin error |
| 20 | Un guardia solo ve su servicio principal | RLS aplicada correctamente |

Prueba de RLS desde fuera (debe devolver `[]`, no filas):

```bash
curl -s "https://guardiadefender.org/rest/v1/profiles?select=*" -H "apikey: <ANON_KEY>"
```

---

## 15. Respaldos en el VPS

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

Copia los respaldos **fuera** del VPS (Hostinger Snapshots, S3 externo o `rclone`). Un respaldo en el
mismo disco no protege contra la pérdida del servidor.

```bash
sudo apt -y install rclone
rclone config                     # configura un remoto, p.ej. "offsite"
echo "30 2 * * * root rclone copy /var/backups/defender offsite:defender-backups" \
  | sudo tee /etc/cron.d/defender-offsite
```

**Prueba de restauración** (hazla al menos una vez; un respaldo no verificado no es un respaldo):

```bash
docker exec -i supabase-db createdb -U postgres restore_test
cat /var/backups/defender/db-<fecha>.dump | \
  docker exec -i supabase-db pg_restore -U postgres -d restore_test
docker exec -i supabase-db psql -U postgres -d restore_test -c \
  "select count(*) from public.profiles;"
docker exec -i supabase-db dropdb -U postgres restore_test
```

---

## 16. Monitoreo y mantenimiento

```bash
# Salud de los contenedores
docker compose ps
docker stats --no-stream

# Espacio en disco (las fotos crecen rápido)
df -h && du -sh /home/defender/apps/backend/volumes/storage

# Logs
docker compose logs --tail=100 db
docker compose logs --tail=100 functions
sudo tail -f /var/log/nginx/error.log
```

Rutina sugerida:

| Frecuencia | Tarea |
|---|---|
| Diaria | Revisar `cron.job_run_details` y espacio en disco |
| Semanal | Confirmar el export del bucket `backups` y la copia offsite |
| Mensual | `apt upgrade`, `docker compose pull && up -d`, prueba de restauración |
| Trimestral | Rotar `DASHBOARD_PASSWORD` y revisar usuarios activos |

Alerta simple de disco lleno:

```bash
echo '0 * * * * root [ $(df / | tail -1 | awk "{print \$5}" | tr -d "%") -gt 85 ] && echo "Disco al $(df -h / | tail -1 | awk "{print \$5}")" | mail -s "Defender: disco" soporte@guardiadefender.org' | sudo tee /etc/cron.d/defender-disk
```

---

## 17. Actualizar la aplicación después de migrar

```bash
sudo /usr/local/bin/defender-deploy.sh
```

Para cambios de base de datos, aplica el SQL con `psql` dentro del contenedor:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < mi_migracion.sql
```

Guarda cada archivo en `supabase/migrations/` del repo para conservar el historial. Recuerda la
regla del proyecto: **todo `CREATE TABLE` en `public` va acompañado de sus `GRANT`, `ENABLE ROW
LEVEL SECURITY` y políticas en la misma migración**, en ese orden.

Para actualizar funciones:

```bash
cp -r ~/apps/defender/supabase/functions/* ~/apps/backend/volumes/functions/
docker compose restart functions
```

---

## 18. Problemas frecuentes

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
| Certbot falla con "unauthorized" | DNS aún apunta al servidor viejo | Esperar propagación y reintentar |
| Contenedor `storage` reiniciándose | Sin memoria (OOM) | Añadir swap y subir de plan |
| El cron no dispara nada | Falta `pg_net` o el certificado no existía | Instalar extensión y reprogramar jobs |
| Todos ven datos de todos | RLS no se habilitó tras el restore | Ejecutar la consulta de verificación del punto 5 |
| Hora incorrecta en turnos | Zona horaria del contenedor en UTC | Fijar `TZ=America/Mexico_City` |

Comandos de diagnóstico rápido:

```bash
docker compose ps                       # ¿algo caído?
curl -I https://guardiadefender.org     # ¿Nginx y TLS responden?
curl -s localhost:8000/auth/v1/health   # ¿backend vivo?
sudo journalctl -u nginx -n 50
```

---

## 19. Plan de retorno (rollback)

1. **No apagues el proyecto origen** hasta completar la verificación del punto 14 y pasar al menos
   una semana en producción sin incidentes.
2. Mantén un TTL de DNS bajo (300 s) durante toda la migración y las 48 h siguientes.
3. Si algo falla: regresa los registros A al destino anterior (`185.158.133.1` + el TXT `_lovable`)
   y vuelve a compilar el frontend con las variables `VITE_SUPABASE_*` originales.
4. Los datos escritos en el VPS durante la ventana de prueba deben reexportarse antes de volver:
   `docker exec supabase-db pg_dump -U postgres -Fc postgres > vuelta.dump`.
5. Documenta el motivo del rollback antes de reintentar; casi siempre es DNS, llaves JWT o un GRANT
   faltante, y los tres se corrigen sin repetir la migración completa.

---

## 20. Anexo: comandos de referencia

```bash
# Levantar / detener todo el backend
cd ~/apps/backend && docker compose up -d
cd ~/apps/backend && docker compose down

# Consola SQL
docker exec -it supabase-db psql -U postgres

# Túnel para el Studio
ssh -L 8000:127.0.0.1:8000 defender@IP_DEL_VPS

# Reiniciar un servicio concreto
docker compose restart auth|storage|realtime|functions|kong

# Recargar Nginx tras editar la configuración
sudo nginx -t && sudo systemctl reload nginx

# Ver el uso real de disco por bucket
du -sh ~/apps/backend/volumes/storage/stub/stub/*
```
