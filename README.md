# cantina-IFF

Projeto com frontend (Vite/React) e backend local (Express/Postgres), organizado em duas pastas:

- [frontend/](file:///c:/Users/dodo_/OneDrive/Área%20de%20Trabalho/cantina_IFF-main/frontend) (Vite + React)
- [backend/](file:///c:/Users/dodo_/OneDrive/Área%20de%20Trabalho/cantina_IFF-main/backend) (Express + Postgres + scripts/schema/Supabase)

## Rodar localmente (recomendado)

Pré-requisitos:
- Node.js + npm
- Docker Desktop (para Postgres local via Compose) ou Postgres instalado na máquina

### 1) Banco (Postgres + Adminer)

O `docker-compose.yml` fica em `backend/`.

```sh
cd backend
docker compose up -d
```

Acessos:
- Adminer: http://localhost:8080
- Postgres: porta 5433 (exposta pelo compose)

### 2) Backend (Express)

Crie `backend/.env` a partir de `backend/.env.example` e ajuste as variáveis se necessário.

```sh
cd backend
npm i
npm run dev
```

Por padrão ele sobe em http://localhost:4000.

Usuários padrão (seed automático do backend):
- superadmin@cantina.com / 123456 (role: super_admin)
- admin@cantina.com / 123456 (role: admin_normal)
- user@cantina.com / 123456 (role: user)

### 3) Frontend (Vite)

Crie `frontend/.env.local` a partir de `frontend/.env.example` e confirme:
- `VITE_USE_LOCAL_DB=true`
- `VITE_LOCAL_AUTH_URL=http://localhost:4000`

```sh
cd frontend
npm i
npm run dev
```
