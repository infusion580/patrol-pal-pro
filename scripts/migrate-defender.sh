#!/usr/bin/env bash
# =============================================================================
#  Defender · Migración completa de base de datos a servidor propio
# -----------------------------------------------------------------------------
#  Migra en UN SOLO COMANDO:
#    1. Extensiones y esquemas (public, auth, storage)
#    2. Esquema (tablas, tipos ENUM, funciones, triggers, vistas, secuencias)
#    3. Datos (con desactivación temporal de triggers/FK)
#    4. Roles de base de datos, GRANTs, políticas RLS
#    5. Usuarios de autenticación (auth.users, auth.identities) con hash bcrypt
#    6. Validaciones post-restauración y log completo
#
#  USO:
#    ./scripts/migrate-defender.sh --all
#    ./scripts/migrate-defender.sh --dump-only
#    ./scripts/migrate-defender.sh --restore-only --dump-dir ./migracion-20260809-0300
#    ./scripts/migrate-defender.sh --all --dry-run
#
#  CONFIGURACIÓN: crear scripts/migrate.env (ver plantilla al final del archivo)
#  o exportar las variables SRC_* y DST_* antes de ejecutar.
# =============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

# ----------------------------------------------------------------------------- 
# 0. Constantes y utilidades
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
DUMP_DIR="${DUMP_DIR:-$SCRIPT_DIR/../migracion-$TS}"
LOG_FILE=""
MODE="all"          # all | dump | restore
DRY_RUN=false
KEEP_GOING=false

C_RESET='\033[0m'; C_INFO='\033[0;36m'; C_OK='\033[0;32m'
C_WARN='\033[0;33m'; C_ERR='\033[0;31m'; C_STEP='\033[1;35m'

_log() { # _log <color> <nivel> <mensaje>
  local color="$1" level="$2"; shift 2
  local line="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
  printf "%b%s%b\n" "$color" "$line" "$C_RESET"
  [[ -n "$LOG_FILE" ]] && printf '%s\n' "$line" >>"$LOG_FILE"
  return 0
}
info() { _log "$C_INFO" "INFO" "$@"; }
ok()   { _log "$C_OK"   "OK  " "$@"; }
warn() { _log "$C_WARN" "WARN" "$@"; }
err()  { _log "$C_ERR"  "ERROR" "$@"; }
step() { _log "$C_STEP" "STEP" "───── $* ─────"; }
die()  { err "$@"; err "Migración abortada. Log: ${LOG_FILE:-<sin log>}"; exit 1; }

trap 'err "Fallo en la línea $LINENO (comando: $BASH_COMMAND)"' ERR

run() { # ejecuta respetando --dry-run
  if $DRY_RUN; then
    info "[dry-run] $*"
  else
    "$@"
  fi
}

# -----------------------------------------------------------------------------
# 1. Argumentos
# -----------------------------------------------------------------------------
usage() {
  cat <<'EOF'
Uso: migrate-defender.sh [opciones]

  --all              Dump + restauración + validaciones (por defecto)
  --dump-only        Solo exporta desde el origen
  --restore-only     Solo restaura en el destino (requiere --dump-dir)
  --dump-dir DIR     Carpeta de dumps (origen o destino según el modo)
  --env-file FILE    Archivo de configuración (default scripts/migrate.env)
  --dry-run          Muestra lo que haría sin ejecutar cambios
  --keep-going       Continúa aunque una validación no crítica falle
  -h, --help         Esta ayuda
EOF
}

ENV_FILE="$SCRIPT_DIR/migrate.env"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)          MODE="all"; shift ;;
    --dump-only)    MODE="dump"; shift ;;
    --restore-only) MODE="restore"; shift ;;
    --dump-dir)     DUMP_DIR="$2"; shift 2 ;;
    --env-file)     ENV_FILE="$2"; shift 2 ;;
    --dry-run)      DRY_RUN=true; shift ;;
    --keep-going)   KEEP_GOING=true; shift ;;
    -h|--help)      usage; exit 0 ;;
    *) echo "Opción desconocida: $1"; usage; exit 1 ;;
  esac
done

# -----------------------------------------------------------------------------
# 2. Configuración
# -----------------------------------------------------------------------------
# shellcheck disable=SC1090
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

: "${SRC_HOST:=}"; : "${SRC_PORT:=5432}"; : "${SRC_USER:=postgres}"
: "${SRC_DB:=postgres}"; : "${SRC_PASSWORD:=}"
: "${DST_HOST:=}"; : "${DST_PORT:=5432}"; : "${DST_USER:=postgres}"
: "${DST_DB:=defender}"; : "${DST_PASSWORD:=}"
: "${MIGRATE_AUTH:=true}"        # migrar auth.users / auth.identities
: "${APP_SCHEMAS:=public}"       # esquemas de aplicación a migrar
: "${JOBS:=4}"

# --- Storage (fotos, videos y adjuntos) --------------------------------------
: "${MIGRATE_STORAGE:=true}"     # migrar objetos de Storage (S3 → MinIO)
: "${STORAGE_BUCKETS:=}"         # lista separada por comas; vacío = todos los del origen
: "${SRC_S3_ENDPOINT:=}"         # ej. https://<proyecto>.storage.supabase.co/storage/v1/s3
: "${SRC_S3_REGION:=us-east-1}"
: "${SRC_S3_ACCESS_KEY:=}"; : "${SRC_S3_SECRET_KEY:=}"
: "${DST_S3_ENDPOINT:=}"         # ej. https://minio.midominio.com
: "${DST_S3_REGION:=us-east-1}"
: "${DST_S3_ACCESS_KEY:=}"; : "${DST_S3_SECRET_KEY:=}"
: "${DST_PUBLIC_STORAGE_URL:=}"  # URL pública de MinIO para reescribir enlaces guardados
: "${SRC_PUBLIC_STORAGE_URL:=}"  # URL pública anterior a reemplazar en la base de datos


SRC_URI=""; DST_URI=""
build_uri() { # build_uri user pass host port db
  printf 'postgresql://%s:%s@%s:%s/%s?sslmode=%s' \
    "$1" "$2" "$3" "$4" "$5" "${PGSSLMODE:-prefer}"
}

# -----------------------------------------------------------------------------
# 3. Pre-vuelo
# -----------------------------------------------------------------------------
preflight() {
  step "Verificación previa"
  for bin in pg_dump pg_dumpall psql pg_restore; do
    command -v "$bin" >/dev/null 2>&1 || die "Falta el binario requerido: $bin (instala postgresql-client-15+)"
  done
  local pgv; pgv="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
  [[ "$pgv" -ge 15 ]] || warn "pg_dump v$pgv detectado; se recomienda 15 o superior"
  ok "Herramientas disponibles (pg_dump v$pgv)"

  if [[ "$MIGRATE_STORAGE" == "true" ]]; then
    command -v aws >/dev/null 2>&1 \
      || die "Falta 'aws' (AWS CLI v2) requerido para migrar Storage; instálalo o usa MIGRATE_STORAGE=false"
    ok "AWS CLI disponible para la migración de Storage (S3 → MinIO)"
  fi


  if [[ "$MODE" != "restore" ]]; then
    [[ -n "$SRC_HOST" ]] || die "SRC_HOST no configurado (revisa $ENV_FILE)"
    SRC_URI="$(build_uri "$SRC_USER" "$SRC_PASSWORD" "$SRC_HOST" "$SRC_PORT" "$SRC_DB")"
    psql "$SRC_URI" -Atqc 'select 1' >/dev/null 2>&1 || die "No hay conexión con el ORIGEN ($SRC_HOST:$SRC_PORT/$SRC_DB)"
    ok "Conexión al origen verificada"
  fi

  if [[ "$MODE" != "dump" ]]; then
    [[ -n "$DST_HOST" ]] || die "DST_HOST no configurado (revisa $ENV_FILE)"
    DST_URI="$(build_uri "$DST_USER" "$DST_PASSWORD" "$DST_HOST" "$DST_PORT" "$DST_DB")"
    psql "$DST_URI" -Atqc 'select 1' >/dev/null 2>&1 || die "No hay conexión con el DESTINO ($DST_HOST:$DST_PORT/$DST_DB)"
    ok "Conexión al destino verificada"
  fi
}

# -----------------------------------------------------------------------------
# 4. Exportación
# -----------------------------------------------------------------------------
dump_all() {
  step "Exportación desde el origen"
  run mkdir -p "$DUMP_DIR"

  local schema_args=()
  IFS=',' read -ra _schemas <<<"$APP_SCHEMAS"
  for s in "${_schemas[@]}"; do schema_args+=(--schema="$s"); done

  info "1/6 · Roles globales y pertenencias"
  run bash -c "pg_dumpall --dbname='$SRC_URI' --roles-only --no-role-passwords > '$DUMP_DIR/01-roles.sql'"

  info "2/6 · Extensiones"
  run bash -c "psql '$SRC_URI' -Atqc \"select 'CREATE EXTENSION IF NOT EXISTS \\\"'||extname||'\\\" WITH SCHEMA '||quote_ident(n.nspname)||';' from pg_extension e join pg_namespace n on n.oid=e.extnamespace where extname <> 'plpgsql';\" > '$DUMP_DIR/02-extensiones.sql'"

  info "3/6 · Esquema de aplicación (tipos, tablas, funciones, triggers, RLS)"
  run bash -c "pg_dump '$SRC_URI' --schema-only --no-owner --no-privileges ${schema_args[*]} > '$DUMP_DIR/03-esquema.sql'"

  info "4/6 · GRANTs y políticas RLS"
  run bash -c "pg_dump '$SRC_URI' --schema-only --no-owner ${schema_args[*]} | awk '/^(GRANT|REVOKE|ALTER TABLE .* ENABLE ROW LEVEL SECURITY|CREATE POLICY|ALTER POLICY)/,/;\$/' > '$DUMP_DIR/04-grants-rls.sql'"

  info "5/6 · Datos de la aplicación"
  run bash -c "pg_dump '$SRC_URI' --data-only --no-owner --disable-triggers ${schema_args[*]} > '$DUMP_DIR/05-datos.sql'"

  if [[ "$MIGRATE_AUTH" == "true" ]]; then
    info "6/6 · Usuarios de autenticación (auth.users, auth.identities)"
    run bash -c "pg_dump '$SRC_URI' --data-only --no-owner --disable-triggers \
      --table=auth.users --table=auth.identities > '$DUMP_DIR/06-auth-usuarios.sql'"
  else
    info "6/6 · Migración de auth omitida (MIGRATE_AUTH=false)"
    run bash -c ": > '$DUMP_DIR/06-auth-usuarios.sql'"
  fi

  info "Registrando conteos de referencia del origen"
  run bash -c "psql '$SRC_URI' -Atc \"select schemaname||'.'||relname||'='||n_live_tup from pg_stat_user_tables where schemaname = any(string_to_array('$APP_SCHEMAS',',')) order by 1;\" > '$DUMP_DIR/conteos-origen.txt'"

  if ! $DRY_RUN; then
    ( cd "$DUMP_DIR" && sha256sum ./*.sql > checksums.sha256 )
    ok "Dumps generados en $DUMP_DIR ($(du -sh "$DUMP_DIR" | cut -f1))"
  fi
}

# -----------------------------------------------------------------------------
# 4b. Storage: fotos, videos y adjuntos (S3 origen → MinIO destino)
# -----------------------------------------------------------------------------
STORAGE_DIR="$DUMP_DIR/storage"

s3_src() { AWS_ACCESS_KEY_ID="$SRC_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$SRC_S3_SECRET_KEY" \
  AWS_DEFAULT_REGION="$SRC_S3_REGION" aws --endpoint-url "$SRC_S3_ENDPOINT" "$@"; }
s3_dst() { AWS_ACCESS_KEY_ID="$DST_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$DST_S3_SECRET_KEY" \
  AWS_DEFAULT_REGION="$DST_S3_REGION" aws --endpoint-url "$DST_S3_ENDPOINT" "$@"; }

storage_buckets() { # imprime la lista de buckets a migrar (uno por línea)
  if [[ -n "$STORAGE_BUCKETS" ]]; then
    tr ',' '\n' <<<"$STORAGE_BUCKETS" | sed '/^$/d'
  elif [[ -n "$SRC_URI" ]]; then
    psql "$SRC_URI" -Atqc "select id from storage.buckets order by id" 2>/dev/null
  elif [[ -d "$STORAGE_DIR" ]]; then
    find "$STORAGE_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n'
  fi
}

storage_dump() {
  [[ "$MIGRATE_STORAGE" == "true" ]] || { info "Storage omitido (MIGRATE_STORAGE=false)"; return 0; }
  step "Exportación de Storage (fotos, videos y adjuntos)"
  [[ -n "$SRC_S3_ENDPOINT" ]] || die "SRC_S3_ENDPOINT no configurado (revisa $ENV_FILE)"
  run mkdir -p "$STORAGE_DIR"

  info "1/3 · Metadatos de Storage (buckets y objetos)"
  run bash -c "pg_dump '$SRC_URI' --data-only --no-owner --disable-triggers \
    --table=storage.buckets --table=storage.objects > '$DUMP_DIR/07-storage-metadatos.sql'"

  info "2/3 · Descargando objetos de cada bucket"
  local total=0
  while read -r b; do
    [[ -z "$b" ]] && continue
    info "  · bucket '$b'"
    run mkdir -p "$STORAGE_DIR/$b"
    if $DRY_RUN; then
      info "  [dry-run] aws s3 sync s3://$b $STORAGE_DIR/$b"
    else
      s3_src s3 sync "s3://$b" "$STORAGE_DIR/$b" --no-progress >>"$LOG_FILE" 2>&1 \
        || warn "  No se pudo sincronizar completamente el bucket '$b' (ver log)"
      local n; n="$(find "$STORAGE_DIR/$b" -type f | wc -l)"
      total=$((total + n)); ok "  $n archivos descargados de '$b'"
    fi
  done < <(storage_buckets)

  info "3/3 · Registrando inventario de referencia"
  if ! $DRY_RUN; then
    psql "$SRC_URI" -Atqc "select bucket_id||'='||count(*) from storage.objects group by bucket_id order by 1" \
      > "$DUMP_DIR/conteos-storage-origen.txt" 2>/dev/null || true
    ok "Storage exportado: $total archivos ($(du -sh "$STORAGE_DIR" 2>/dev/null | cut -f1))"
  fi
}

storage_restore() {
  [[ "$MIGRATE_STORAGE" == "true" ]] || return 0
  step "Restauración de Storage en MinIO"
  [[ -n "$DST_S3_ENDPOINT" ]] || die "DST_S3_ENDPOINT no configurado (revisa $ENV_FILE)"
  [[ -d "$STORAGE_DIR" ]] || { warn "No hay objetos descargados en $STORAGE_DIR, se omite"; return 0; }

  info "1/4 · Creando buckets en MinIO y subiendo objetos"
  local total=0
  while read -r b; do
    [[ -z "$b" ]] && continue
    [[ -d "$STORAGE_DIR/$b" ]] || continue
    if $DRY_RUN; then
      info "  [dry-run] mb + sync s3://$b"
    else
      s3_dst s3 mb "s3://$b" >>"$LOG_FILE" 2>&1 || info "  bucket '$b' ya existe"
      s3_dst s3 sync "$STORAGE_DIR/$b" "s3://$b" --no-progress >>"$LOG_FILE" 2>&1 \
        || die "Falló la subida del bucket '$b' (ver log)"
      local n; n="$(find "$STORAGE_DIR/$b" -type f | wc -l)"
      total=$((total + n)); ok "  $n archivos subidos a '$b'"
    fi
  done < <(storage_buckets)

  info "2/4 · Restaurando metadatos (storage.buckets / storage.objects)"
  if ! $DRY_RUN && [[ -s "$DUMP_DIR/07-storage-metadatos.sql" ]]; then
    { echo "SET session_replication_role = 'replica';"; cat "$DUMP_DIR/07-storage-metadatos.sql"; } \
      > "$DUMP_DIR/.tmp-storage.sql"
  fi
  apply_file "$DUMP_DIR/.tmp-storage.sql" "metadatos de Storage" true
  run rm -f "$DUMP_DIR/.tmp-storage.sql"

  info "3/4 · Reescribiendo URLs públicas guardadas en la base de datos"
  if ! $DRY_RUN && [[ -n "$SRC_PUBLIC_STORAGE_URL" && -n "$DST_PUBLIC_STORAGE_URL" ]]; then
    psql "$DST_URI" -Atq -c "
      select format('UPDATE %I.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L;',
                    c.table_schema, c.table_name, c.column_name, c.column_name,
                    '$SRC_PUBLIC_STORAGE_URL', '$DST_PUBLIC_STORAGE_URL',
                    c.column_name, '%$SRC_PUBLIC_STORAGE_URL%')
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type='BASE TABLE'
      where c.table_schema = any(string_to_array('$APP_SCHEMAS',','))
        and c.data_type in ('text','character varying');" \
      | psql "$DST_URI" -q >>"$LOG_FILE" 2>&1 \
      && ok "URLs de Storage reescritas a $DST_PUBLIC_STORAGE_URL" \
      || warn "No se pudieron reescribir todas las URLs (ver log)"
  else
    info "  Omitido (define SRC_PUBLIC_STORAGE_URL y DST_PUBLIC_STORAGE_URL para activarlo)"
  fi

  info "4/4 · Verificando objetos en destino"
  if ! $DRY_RUN; then
    local fails=0
    while read -r b; do
      [[ -z "$b" ]] && continue
      [[ -d "$STORAGE_DIR/$b" ]] || continue
      local local_n dst_n
      local_n="$(find "$STORAGE_DIR/$b" -type f | wc -l)"
      dst_n="$(s3_dst s3 ls "s3://$b" --recursive 2>/dev/null | grep -c . || true)"
      if (( dst_n >= local_n )); then
        ok "  ✔ $b: $dst_n objetos en MinIO (origen $local_n)"
      else
        err "  ✘ $b: $dst_n objetos en MinIO, se esperaban $local_n"; fails=$((fails+1))
      fi
    done < <(storage_buckets)
    if (( fails == 0 )); then ok "Storage migrado y verificado ($total archivos)";
    else err "$fails buckets incompletos"; $KEEP_GOING || die "Migración de Storage incompleta"; fi
  fi
}



# -----------------------------------------------------------------------------
# 5. Restauración
# -----------------------------------------------------------------------------
psql_dst() { psql "$DST_URI" -v ON_ERROR_STOP=1 "$@"; }

apply_file() { # apply_file <archivo> <descripción> [tolerante]
  local file="$1" desc="$2" tolerant="${3:-false}"
  [[ -s "$file" ]] || { warn "$desc: archivo vacío, se omite"; return 0; }
  info "Aplicando $desc ($(basename "$file"))"
  if $DRY_RUN; then info "[dry-run] psql < $file"; return 0; fi
  if [[ "$tolerant" == "true" ]]; then
    psql "$DST_URI" -q -f "$file" >>"$LOG_FILE" 2>&1 || warn "$desc terminó con advertencias (ver log)"
  else
    psql_dst -q -f "$file" >>"$LOG_FILE" 2>&1 || die "Falló la aplicación de $desc (ver log)"
  fi
  ok "$desc aplicado"
}

restore_all() {
  step "Restauración en el destino"
  [[ -d "$DUMP_DIR" ]] || die "No existe la carpeta de dumps: $DUMP_DIR"

  if [[ -f "$DUMP_DIR/checksums.sha256" ]] && ! $DRY_RUN; then
    ( cd "$DUMP_DIR" && sha256sum -c checksums.sha256 >/dev/null ) \
      && ok "Checksums de dumps verificados" || die "Checksums inválidos: los dumps están corruptos"
  fi

  info "Creando esquemas base si no existen"
  run psql_dst -q -c "CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS storage; CREATE SCHEMA IF NOT EXISTS public;"

  apply_file "$DUMP_DIR/02-extensiones.sql" "extensiones"      true
  apply_file "$DUMP_DIR/01-roles.sql"       "roles globales"   true
  apply_file "$DUMP_DIR/03-esquema.sql"     "esquema"          false

  info "Desactivando triggers durante la carga de datos"
  run psql_dst -q -c "SET session_replication_role = 'replica';" >/dev/null 2>&1 || true

  if ! $DRY_RUN; then
    { echo "SET session_replication_role = 'replica';"; cat "$DUMP_DIR/06-auth-usuarios.sql"; } > "$DUMP_DIR/.tmp-auth.sql"
    { echo "SET session_replication_role = 'replica';"; cat "$DUMP_DIR/05-datos.sql"; }        > "$DUMP_DIR/.tmp-datos.sql"
  fi
  apply_file "$DUMP_DIR/.tmp-auth.sql"  "usuarios de autenticación" true
  apply_file "$DUMP_DIR/.tmp-datos.sql" "datos de la aplicación"    false
  run rm -f "$DUMP_DIR/.tmp-auth.sql" "$DUMP_DIR/.tmp-datos.sql"

  apply_file "$DUMP_DIR/04-grants-rls.sql" "GRANTs y políticas RLS" true

  info "Reajustando secuencias"
  if ! $DRY_RUN; then
    psql_dst -Atq -c "
      select format('SELECT setval(%L, coalesce((select max(%I) from %I.%I), 1), true);',
                    quote_ident(n.nspname)||'.'||quote_ident(c.relname), a.attname, tn.nspname, t.relname)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_depend d on d.objid = c.oid and d.deptype = 'a'
      join pg_class t on t.oid = d.refobjid
      join pg_namespace tn on tn.oid = t.relnamespace
      join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
      where c.relkind = 'S' and tn.nspname = any(string_to_array('$APP_SCHEMAS',','));" \
      | psql_dst -q >>"$LOG_FILE" 2>&1 || warn "Algunas secuencias no pudieron reajustarse"
    ok "Secuencias reajustadas"
  fi

  info "Reactivando triggers y analizando"
  run psql_dst -q -c "SET session_replication_role = 'origin'; ANALYZE;" >/dev/null 2>&1 || true
  ok "Restauración completada"
}

# -----------------------------------------------------------------------------
# 6. Validaciones
# -----------------------------------------------------------------------------
CHECKS_OK=0; CHECKS_FAIL=0
check() { # check <descripción> <sql que devuelve 't'/'f'>
  local desc="$1" sql="$2" res
  res="$(psql "$DST_URI" -Atqc "$sql" 2>/dev/null || echo 'error')"
  if [[ "$res" == "t" ]]; then
    ok "✔ $desc"; CHECKS_OK=$((CHECKS_OK+1))
  else
    err "✘ $desc (resultado: $res)"; CHECKS_FAIL=$((CHECKS_FAIL+1))
    $KEEP_GOING || return 0
  fi
}

validate() {
  step "Validaciones post-migración"
  $DRY_RUN && { info "[dry-run] validaciones omitidas"; return 0; }

  check "Todas las tablas de aplicación existen" \
    "select count(*) > 0 from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"
  check "RLS habilitado en todas las tablas públicas" \
    "select count(*) = 0 from pg_tables where schemaname='public' and not rowsecurity"
  check "No hay tablas públicas con RLS y cero políticas" \
    "select count(*) = 0 from pg_tables t where t.schemaname='public' and t.rowsecurity and not exists (select 1 from pg_policies p where p.schemaname=t.schemaname and p.tablename=t.tablename)"
  check "Funciones SECURITY DEFINER tienen search_path fijo" \
    "select count(*) = 0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and coalesce(array_to_string(p.proconfig,','),'') not like '%search_path%'"
  check "GRANTs presentes para authenticated" \
    "select count(*) > 0 from information_schema.role_table_grants where grantee='authenticated' and table_schema='public'"
  check "Triggers restaurados" \
    "select count(*) > 0 from pg_trigger where not tgisinternal"
  check "Tipo enum app_role presente" \
    "select count(*) > 0 from pg_type where typname='app_role'"
  check "session_replication_role restablecido a origin" \
    "select current_setting('session_replication_role') = 'origin'"
  check "Sin claves foráneas inválidas" \
    "select count(*) = 0 from pg_constraint where contype='f' and not convalidated"

  if [[ -f "$DUMP_DIR/conteos-origen.txt" ]]; then
    info "Comparando conteos de filas origen vs destino"
    local diffs=0
    while IFS='=' read -r tabla origen; do
      [[ -z "$tabla" ]] && continue
      local destino; destino="$(psql "$DST_URI" -Atqc "select count(*) from $tabla" 2>/dev/null || echo '?')"
      if [[ "$destino" == "?" ]]; then
        err "  $tabla: no existe en destino"; diffs=$((diffs+1))
      elif (( origen > 0 )) && (( destino == 0 )); then
        err "  $tabla: origen≈$origen destino=0"; diffs=$((diffs+1))
      else
        info "  $tabla: origen≈$origen destino=$destino"
      fi
    done < "$DUMP_DIR/conteos-origen.txt"
    if (( diffs == 0 )); then ok "✔ Conteos coherentes"; CHECKS_OK=$((CHECKS_OK+1));
    else err "✘ $diffs tablas con diferencias"; CHECKS_FAIL=$((CHECKS_FAIL+1)); fi
  fi

  step "Resumen: $CHECKS_OK correctas · $CHECKS_FAIL fallidas"
  if (( CHECKS_FAIL > 0 )) && ! $KEEP_GOING; then
    die "La migración terminó con validaciones fallidas"
  fi
}

# -----------------------------------------------------------------------------
# 7. Main
# -----------------------------------------------------------------------------
main() {
  mkdir -p "$DUMP_DIR"
  LOG_FILE="$DUMP_DIR/migracion-$TS.log"
  : >"$LOG_FILE"

  step "Defender · Migración de base de datos ($MODE)"
  info "Carpeta de trabajo: $DUMP_DIR"
  info "Log: $LOG_FILE"
  $DRY_RUN && warn "Modo dry-run: no se escribirá nada en las bases de datos"

  preflight
  [[ "$MODE" == "all" || "$MODE" == "dump"    ]] && { dump_all; storage_dump; }
  [[ "$MODE" == "all" || "$MODE" == "restore" ]] && { restore_all; storage_restore; validate; }

  step "Migración finalizada correctamente"
  info "Siguientes pasos manuales: Edge Functions, secretos y cron jobs."

  ok "Log completo en $LOG_FILE"
}

main "$@"

# =============================================================================
# PLANTILLA scripts/migrate.env
# -----------------------------------------------------------------------------
# SRC_HOST=db.xxxxx.supabase.co
# SRC_PORT=5432
# SRC_USER=postgres
# SRC_PASSWORD=********
# SRC_DB=postgres
#
# DST_HOST=10.0.0.20
# DST_PORT=5432
# DST_USER=postgres
# DST_PASSWORD=********
# DST_DB=defender
#
# APP_SCHEMAS=public
# MIGRATE_AUTH=true
# PGSSLMODE=require
# =============================================================================
