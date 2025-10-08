# Raspberry Pi Deployment with Built-in CalDAV (Radicale)

This guide explains how to build and run FluidCalendar on a Raspberry Pi using a
single Docker container that bundles the web application, PostgreSQL, and a
Radicale CalDAV server.

## Prerequisites

- Raspberry Pi 4 (or newer) running a 64-bit OS (Debian/Raspberry Pi OS bookworm
  recommended)
- Docker and Docker Compose installed
- At least 4 GB of RAM and 10 GB of free disk space

## Build the multi-service image

Clone the repository on the Raspberry Pi and run one of the following commands
from the project root:

```bash
docker build -f docker/pi/Dockerfile -t fluid-calendar-pi .
```

The Dockerfile targets Debian bookworm and works on both AMD64 and ARM64, so it
will compile correctly on the Raspberry Pi.

Alternatively, use the provided Compose file to build and run in a single step
with persistent volumes already configured:

```bash
docker compose -f docker-compose.pi.yml up -d --build
```

## Run the container

Create a directory to persist database and CalDAV data:

```bash
mkdir -p ~/fluidcalendar-data/postgres ~/fluidcalendar-data/radicale
```

Start the container and mount the data directories:

```bash
docker run -d \
  --name fluidcalendar \
  -p 3000:3000 \
  -p 5232:5232 \
  -e POSTGRES_USER=fluid \
  -e POSTGRES_PASSWORD=fluid \
  -e POSTGRES_DB=fluid_calendar \
  -e RADICALE_USERNAME=fluid \
  -e RADICALE_PASSWORD=fluid \
  -v ~/fluidcalendar-data/postgres:/var/lib/postgresql \
  -v ~/fluidcalendar-data/radicale:/var/lib/radicale \
  fluid-calendar-pi
```

> **Tip:** Set `POSTGRES_PASSWORD`, `RADICALE_USERNAME`, and `RADICALE_PASSWORD`
> to secure values before deploying in production.

The container exposes three services:

- `3000/tcp` – FluidCalendar web UI
- `5232/tcp` – Radicale CalDAV endpoint
- `5432/tcp` – PostgreSQL server

## Initial credentials and environment variables

The container automatically provisions the PostgreSQL database and Radicale
user on first start. The following environment variables control the defaults:

| Variable | Description | Default |
| --- | --- | --- |
| `POSTGRES_USER` | PostgreSQL role created for the app | `fluid` |
| `POSTGRES_PASSWORD` | Password for the PostgreSQL role | `fluid` |
| `POSTGRES_DB` | PostgreSQL database name | `fluid_calendar` |
| `POSTGRES_PORT` | Internal PostgreSQL port | `5432` |
| `RADICALE_USERNAME` | Radicale Basic Auth username | `fluid` |
| `RADICALE_PASSWORD` | Radicale Basic Auth password | `fluid` |
| `RADICALE_BASE_URL` | Internal CalDAV base URL used by the app | `http://localhost:5232` |
| `DATABASE_URL` | Prisma connection string (auto-generated if omitted) | `postgresql://fluid:fluid@127.0.0.1:5432/fluid_calendar?schema=public` |

## Connect FluidCalendar to the bundled CalDAV server

Use the following values inside the FluidCalendar UI when adding a CalDAV
account:

- **Server URL:** `http://radicale:5232` when using Docker Compose with the same
  container name, or `http://localhost:5232` when accessing from the host
- **Username/Password:** values from `RADICALE_USERNAME` and `RADICALE_PASSWORD`

The Radicale instance stores calendars under `/var/lib/radicale/collections`.
Mount this directory to persist calendar data between container restarts.

## Stopping the container

```bash
docker stop fluidcalendar && docker rm fluidcalendar
```

Stopping the container gracefully shuts down the Node.js server, Radicale, and
PostgreSQL.
