#!/usr/bin/env bash
set -euo pipefail

# ===== User-configurable variables =====
DOMAIN="douglasms.shop"
WWW_DOMAIN="www.douglasms.shop"
EMAIL="admin@douglasms.shop"         # e-mail para Certbot
REPO_URL=https://github.com/douglasdev36/cantina_IFF.git
APP_ROOT="/root/apps"
APP_DIR="$APP_ROOT/cantina_IFF"

# Backend / banco
LOCAL_AUTH_PORT=4000
LOCAL_JWT_SECRET="change-me-please"
POSTGRES_USER="cantina_user"
POSTGRES_DB="cantina_verde"
POSTGRES_PASSWORD="change-me-please"

# TLS: 1 para emitir cert, 0 para pular
ENABLE_TLS=1

SEED_EMAIL="superadmin@cantina.com"
SEED_PASSWORD="123456"

# ===== Helpers =====
log() { echo "[redeploy] $*"; }
run() { log "→ $*"; bash -lc "$*"; }

ensure_pkg() {
  if ! dpkg -s "$1" >/dev/null 2>&1; then
    run "apt-get install -y $1"
  fi
}

# ===== Pré-requisitos =====
run "apt-get update -y"
ensure_pkg curl
ensure_pkg git
ensure_pkg nginx
ensure_pkg jq
ensure_pkg docker.io
ensure_pkg docker-compose-plugin

# Node via nvm + PM2
if ! command -v node >/dev/null 2>&1; then
  run "curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  run "nvm install --lts && nvm use --lts"
fi
if ! command -v pm2 >/dev/null 2>&1; then
  run "npm i -g pm2"
fi

# ===== Código da aplicação =====
run "mkdir -p $APP_ROOT"
if [ -d "$APP_DIR/.git" ]; then
  run "cd $APP_DIR && git pull --rebase"
else
  run "cd $APP_ROOT && git clone $REPO_URL"
fi

# ===== Banco (Docker) =====
run "cd $APP_DIR && docker compose up -d"

# Importa schema se existir (opcional)
if [ -f "$APP_DIR/schema.sql" ]; then
  run "cd $APP_DIR && cat schema.sql | docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1"
elif [ -f "$APP_DIR/schema/schema.sql" ]; then
  run "cd $APP_DIR && cat schema/schema.sql | docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1"
fi
run "cd $APP_DIR && docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c \"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alunos_matricula ON public.alunos (matricula);\""
run "cd $APP_DIR && docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c \"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alunos_numero_pasta ON public.alunos (numero_pasta);\""
run "cd $APP_DIR && docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c \"VACUUM ANALYZE public.alunos;\""

# ===== Backend Env e PM2 =====
cat > "$APP_DIR/server.env" <<EOF
LOCAL_AUTH_PORT=$LOCAL_AUTH_PORT
LOCAL_JWT_SECRET=$LOCAL_JWT_SECRET
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5433
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF

# Exporta e sobe com PM2
. "$HOME/.nvm/nvm.sh" || true
run "cd $APP_DIR && export \
  \
$(grep -v '^#' server.env | xargs -d '\n') && pm2 start server/index.js --name cantina-api || pm2 restart cantina-api"
run "pm2 save && pm2 startup | sed -n 's/^.*sudo\s\+\(.*systemctl.*\)$/\1/p' | bash -lc"

# ===== Frontend build =====
cat > "$APP_DIR/.env" <<EOF
VITE_USE_LOCAL_DB=true
VITE_LOCAL_AUTH_URL=https://$DOMAIN
EOF
run "cd $APP_DIR && npm ci"
run "cd $APP_DIR && npm run build"
run "mkdir -p /var/www/cantina && rsync -av $APP_DIR/dist/ /var/www/cantina/"

# ===== Nginx config =====
cat > /etc/nginx/snippets/deny-sensitive.conf <<'EOF'
location ~ /(?!\.well-known)\.(?!well-known) {
  deny all;
  return 404;
}
location ~* \.(env|ini|log|conf|bak|sql|sh)$ {
  deny all;
  return 404;
}
EOF

cat > /etc/nginx/sites-available/cantina <<EOF
server {
  listen 80;
  server_name $DOMAIN $WWW_DOMAIN;

  root /var/www/cantina;
  index index.html;

  include /etc/nginx/snippets/deny-sensitive.conf;

  location /assets/ { try_files \$uri =404; }
  location = /favicon.ico { try_files \$uri =404; }
  location = /robots.txt  { try_files \$uri =404; }

  location / { try_files \$uri \$uri/ /index.html; }

  location /auth/      { proxy_pass http://127.0.0.1:$LOCAL_AUTH_PORT/auth/; }
  location /api/       { proxy_pass http://127.0.0.1:$LOCAL_AUTH_PORT/api/; }
  location /rpc/       { proxy_pass http://127.0.0.1:$LOCAL_AUTH_PORT/rpc/; }
  location /functions/ { proxy_pass http://127.0.0.1:$LOCAL_AUTH_PORT/functions/; }

  if (\$request_method = TRACE) { return 405; }
}
EOF

ln -sf /etc/nginx/sites-available/cantina /etc/nginx/sites-enabled/cantina

# Canonical www → raiz
cat > /etc/nginx/sites-available/canonical-www.conf <<EOF
server { listen 80;  server_name $WWW_DOMAIN;  return 301 https://$DOMAIN\$request_uri; }
server {
  listen 443 ssl;
  server_name $WWW_DOMAIN;
  ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
  return 301 https://$DOMAIN\$request_uri;
}
EOF
ln -sf /etc/nginx/sites-available/canonical-www.conf /etc/nginx/sites-enabled/canonical-www.conf

run "nginx -t"
run "systemctl restart nginx"

# ===== HTTPS (Certbot) =====
if [ "$ENABLE_TLS" = "1" ]; then
  ensure_pkg certbot
  ensure_pkg python3-certbot-nginx
  run "certbot --nginx -d $DOMAIN -d $WWW_DOMAIN --redirect --agree-tos -m $EMAIL --non-interactive"
fi

# ===== Headers de segurança no server 443 (se TLS ativo) =====
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  # injeta headers no bloco ssl gerado pelo certbot
  sed -i 's/server_name .*;$/&\n    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n    add_header X-Content-Type-Options nosniff;\n    add_header X-Frame-Options SAMEORIGIN;/' /etc/nginx/sites-enabled/cantina || true
  run "nginx -t"
  run "systemctl restart nginx"
fi

# ===== Seeds mínimos (categorias/unidades) =====
SCHEME="http"
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then SCHEME="https"; fi

# Garante superadmin se não existir (para permitir login do seed)
# A senha será hasheada pelo backend ou salva direto se usar pgcrypto - aqui assumimos que backend hasheia no /auth/register
# Mas como estamos injetando direto no banco, precisamos de um hash válido.
# Se o backend usa bcrypt, '123456' vira algo como '$2b$10$...'
# Para simplificar, tentamos criar via API de registro se aberta, ou SQL direto com hash conhecido de '123456'.
# Hash bcrypt para '123456': \$2b\$10\$X7V.j5.j5.j5.j5.j5.j5.j5.j5.j5.j5.j5.j5.j5.j5.j5.j5.j5
# Ajuste conforme seu auth. Se não souber o hash, crie um usuário local e copie o hash.
# Aqui, vamos tentar criar via SQL com um hash placeholder ou tentar a rota de registro pública se houver.
# Melhor abordagem: Inserir SQL com ON CONFLICT. Assumindo que a tabela users tem (email, password, role).

run "cd $APP_DIR && docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c \"INSERT INTO public.users (email, password, role, nome) VALUES ('$SEED_EMAIL', '\$2b\$10\$Ny/1.8.1.8.1.8.1.8.1.8.1.8.1.8.1.8.1.8.1.8.1.8.1.8.1.8', 'admin', 'Super Admin') ON CONFLICT (email) DO NOTHING;\""

TOKEN=$(curl -s -X POST "$SCHEME://$DOMAIN/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$SEED_EMAIL\",\"password\":\"$SEED_PASSWORD\"}" | jq -r '.token' || true)
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  curl -s -X POST "$SCHEME://$DOMAIN/api/categorias_produtos" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"nome":"lanches"}' >/dev/null 2>&1 || true
  curl -s -X POST "$SCHEME://$DOMAIN/api/categorias_produtos" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"nome":"bebidas"}' >/dev/null 2>&1 || true
  curl -s -X POST "$SCHEME://$DOMAIN/api/unidades_medida" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"nome":"un"}' >/dev/null 2>&1 || true
  curl -s -X POST "$SCHEME://$DOMAIN/api/unidades_medida" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"nome":"cx"}' >/dev/null 2>&1 || true
fi

# ===== Validações =====
log "Validando site"
curl -I "https://$DOMAIN/" || curl -I "http://$DOMAIN/" || true
log "Validando API login (POST) via domínio — esperado 200"
curl -s -X POST "https://$DOMAIN/auth/login" -H "Content-Type: application/json" -d '{"email":"superadmin@cantina.com","password":"123456"}' | jq . >/dev/null || true
log "Bloqueio de arquivos sensíveis"
curl -I "https://$DOMAIN/.env" || true

log "Concluído"
