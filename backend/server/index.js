// Simple local auth server (Express + Postgres)
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();
const app = express();
const PORT = process.env.PORT || process.env.LOCAL_AUTH_PORT || 4000;
const JWT_SECRET = process.env.LOCAL_JWT_SECRET || 'dev_secret_change_me';

function normalizeDate(input) {
  if (!input) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, '0');
    const d = String(input.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(input).trim();
  const isoMatch = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return s.split('T')[0].split(' ')[0];
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return normalizeDate(d);
  return null;
}

// Read DB env (fallbacks to VITE_* to reuse existing .env.local)
const DATABASE_URL = process.env.DATABASE_URL;
const DB = {
  host: process.env.POSTGRES_HOST || process.env.LOCAL_DB_HOST || process.env.VITE_LOCAL_DB_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || process.env.LOCAL_DB_PORT || process.env.VITE_LOCAL_DB_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || process.env.LOCAL_DB_NAME || process.env.VITE_LOCAL_DB_NAME || 'cantina_verde',
  user: process.env.POSTGRES_USER || process.env.LOCAL_DB_USER || process.env.VITE_LOCAL_DB_USER || 'cantina_user',
  password: process.env.POSTGRES_PASSWORD || process.env.LOCAL_DB_PASSWORD || process.env.VITE_LOCAL_DB_PASSWORD || 'cantina_password',
};

const sslEnabled =
  String(process.env.POSTGRES_SSL || '').toLowerCase() === 'true' ||
  (DATABASE_URL ? DATABASE_URL.includes('sslmode=require') : false) ||
  String(DB.host || '').includes('neon.tech');

const pool = new Pool(
  DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
      }
    : {
        ...DB,
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
      }
);

const extraCorsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOriginPatterns = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/\[::1\]:\d+$/,
  /^https?:\/\/.*\.vercel\.app$/,
];
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (extraCorsOrigins.includes(origin)) return true;
  return allowedOriginPatterns.some((p) => p.test(origin));
};
app.use(cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

process.on('unhandledRejection', (err) => {
  console.error('Rejeição não tratada', err);
});

process.on('uncaughtException', (err) => {
  console.error('Exceção não tratada', err);
});

async function ensureSchema() {
  // Garantir coluna numero_pasta em alunos e preencher valores padrão
  await pool.query(`ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS numero_pasta TEXT;`);
  await pool.query(`ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS data_nascimento DATE;`);
  await pool.query(`UPDATE public.alunos SET numero_pasta = RIGHT(matricula, 4)
                    WHERE numero_pasta IS NULL AND matricula IS NOT NULL;`);
  await pool.query(`ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS e_bolsista BOOLEAN DEFAULT false;`);
  // Garantir colunas de compatibilidade em cardapios e liberacoes_lanche
  await pool.query(`ALTER TABLE public.cardapios ADD COLUMN IF NOT EXISTS tipo_refeicao TEXT CHECK (tipo_refeicao IN ('lanche','almoco')) DEFAULT 'lanche';`);
  await pool.query(`ALTER TABLE public.cardapios ADD COLUMN IF NOT EXISTS data_inicio DATE;`);
  await pool.query(`ALTER TABLE public.cardapios ADD COLUMN IF NOT EXISTS data_fim DATE;`);
  await pool.query(`UPDATE public.cardapios SET data_inicio = COALESCE(data_inicio, CURRENT_DATE) WHERE data_inicio IS NULL;`);
  await pool.query(`UPDATE public.cardapios SET data_fim = COALESCE(data_fim, CURRENT_DATE) WHERE data_fim IS NULL;`);
  await pool.query(`ALTER TABLE public.cardapios ALTER COLUMN data_inicio SET NOT NULL;`);
  await pool.query(`ALTER TABLE public.cardapios ALTER COLUMN data_fim SET NOT NULL;`);
  await pool.query(`ALTER TABLE public.liberacoes_lanche ADD COLUMN IF NOT EXISTS turma_nome TEXT;`);
  await pool.query(`ALTER TABLE public.liberacoes_lanche ADD COLUMN IF NOT EXISTS cardapio_nome TEXT;`);
  await pool.query(`ALTER TABLE public.liberacoes_lanche ADD COLUMN IF NOT EXISTS tipo_refeicao TEXT CHECK (tipo_refeicao IN ('lanche','almoco')) DEFAULT 'lanche';`);
  await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
  await pool.query(`ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS data_validade DATE;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS one_active_cardapio ON public.cardapios ((1)) WHERE ativo = true;`);
  const defaults = [
    { email: 'superadmin@cantina.com', full_name: 'Super Administrador', role: 'super_admin', password: '123456' },
    { email: 'admin@cantina.com', full_name: 'Administrador', role: 'admin_normal', password: '123456' },
    { email: 'user@cantina.com', full_name: 'Usuário', role: 'user', password: '123456' },
  ];
  for (const u of defaults) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO public.users (email, full_name, role, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             role = EXCLUDED.role,
             password_hash = EXCLUDED.password_hash`,
      [u.email, u.full_name, u.role, hash]
    );
    await pool.query(
      `INSERT INTO public.user_roles (user_id, role)
       SELECT id, $1 FROM public.users WHERE email=$2
       ON CONFLICT (user_id, role) DO NOTHING`,
      [u.role, u.email]
    );
  }
}

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const { rows } = await pool.query(
      'SELECT id, email, full_name, role, password_hash FROM public.users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Credenciais inválidas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign(
      { user_id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  if (parts[0] !== 'Bearer' || !parts[1]) return res.status(401).json({ error: 'Token ausente' });
  try {
    const payload = jwt.verify(parts[1], JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

app.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email, full_name, role FROM public.users WHERE id=$1', [req.user.user_id]);
    const u = rows[0];
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado' });
    return res.json({ user: u });
  } catch (err) {
    console.error('Me error', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// Protege APIs e funções com autenticação
app.use(['/api', '/rpc', '/functions'], authMiddleware);

function hasPermission(role, method, table, payload = {}) {
  if (role === 'super_admin') return true;
  if (role === 'admin_normal') {
    if (table === 'users') return false;
    if (table === 'user_roles') return false;
    if (table === 'alunos' || table === 'turmas') return method !== 'DELETE';
    if (table === 'cardapios') return true;
    if (table === 'produtos' || table === 'categorias_produtos' || table === 'unidades_medida') return true;
    if (table === 'liberacoes_lanche') return method === 'GET' || method === 'POST';
    if (table === 'movimentacoes_estoque') return method === 'GET';
    return method === 'GET';
  }
  if (role === 'user') {
    if (table === 'liberacoes_lanche') return method === 'GET' || method === 'POST';
    if (table === 'cardapios') {
      if (method === 'PUT') {
        const keys = Object.keys(payload || {});
        return keys.length > 0 && keys.every((k) => k === 'ativo');
      }
      return method === 'GET';
    }
    if (table === 'alunos' || table === 'turmas' || table === 'produtos' || table === 'categorias_produtos' || table === 'unidades_medida' || table === 'movimentacoes_estoque') {
      return method === 'GET';
    }
    return false;
  }
  return false;
}

function deny(res) {
  res.status(403).json({ error: 'Permissão negada' });
}

function pgToHttpError(table, e) {
  const code = e?.code;
  const constraint = e?.constraint ? String(e.constraint) : '';
  const column = e?.column ? String(e.column) : '';
  const detail = e?.detail ? String(e.detail) : '';
  const message = e?.message ? String(e.message) : '';

  if (code === '23505') {
    if (constraint === 'alunos_matricula_key') return { status: 409, error: 'Matrícula já cadastrada' };
    if (constraint === 'categorias_produtos_nome_key') return { status: 409, error: 'Categoria já cadastrada' };
    if (constraint === 'unidades_medida_nome_key') return { status: 409, error: 'Unidade já cadastrada' };
    if (constraint) return { status: 409, error: `Registro duplicado (${constraint})` };
    return { status: 409, error: 'Registro duplicado' };
  }

  if (code === '23503') {
    if (constraint === 'alunos_turma_id_fkey') return { status: 400, error: 'Turma inválida (não encontrada)' };
    if (constraint) return { status: 400, error: `Referência inválida (${constraint})` };
    return { status: 400, error: 'Referência inválida' };
  }

  if (code === '23514') {
    if (constraint) return { status: 400, error: `Valor inválido (${constraint})` };
    return { status: 400, error: 'Valor inválido' };
  }

  if (code === '22P02') {
    if (message.includes('uuid')) return { status: 400, error: 'Formato inválido (UUID)' };
    return { status: 400, error: 'Formato inválido' };
  }

  if (code === '42703') {
    const col = column || (message.match(/column "([^"]+)"/i)?.[1] ?? '');
    if (col) return { status: 500, error: `Schema do banco está desatualizado (coluna ${col} não existe)` };
    return { status: 500, error: 'Schema do banco está desatualizado (coluna inexistente)' };
  }

  if (table === 'alunos' && detail) return { status: 400, error: detail };

  return { status: 500, error: 'Erro interno' };
}

// ------------------------
// API de dados (CRUD simples)
// ------------------------
const ALLOWED_TABLES = new Set([
  'alunos',
  'turmas',
  'produtos',
  'categorias_produtos',
  'unidades_medida',
  'cardapios',
  'itens_cardapio',
  'liberacoes_lanche',
  'movimentacoes_estoque',
  'users',
  'user_roles',
]);

function ensureTableAllowed(table, res) {
  if (!ALLOWED_TABLES.has(table)) {
    res.status(404).json({ error: `Tabela ${table} não permitida` });
    return false;
  }
  return true;
}

app.get('/api/:table', async (req, res) => {
  const { table } = req.params;
  if (!ensureTableAllowed(table, res)) return;
  if (!hasPermission(req.user?.role, 'GET', table)) return deny(res);
  try {
    // Join simples para enriquecer movimentações com dados do produto
    if (table === 'movimentacoes_estoque') {
      const { rows } = await pool.query(
        `SELECT m.*, p.nome AS produto_nome, p.unidade AS produto_unidade
         FROM public.movimentacoes_estoque m
         LEFT JOIN public.produtos p ON p.id = m.produto_id
         ORDER BY m.created_at DESC`
      );
      const enriched = rows.map((r) => ({
        ...r,
        produtos: { nome: r.produto_nome, unidade: r.produto_unidade },
      }));
      return res.json(enriched);
    }

    // Enriquecer liberações com nomes de turma e cardápio e objeto alunos
    if (table === 'liberacoes_lanche') {
      const { rows } = await pool.query(
        `SELECT ll.*,
                COALESCE(t.nome, '-') AS turma_nome,
                COALESCE(c.nome, '-') AS cardapio_nome,
                COALESCE(c.tipo_refeicao, ll.tipo_refeicao) AS tipo_refeicao,
                a.nome AS aluno_nome,
                a.matricula AS aluno_matricula,
                a.numero_pasta AS aluno_numero_pasta
         FROM public.liberacoes_lanche ll
         LEFT JOIN public.alunos a ON a.id = ll.aluno_id
         LEFT JOIN public.turmas t ON t.id = a.turma_id
         LEFT JOIN public.cardapios c ON c.id = ll.cardapio_id
         ORDER BY ll.data_liberacao DESC`
      );
      const enriched = rows.map((r) => ({
        ...r,
        alunos: r.aluno_nome ? { nome: r.aluno_nome, matricula: r.aluno_matricula, numero_pasta: r.aluno_numero_pasta } : null,
      }));
      return res.json(enriched);
    }

    // Enriquecer alunos com objeto turmas
    if (table === 'alunos') {
      const { rows } = await pool.query(
        `SELECT a.*, t.nome AS turma_nome
         FROM public.alunos a
         LEFT JOIN public.turmas t ON t.id = a.turma_id
         ORDER BY a.nome ASC`
      );
      const enriched = rows.map((r) => ({
        ...r,
        turmas: r.turma_nome ? { nome: r.turma_nome } : null,
      }));
      return res.json(enriched);
    }

    const { rows } = await pool.query(`SELECT * FROM public.${table}`);
    // Evita expor hash de senha
    const safe = rows.map((r) => {
      if (table === 'users' && 'password_hash' in r) {
        const { password_hash, ...rest } = r;
        return rest;
      }
      return r;
    });
    res.json(safe);
  } catch (e) {
    console.error('GET list error', table, e);
    const out = pgToHttpError(table, e);
    res.status(out.status).json({ error: out.error });
  }
});

app.get('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  if (!ensureTableAllowed(table, res)) return;
  if (!hasPermission(req.user?.role, 'GET', table)) return deny(res);
  try {
    const { rows } = await pool.query(`SELECT * FROM public.${table} WHERE id=$1`, [id]);
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'Registro não encontrado' });
    if (table === 'users' && 'password_hash' in r) {
      const { password_hash, ...rest } = r;
      return res.json(rest);
    }
    res.json(r);
  } catch (e) {
    console.error('GET by id error', table, e);
    const out = pgToHttpError(table, e);
    res.status(out.status).json({ error: out.error });
  }
});

app.post('/api/:table', async (req, res) => {
  const { table } = req.params;
  const raw = req.body;
  const payload = raw == null ? {} : raw;
  if (!ensureTableAllowed(table, res)) return;
  if (!hasPermission(req.user?.role, 'POST', table, payload)) return deny(res);
  try {
    const items = Array.isArray(payload) ? payload : [payload];
    if (items.length === 0) return res.status(400).json({ error: 'Payload vazio' });
    const results = [];
    for (const item of items) {
      let data = { ...(item || {}) };
      if (Object.keys(data).length === 0) continue;
      if (table === 'users' && 'password' in data) {
        const hash = await bcrypt.hash(String(data.password), 10);
        delete data.password;
        data.password_hash = hash;
      }
      if (table === 'cardapios' && data.ativo === true) {
        await pool.query(`UPDATE public.cardapios SET ativo=false`);
      }
      if (table === 'cardapios') {
        if ('data_inicio' in data) data.data_inicio = normalizeDate(data.data_inicio);
        if ('data_fim' in data) data.data_fim = normalizeDate(data.data_fim);
      }
      if (table === 'produtos') {
        if ('data_validade' in data) data.data_validade = normalizeDate(data.data_validade);
      }
      if (table === 'alunos') {
        if ('data_nascimento' in data) data.data_nascimento = normalizeDate(data.data_nascimento);
        if ('numero_pasta' in data && data.numero_pasta != null) {
          let np = String(data.numero_pasta).trim().replace(/\D/g, '');
          if (np.length > 4) np = np.slice(-4);
          if (np.length > 0) np = np.padStart(4, '0');
          data.numero_pasta = np;
        }
      }
      const dataKeys = Object.keys(data);
      const cols = dataKeys.map((k) => `"${k}"`).join(', ');
      const placeholders = dataKeys.map((_, i) => `$${i + 1}`).join(', ');
      const values = dataKeys.map((k) => data[k]);
      const { rows } = await pool.query(
        `INSERT INTO public.${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      let r = rows[0];
      if (table === 'users' && 'password_hash' in r) {
        const { password_hash, ...rest } = r;
        r = rest;
      }
      results.push(r);
    }
    if (results.length === 0) return res.status(400).json({ error: 'Payload vazio' });
    res.status(201).json(items.length === 1 ? results[0] : results);
  } catch (e) {
    console.error('POST error', table, e);
    const out = pgToHttpError(table, e);
    res.status(out.status).json({ error: out.error });
  }
});

app.put('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  const payload = req.body || {};
  if (!ensureTableAllowed(table, res)) return;
  if (!hasPermission(req.user?.role, 'PUT', table, payload)) return deny(res);
  try {
    let data = { ...payload };
    const keys = Object.keys(data);
    if (keys.length === 0) return res.status(400).json({ error: 'Payload vazio' });
    if (table === 'users' && 'password' in data) {
      const hash = await bcrypt.hash(String(data.password), 10);
      delete data.password;
      data.password_hash = hash;
    }
    if (table === 'cardapios' && data.ativo === true) {
      await pool.query(`UPDATE public.cardapios SET ativo=false WHERE id<>$1`, [id]);
    }
    if (table === 'cardapios') {
      if ('data_inicio' in data) data.data_inicio = normalizeDate(data.data_inicio);
      if ('data_fim' in data) data.data_fim = normalizeDate(data.data_fim);
    }
    if (table === 'produtos') {
      if ('data_validade' in data) data.data_validade = normalizeDate(data.data_validade);
    }
    if (table === 'alunos') {
      if ('data_nascimento' in data) data.data_nascimento = normalizeDate(data.data_nascimento);
      if ('numero_pasta' in data && data.numero_pasta != null) {
        let np = String(data.numero_pasta).trim().replace(/\D/g, '');
        if (np.length > 4) np = np.slice(-4);
        if (np.length > 0) np = np.padStart(4, '0');
        data.numero_pasta = np;
      }
    }
    const setExpr = keys.map((k, i) => `"${k}"=$${i + 1}`).join(', ');
    const values = keys.map((k) => data[k]);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE public.${table} SET ${setExpr} WHERE id=$${values.length} RETURNING *`,
      values
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'Registro não encontrado' });
    if (table === 'users' && 'password_hash' in r) {
      const { password_hash, ...rest } = r;
      return res.json(rest);
    }
    res.json(r);
  } catch (e) {
    console.error('PUT error', table, e);
    const out = pgToHttpError(table, e);
    res.status(out.status).json({ error: out.error });
  }
});

app.delete('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  if (!ensureTableAllowed(table, res)) return;
  if (!hasPermission(req.user?.role, 'DELETE', table)) return deny(res);
  try {
    if (table === 'users') {
      await pool.query(`UPDATE public.liberacoes_lanche SET usuario_id = NULL WHERE usuario_id = $1`, [id]);
      await pool.query(`UPDATE public.movimentacoes_estoque SET usuario_id = NULL WHERE usuario_id = $1`, [id]);
    }
    const { rowCount } = await pool.query(`DELETE FROM public.${table} WHERE id=$1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Registro não encontrado' });
    res.status(204).send();
  } catch (e) {
    console.error('DELETE error', table, e);
    const out = pgToHttpError(table, e);
    res.status(out.status).json({ error: out.error });
  }
});

// ------------------------
// RPCs equivalentes
// ------------------------
app.post('/rpc/update_produto_estoque', async (req, res) => {
  const role = req.user?.role;
  if (!['admin_normal', 'super_admin'].includes(role)) {
    return res.status(403).json({ error: 'Permissão negada' });
  }
  let { produto_id, tipo, quantidade, observacao, usuario_id } = req.body || {};
  // Compatibilidade com payload usado no frontend
  if (!tipo && req.body?.tipo_movimentacao) tipo = req.body.tipo_movimentacao;
  if (!quantidade && req.body?.nova_quantidade) quantidade = req.body.nova_quantidade;
  if (!produto_id || !tipo || !quantidade) return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
  if (!['entrada', 'saida'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  const qty = Number(quantidade);
  if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Quantidade inválida' });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const op = tipo === 'entrada' ? '+' : '-';
    await client.query(
      `UPDATE public.produtos SET quantidade_estoque = GREATEST(0, quantidade_estoque ${op} $1), updated_at = NOW() WHERE id=$2`,
      [qty, produto_id]
    );
    await client.query(
      `INSERT INTO public.movimentacoes_estoque (produto_id, tipo, quantidade, observacao, usuario_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [produto_id, tipo, qty, observacao || null, usuario_id || null]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    console.error('RPC update_produto_estoque error', e);
    const out = pgToHttpError('update_produto_estoque', e);
    res.status(out.status).json({ error: out.error });
  } finally {
    if (client) client.release();
  }
});

// ------------------------
// Funções (aproximação de Edge Functions)
// ------------------------
app.post('/functions/liberacoes_history', async (req, res) => {
  const { limit = 10 } = req.body || {};
  try {
    const { rows } = await pool.query(
      `SELECT ll.id, ll.data_liberacao, ll.observacao,
              COALESCE(t.nome, '-') AS turma_nome,
              COALESCE(c.nome, ll.cardapio_nome, '-') AS cardapio_nome,
              COALESCE(c.tipo_refeicao, ll.tipo_refeicao) AS tipo_refeicao,
              a.id AS aluno_id,
              a.nome AS aluno_nome,
              a.matricula AS aluno_matricula,
              a.numero_pasta AS aluno_numero_pasta
       FROM public.liberacoes_lanche ll
       LEFT JOIN public.alunos a ON a.id = ll.aluno_id
       LEFT JOIN public.turmas t ON t.id = a.turma_id
       LEFT JOIN public.cardapios c ON c.id = ll.cardapio_id
       ORDER BY ll.data_liberacao DESC
       LIMIT $1`,
      [limit]
    );
    const liberacoes = rows.map((r) => ({
      id: String(r.id),
      data_liberacao: r.data_liberacao,
      observacao: r.observacao,
      turma_nome: r.turma_nome || '-',
      cardapio_nome: r.cardapio_nome || '-',
      tipo_refeicao: r.tipo_refeicao || 'lanche',
      aluno: r.aluno_id ? {
        id: String(r.aluno_id),
        nome: r.aluno_nome,
        matricula: r.aluno_matricula,
        numero_pasta: r.aluno_numero_pasta,
      } : null,
    }));
    res.json({ liberacoes });
  } catch (e) {
    console.error('functions liberacoes_history error', e);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/functions/buscar_aluno', async (req, res) => {
  // Aceitar alias 'query' por compatibilidade
  const { codigo: codigoRaw, query } = req.body || {};
  const codigo = codigoRaw ?? query;
  const raw = String(codigo ?? '').trim();
  const normalized = raw.replace(/\D/g, '');
  if (!normalized) return res.status(400).json({ error: 'Código ausente' });
  try {
    let row;
    if (normalized.length === 12) {
      const { rows } = await pool.query(
        `SELECT a.id, a.nome, a.matricula, a.numero_pasta, a.turma_id,
                a.e_bolsista,
                t.nome as turma_nome
         FROM public.alunos a
         LEFT JOIN public.turmas t ON t.id = a.turma_id
         WHERE a.matricula = $1
         LIMIT 1`,
        [normalized]
      );
      row = rows[0];
    } else if (normalized.length >= 1 && normalized.length <= 4) {
      const candidates = Array.from(
        new Set(
          [
            normalized,
            normalized.padStart(4, '0'),
            normalized.replace(/^0+/, ''),
          ].filter((v) => v && v.length > 0)
        )
      );
      const { rows } = await pool.query(
        `SELECT a.id, a.nome, a.matricula, a.numero_pasta, a.turma_id,
                a.e_bolsista,
                t.nome as turma_nome
         FROM public.alunos a
         LEFT JOIN public.turmas t ON t.id = a.turma_id
         WHERE a.numero_pasta = ANY($1::text[])
         LIMIT 1`,
        [candidates]
      );
      row = rows[0];
    }
    if (!row) return res.json({ aluno: null });
    const aluno = {
      id: String(row.id),
      nome: row.nome,
      matricula: row.matricula,
      numero_pasta: row.numero_pasta,
      turma_nome: row.turma_nome || 'Sem turma',
      e_bolsista: Boolean(row.e_bolsista),
    };
    res.json({ aluno });
  } catch (e) {
    console.error('functions buscar_aluno error', e);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.listen(PORT, async () => {
  try {
    await ensureSchema();
    console.log(`Local auth server running at http://localhost:${PORT}`);
  } catch (e) {
    console.error('Erro ao inicializar schema/seed:', e);
    console.log(`Local auth server running at http://localhost:${PORT}`);
  }
});
