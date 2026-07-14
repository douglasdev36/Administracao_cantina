#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T postgres pg_dump -U cantina_user -d cantina_verde --schema-only --no-owner --no-privileges > schema/schema.sql
echo "schema.sql atualizado em schema/schema.sql"
