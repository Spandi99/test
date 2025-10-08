#!/usr/bin/env bash
set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-fluid}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-fluid}"
POSTGRES_DB="${POSTGRES_DB:-fluid_calendar}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

RADICALE_USERNAME="${RADICALE_USERNAME:-fluid}"
RADICALE_PASSWORD="${RADICALE_PASSWORD:-fluid}"
RADICALE_CONFIG="${RADICALE_CONFIG:-/etc/radicale/config}"
RADICALE_USERS_FILE="${RADICALE_USERS_FILE:-/etc/radicale/users}"
RADICALE_STORAGE="${RADICALE_STORAGE:-/var/lib/radicale/collections}"
RADICALE_RUN_USER="${RADICALE_RUN_USER:-radicale}"
RADICALE_RUN_GROUP="${RADICALE_RUN_GROUP:-${RADICALE_RUN_USER}}"
RADICALE_BIN="${RADICALE_BIN:-/opt/radicale/bin/radicale}"
RADICALE_LISTEN_HOST="${RADICALE_LISTEN_HOST:-127.0.0.1}"
RADICALE_LISTEN_PORT="${RADICALE_LISTEN_PORT:-5232}"
RADICALE_START_TIMEOUT="${RADICALE_START_TIMEOUT:-30}"
RADICALE_LOG_FILE="${RADICALE_LOG_FILE:-${APP_STATE_DIR}/logs/radicale.log}"
RADICALE_STORAGE_TYPE="${RADICALE_STORAGE_TYPE:-auto}"
RADICALE_STORAGE_CANDIDATES="${RADICALE_STORAGE_CANDIDATES:-multifilesystem filesystem}"
RADICALE_PYTHON_BIN="${RADICALE_PYTHON_BIN:-}"

RADICALE_PYTHON="${RADICALE_PYTHON_BIN}"
if [ -z "${RADICALE_PYTHON}" ]; then
  local_candidate_python="$(dirname "${RADICALE_BIN}")/python"
  if [ -x "${local_candidate_python}" ]; then
    RADICALE_PYTHON="${local_candidate_python}"
  else
    RADICALE_PYTHON="python3"
  fi
elif [ ! -x "${RADICALE_PYTHON}" ]; then
  echo "Configured RADICALE_PYTHON_BIN (${RADICALE_PYTHON}) is not executable. Falling back to python3." >&2
  RADICALE_PYTHON="python3"
fi

APP_STATE_DIR="${APP_STATE_DIR:-/var/lib/fluidcalendar}"
NEXTAUTH_SECRET_FILE="${NEXTAUTH_SECRET_FILE:-${APP_STATE_DIR}/nextauth_secret}"

mkdir -p "${APP_STATE_DIR}"
mkdir -p "$(dirname "${RADICALE_LOG_FILE}")"

: > "${RADICALE_LOG_FILE}"
chmod 640 "${RADICALE_LOG_FILE}"

if [ -z "${NEXTAUTH_SECRET:-}" ]; then
  if [ -s "${NEXTAUTH_SECRET_FILE}" ]; then
    export NEXTAUTH_SECRET="$(cat "${NEXTAUTH_SECRET_FILE}")"
    echo "Loaded persisted NEXTAUTH_SECRET from ${NEXTAUTH_SECRET_FILE}."
  else
    export NEXTAUTH_SECRET="$(head -c 32 /dev/urandom | base64 | tr -d '\n')"
    printf '%s' "${NEXTAUTH_SECRET}" > "${NEXTAUTH_SECRET_FILE}"
    chmod 600 "${NEXTAUTH_SECRET_FILE}"
    echo "Generated and persisted NEXTAUTH_SECRET at ${NEXTAUTH_SECRET_FILE}."
  fi
else
  printf '%s' "${NEXTAUTH_SECRET}" > "${NEXTAUTH_SECRET_FILE}"
  chmod 600 "${NEXTAUTH_SECRET_FILE}"
  echo "Persisted provided NEXTAUTH_SECRET to ${NEXTAUTH_SECRET_FILE}."
fi

if [ -z "${NEXTAUTH_URL:-}" ]; then
  export NEXTAUTH_URL="http://192.168.1.132:3000"
  echo "NEXTAUTH_URL not provided. Defaulting to ${NEXTAUTH_URL}."
fi

if [ -z "${NEXT_PUBLIC_APP_URL:-}" ]; then
  export NEXT_PUBLIC_APP_URL="${NEXTAUTH_URL}"
  echo "NEXT_PUBLIC_APP_URL not provided. Defaulting to NEXTAUTH_URL (${NEXTAUTH_URL})."
fi

PG_VERSION="$(pg_config --version | awk '{print $2}' | cut -d. -f1)"
PG_CLUSTER="main"
PG_DATA_DIR="/etc/postgresql/${PG_VERSION}/${PG_CLUSTER}"
PG_CONF_FILE="${PG_DATA_DIR}/postgresql.conf"
PG_HBA_FILE="${PG_DATA_DIR}/pg_hba.conf"

# Ensure PostgreSQL cluster exists
if ! pg_lsclusters | awk 'NR > 1 {print $1 " " $2}' | grep -q "${PG_VERSION} ${PG_CLUSTER}"; then
  echo "Creating PostgreSQL cluster ${PG_VERSION}/${PG_CLUSTER}..."
  pg_createcluster "${PG_VERSION}" "${PG_CLUSTER}"
fi

# Configure PostgreSQL networking before starting the cluster
if [ ! -f "${PG_CONF_FILE}" ]; then
  echo "PostgreSQL configuration file ${PG_CONF_FILE} not found." >&2
  exit 1
fi

if ! grep -Eq "^[[:space:]]*port[[:space:]]*=[[:space:]]*${POSTGRES_PORT}([[:space:]]|$)" "${PG_CONF_FILE}"; then
  echo "Configuring PostgreSQL to listen on port ${POSTGRES_PORT}..."
  if grep -Eq "^[#[:space:]]*port[[:space:]]*=" "${PG_CONF_FILE}"; then
    sed -i "s/^[#[:space:]]*port[[:space:]]*=.*/port = ${POSTGRES_PORT}/" "${PG_CONF_FILE}"
  else
    printf '\nport = %s\n' "${POSTGRES_PORT}" >> "${PG_CONF_FILE}"
  fi
fi

if ! grep -Eq "^[[:space:]]*listen_addresses[[:space:]]*=[[:space:]]*'0\\.0\\.0\\.0'" "${PG_CONF_FILE}"; then
  echo "Configuring PostgreSQL listen_addresses to 0.0.0.0..."
  if grep -Eq "^[#[:space:]]*listen_addresses[[:space:]]*=" "${PG_CONF_FILE}"; then
    sed -i "s/^[#[:space:]]*listen_addresses[[:space:]]*=.*/listen_addresses = '0.0.0.0'/" "${PG_CONF_FILE}"
  else
    printf "\nlisten_addresses = '%s'\n" "0.0.0.0" >> "${PG_CONF_FILE}"
  fi
fi

if ! grep -qE "^host\\s+all\\s+all\\s+0\\.0\\.0\\.0/0\\s+scram-sha-256" "${PG_HBA_FILE}"; then
  echo "Updating pg_hba.conf to allow password access from any host..."
  printf '\nhost all all 0.0.0.0/0 scram-sha-256\n' >> "${PG_HBA_FILE}"
fi

# Start PostgreSQL cluster
if ! pg_lsclusters | awk '$1 == v && $2 == c {print $4}' v="${PG_VERSION}" c="${PG_CLUSTER}" | grep -q "online"; then
  echo "Starting PostgreSQL..."
  pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER}" start
fi

cleanup() {
  echo "Stopping services..."
  if ps -p ${RADICALE_PID:-0} >/dev/null 2>&1; then
    kill "${RADICALE_PID}" 2>/dev/null || true
  fi
  pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER}" stop || true
}
trap cleanup EXIT TERM INT

# Configure PostgreSQL roles and database
export PGPASSWORD="${POSTGRES_PASSWORD}"
if ! su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'\"" | grep -q 1; then
  echo "Creating PostgreSQL role ${POSTGRES_USER}..."
  su - postgres -c "psql -c \"CREATE ROLE ${POSTGRES_USER} LOGIN PASSWORD '${POSTGRES_PASSWORD}'\""
else
  su - postgres -c "psql -c \"ALTER ROLE ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}'\"" >/dev/null
fi

if ! su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'\"" | grep -q 1; then
  echo "Creating database ${POSTGRES_DB}..."
  su - postgres -c "createdb -O ${POSTGRES_USER} ${POSTGRES_DB}"
fi

su - postgres -c "psql -c 'ALTER DATABASE ${POSTGRES_DB} OWNER TO ${POSTGRES_USER}'" >/dev/null
su - postgres -c "psql -c 'GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER}'" >/dev/null
su - postgres -c "psql -d ${POSTGRES_DB} -c 'ALTER SCHEMA public OWNER TO ${POSTGRES_USER}'" >/dev/null
su - postgres -c "psql -d ${POSTGRES_DB} -c 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${POSTGRES_USER}'" >/dev/null
su - postgres -c "psql -d ${POSTGRES_DB} -c 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${POSTGRES_USER}'" >/dev/null
su - postgres -c "psql -d ${POSTGRES_DB} -c 'GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${POSTGRES_USER}'" >/dev/null
su - postgres -c "psql -d ${POSTGRES_DB} -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${POSTGRES_USER}'" >/dev/null
su - postgres -c "psql -d ${POSTGRES_DB} -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${POSTGRES_USER}'" >/dev/null

# Prepare Radicale storage and users
mkdir -p "${RADICALE_STORAGE}"
mkdir -p "$(dirname "${RADICALE_USERS_FILE}")"

if [ ! -f "${RADICALE_USERS_FILE}" ]; then
  echo "Configuring Radicale credentials for user ${RADICALE_USERNAME}..."
  htpasswd -Bcb "${RADICALE_USERS_FILE}" "${RADICALE_USERNAME}" "${RADICALE_PASSWORD}"
else
  echo "Updating Radicale credentials for user ${RADICALE_USERNAME}..."
  htpasswd -Bb "${RADICALE_USERS_FILE}" "${RADICALE_USERNAME}" "${RADICALE_PASSWORD}"
fi

if id "${RADICALE_RUN_USER}" >/dev/null 2>&1; then
  if [ -d "${RADICALE_STORAGE%/}" ]; then
    chown -R "${RADICALE_RUN_USER}:${RADICALE_RUN_GROUP}" "${RADICALE_STORAGE%/}"
    chmod -R u+rwX,g+rwX,o-rwx "${RADICALE_STORAGE%/}"
  fi
  if [ -f "${RADICALE_USERS_FILE}" ]; then
    chown "${RADICALE_RUN_USER}:${RADICALE_RUN_GROUP}" "${RADICALE_USERS_FILE}"
    chmod 640 "${RADICALE_USERS_FILE}"
  fi
  chown "${RADICALE_RUN_USER}:${RADICALE_RUN_GROUP}" "${RADICALE_LOG_FILE}"
  chmod 640 "${RADICALE_LOG_FILE}"
fi

configure_radicale_storage_backend() {
  local -a candidate_types=()
  if [ "${RADICALE_STORAGE_TYPE}" != "auto" ]; then
    candidate_types=("${RADICALE_STORAGE_TYPE}")
  elif [ -n "${RADICALE_STORAGE_CANDIDATES:-}" ]; then
    # shellcheck disable=SC2206
    candidate_types=(${RADICALE_STORAGE_CANDIDATES})
  else
    candidate_types=("multifilesystem" "filesystem")
  fi

  local selected_type=""
  for candidate in "${candidate_types[@]}"; do
    candidate="${candidate//[[:space:]]/}"
    if [ -z "${candidate}" ]; then
      continue
    fi
    if "${RADICALE_PYTHON}" - <<'PY' "${candidate}" >/dev/null 2>&1; then
import importlib
import sys

module = sys.argv[1]
try:
    import radicale  # noqa: F401
except ModuleNotFoundError:
    raise SystemExit(2)

try:
    importlib.import_module(f"radicale.storage.{module}")
except ModuleNotFoundError:
    raise SystemExit(1)
PY
      selected_type="${candidate}"
      break
    fi
  done

  if [ -z "${selected_type}" ]; then
    echo "Unable to locate a compatible Radicale storage backend. Checked candidates: ${candidate_types[*]}" >&2
    "${RADICALE_PYTHON}" - <<'PY' 1>&2 || true
import pkgutil

try:
    import radicale.storage
except ModuleNotFoundError:
    print("radicale package is not available in the selected interpreter.")
    raise SystemExit(0)

modules = sorted(name for _, name, _ in pkgutil.iter_modules(radicale.storage.__path__))
if modules:
    print("Discovered radicale.storage modules:", ", ".join(modules))
else:
    print("No modules found under radicale.storage.")
PY
    return 1
  fi

  if ! "${RADICALE_PYTHON}" - <<'PY' "${RADICALE_CONFIG}" "${selected_type}" "${RADICALE_STORAGE}"
import configparser
import sys

config_path, storage_type, storage_dir = sys.argv[1:4]

parser = configparser.ConfigParser()
parser.read(config_path)

if "storage" not in parser:
    parser["storage"] = {}

parser["storage"]["type"] = storage_type

if storage_type.endswith("filesystem"):
    parser["storage"]["filesystem_folder"] = storage_dir

with open(config_path, "w", encoding="utf-8") as config_file:
    parser.write(config_file)
PY
  then
    echo "Failed to update Radicale configuration with storage backend ${selected_type}." >&2
    return 1
  fi

  RADICALE_SELECTED_STORAGE_TYPE="${selected_type}"
  echo "Configured Radicale storage backend '${RADICALE_SELECTED_STORAGE_TYPE}' with data root ${RADICALE_STORAGE}."
}

if ! configure_radicale_storage_backend; then
  echo "Radicale storage configuration failed. Exiting." >&2
  exit 1
fi

start_radicale() {
  local -a radicale_cmd=("${RADICALE_BIN}" "--config" "${RADICALE_CONFIG}")

  if [ ! -x "${RADICALE_BIN}" ]; then
    echo "Radicale binary ${RADICALE_BIN} is not executable." >&2
    return 1
  fi

  RADICALE_PID=
  local radicale_launch_success=0

  if id "${RADICALE_RUN_USER}" >/dev/null 2>&1 && [ "$(id -un)" != "${RADICALE_RUN_USER}" ]; then
    if command -v runuser >/dev/null 2>&1; then
      set +e
      runuser -u "${RADICALE_RUN_USER}" -- "${radicale_cmd[@]}" >>"${RADICALE_LOG_FILE}" 2>&1 &
      RADICALE_PID=$!
      radicale_launch_success=$?
      set -e
    fi

    if [ ${radicale_launch_success} -ne 0 ] || [ -z "${RADICALE_PID:-}" ]; then
      echo "runuser failed to start Radicale, falling back to su." >&2
      set +e
      su -s /bin/sh "${RADICALE_RUN_USER}" -c "exec $(printf '%q ' "${radicale_cmd[@]}")" >>"${RADICALE_LOG_FILE}" 2>&1 &
      RADICALE_PID=$!
      radicale_launch_success=$?
      set -e
    fi
  else
    "${radicale_cmd[@]}" >>"${RADICALE_LOG_FILE}" 2>&1 &
    RADICALE_PID=$!
  fi

  if [ ${radicale_launch_success} -ne 0 ]; then
    echo "Failed to start Radicale process. Last log lines:" >&2
    tail -n 40 "${RADICALE_LOG_FILE}" >&2 || true
    return 1
  fi

  if ! command -v nc >/dev/null 2>&1; then
    echo "nc command not available; skipping Radicale port probe." >&2
    sleep 2
    if ! kill -0 "${RADICALE_PID}" >/dev/null 2>&1; then
      echo "Radicale exited unexpectedly. Last log lines:" >&2
      tail -n 40 "${RADICALE_LOG_FILE}" >&2 || true
      return 1
    fi
    return 0
  fi

  local -a probe_hosts=()
  if [ -n "${RADICALE_LISTEN_HOST}" ]; then
    probe_hosts+=("${RADICALE_LISTEN_HOST}")
  fi
  probe_hosts+=("127.0.0.1" "::1")

  for _ in $(seq 1 "${RADICALE_START_TIMEOUT}"); do
    for host in "${probe_hosts[@]}"; do
      if nc -z "${host}" "${RADICALE_LISTEN_PORT}" >/dev/null 2>&1; then
        echo "Radicale is listening on ${host}:${RADICALE_LISTEN_PORT}."
        return 0
      fi
    done

    if ! kill -0 "${RADICALE_PID}" >/dev/null 2>&1; then
      echo "Radicale exited before opening port ${RADICALE_LISTEN_PORT}. Last log lines:" >&2
      tail -n 40 "${RADICALE_LOG_FILE}" >&2 || true
      wait "${RADICALE_PID}" || true
      return 1
    fi

    sleep 1
  done

  echo "Timed out waiting for Radicale to start on port ${RADICALE_LISTEN_PORT}. Last log lines:" >&2
  tail -n 40 "${RADICALE_LOG_FILE}" >&2 || true
  return 1
}

if ! start_radicale; then
  echo "Radicale failed to start. Exiting." >&2
  exit 1
fi

# Wait for PostgreSQL to accept connections
until pg_isready -h 127.0.0.1 -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; do
  echo "Waiting for PostgreSQL to become ready..."
  sleep 1
done

echo "PostgreSQL is ready. Running Prisma migrations..."
export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public}"

npx --yes prisma generate
npx --yes prisma migrate deploy

echo "Starting FluidCalendar..."
exec "$@"
