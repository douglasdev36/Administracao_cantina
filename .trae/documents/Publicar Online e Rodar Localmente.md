## Objetivo

Colocar o sistema online (frontend + backend + banco Postgres) e manter um caminho alternativo para rodar tudo localmente.

## Caminho Online (Vercel + Render + Neon)

1. Banco (Neon Postgres)

* Criar um banco no Neon.
* Aplicar o schema do projeto (arquivo `backend/schema/schema.sql`) no banco do Neon.

1. Backend (Render)

* Criar um serviço Web no Render apontando para a pasta `backend/`.
* Configurar variáveis de ambiente do Postgres:
  * `POSTGRES_HOST`
  * `POSTGRES_PORT`
  * `POSTGRES_DB`
  * `POSTGRES_USER`
  * `POSTGRES_PASSWORD`
* Configurar também:
  * `LOCAL_JWT_SECRET`

1. Frontend (Vercel)

* Importar o repositório e configurar build:
  * Build: `vite build`
  * Output: `dist`
* Variáveis de ambiente do build:
  * `VITE_LOCAL_AUTH_URL` (URL pública do backend no Render, ex.: `https://seu-backend.onrender.com`)

## Caminho Local (Alternativo)

1. Preparar ambiente

* Instalar deps:
  * `frontend/`: `npm.cmd i`
  * `backend/`: `npm.cmd i`
* Subir Postgres/Adminer: `docker compose up -d` (Adminer em `http://localhost:8080`).

1. Iniciar backend local (Express)

* `npm.cmd run dev` em `backend/` → `http://localhost:4000`.

1. Iniciar frontend

* `npm.cmd run dev` em `frontend/` → `http://localhost:8081` (ou a porta que o Vite escolher).
* Configurar `VITE_LOCAL_AUTH_URL=http://localhost:4000`.

1. Testes locais

* Login: `superadmin@cantina.com / 123456`, `admin@cantina.com / 123456`, `user@cantina.com / 123456`.
* Cardápio: cria/ativa cardápios (com `tipo_refeicao`).
* Liberação: matrícula (12) ou pasta (4); insere em `liberacoes_lanche`.
