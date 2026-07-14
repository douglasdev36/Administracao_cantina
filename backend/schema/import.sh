#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
USER=$(grep '^POSTGRES_USER=' server.env | cut -d'=' -f2)
DB=$(grep '^POSTGRES_DB=' server.env | cut -d'=' -f2)
if [ ! -f schema/schema.sql ]; then echo "schema/schema.sql não encontrado"; exit 1; fi
cat schema/schema.sql | docker compose exec -T postgres psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1
echo "schema importado"
