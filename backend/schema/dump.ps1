$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSCommandPath -Parent)
Set-Location ..
docker compose exec -T postgres pg_dump -U cantina_user -d cantina_verde --schema-only --no-owner --no-privileges | Out-File -Encoding UTF8 "./schema/schema.sql"
Write-Output "schema.sql atualizado em schema/schema.sql"
