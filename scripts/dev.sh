#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  local exit_code=$?

  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

can_open_port() {
  local host="$1"
  local port="$2"

  node -e "
    const net = require('net');
    const socket = net.connect({ host: process.argv[1], port: Number(process.argv[2]) });
    socket.setTimeout(1000);
    socket.on('connect', () => { socket.end(); process.exit(0); });
    socket.on('timeout', () => { socket.destroy(); process.exit(1); });
    socket.on('error', () => process.exit(1));
  " "$host" "$port" >/dev/null 2>&1
}

start_if_free() {
  local port="$1"
  local label="$2"
  shift 2

  if can_open_port 127.0.0.1 "$port"; then
    echo "$label is already running on :$port, so a new process will not be started."
    return 1
  fi

  "$@" &
  return 0
}

if ! command -v docker >/dev/null 2>&1; then
  if can_open_port 127.0.0.1 3307 && can_open_port 127.0.0.1 6379; then
    echo "Docker is unavailable, but existing local MySQL/Redis were detected."
  else
    echo "Docker is required to start MySQL and Redis for local development."
    echo "Either start Docker and retry, or run local MySQL on :3307 and Redis on :6379."
    exit 1
  fi
else
  echo "Starting MySQL and Redis with Docker Compose..."

  if ! docker compose up -d mysql redis; then
    if can_open_port 127.0.0.1 3307 && can_open_port 127.0.0.1 6379; then
      echo "Docker Compose could not start, but existing local MySQL/Redis were detected."
    else
      echo "Docker Compose could not start MySQL/Redis."
      echo "Make sure Docker Desktop or the Docker daemon is running and you have permission to access it."
      echo "If you prefer local services, run MySQL on :3307 and Redis on :6379, then retry."
      exit 1
    fi
  fi
fi

echo "Starting Nest backend on http://localhost:4000 ..."
if start_if_free 4000 "Backend" npm --prefix backend run start:dev; then
  BACKEND_PID=$!
fi

echo "Starting Next frontend on http://localhost:3000 ..."
if start_if_free 3000 "Frontend" npm --prefix frontend run dev; then
  FRONTEND_PID=$!
fi

if [[ -z "${BACKEND_PID:-}" && -z "${FRONTEND_PID:-}" ]]; then
  echo "Frontend and backend are already running. Nothing new was started."
  exit 0
fi

if [[ -n "${BACKEND_PID:-}" && -n "${FRONTEND_PID:-}" ]]; then
  wait -n "$BACKEND_PID" "$FRONTEND_PID"
elif [[ -n "${BACKEND_PID:-}" ]]; then
  wait "$BACKEND_PID"
else
  wait "$FRONTEND_PID"
fi
