import { LOCAL_AUTH_URL } from '@/config/env';
import { getToken as getLocalToken, getUser as getLocalUser, loginLocal, clearSession, AUTH_EVENT } from '@/integrations/localAuth';

type LocalUser = { id: string; email: string; full_name: string; role: 'user' | 'admin_normal' | 'super_admin' };

function createQueryBuilder(table: string) {
  const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const state = {
    table,
    filters: [] as Array<{ op: 'eq' | 'gte' | 'lte' | 'lt' | 'gt' | 'in'; col: string; val: unknown }>,
    order: null as null | { col: string; ascending: boolean },
    limit: null as null | number,
  };

  function applyFilters(data: unknown[]) {
    let out = Array.isArray(data) ? (data.slice() as Record<string, unknown>[]) : [];
    const isDateCol = (col: string) => (
      col === 'data_validade' || col === 'data_inicio' || col === 'data_fim' || col === 'created_at' || col === 'updated_at' || col === 'data_liberacao'
    );
    type Cmp = number | string;
    const toCmp = (col: string, v: unknown): Cmp => {
      if (v == null) return '';
      if (isDateCol(col)) return new Date(String(v)).getTime();
      const num = Number(v);
      return Number.isNaN(num) ? String(v) : num;
    };
    const cmpOp = (a: Cmp, b: Cmp, op: 'gte' | 'lte' | 'gt' | 'lt') => {
      if (typeof a === 'number' && typeof b === 'number') {
        if (op === 'gte') return a >= b;
        if (op === 'lte') return a <= b;
        if (op === 'gt') return a > b;
        return a < b;
      }
      const as = String(a);
      const bs = String(b);
      if (op === 'gte') return as >= bs;
      if (op === 'lte') return as <= bs;
      if (op === 'gt') return as > bs;
      return as < bs;
    };
    for (const f of state.filters) {
      if (f.op === 'eq') out = out.filter((r) => r?.[f.col] === f.val);
      if (f.op === 'gte') out = out.filter((r) => cmpOp(toCmp(f.col, r?.[f.col]), toCmp(f.col, f.val), 'gte'));
      if (f.op === 'lte') out = out.filter((r) => cmpOp(toCmp(f.col, r?.[f.col]), toCmp(f.col, f.val), 'lte'));
      if (f.op === 'gt') out = out.filter((r) => cmpOp(toCmp(f.col, r?.[f.col]), toCmp(f.col, f.val), 'gt'));
      if (f.op === 'lt') out = out.filter((r) => cmpOp(toCmp(f.col, r?.[f.col]), toCmp(f.col, f.val), 'lt'));
      if (f.op === 'in') {
        const set = new Set(Array.isArray(f.val) ? f.val : [f.val]);
        out = out.filter((r) => set.has(r?.[f.col]));
      }
    }
    if (state.order) {
      const { col, ascending } = state.order;
      out.sort((a, b) => {
        const va = toCmp(col, a?.[col]);
        const vb = toCmp(col, b?.[col]);
        if (va === vb) return 0;
        if (typeof va === 'number' && typeof vb === 'number') return ascending ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
        const as = String(va);
        const bs = String(vb);
        return ascending ? (as < bs ? -1 : 1) : (as > bs ? -1 : 1);
      });
    }
    if (typeof state.limit === 'number') out = out.slice(0, state.limit);
    return out;
  }

  async function getAll() {
    const token = getLocalToken();
    let res: Response;
    try {
      res = await fetchWithTimeout(`${LOCAL_AUTH_URL}/api/${state.table}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (e: any) {
      const message = e?.name === 'AbortError' ? 'Timeout na API local' : 'Falha ao conectar na API local';
      return { data: [], error: { message }, count: 0 };
    }
    if (!res.ok) {
      const text = await res.text();
      return { data: [], error: { message: text || 'Falha na API local' }, count: 0 };
    }
    const data = await res.json();
    const filtered = applyFilters(data);
    return { data: filtered, error: null, count: filtered.length };
  }

  const builder = {
    select: (_cols?: string, _opts?: unknown) => builder,
    eq: (col: string, val: unknown) => { state.filters.push({ op: 'eq', col, val }); return builder; },
    gte: (col: string, val: unknown) => { state.filters.push({ op: 'gte', col, val }); return builder; },
    lte: (col: string, val: unknown) => { state.filters.push({ op: 'lte', col, val }); return builder; },
    gt: (col: string, val: unknown) => { state.filters.push({ op: 'gt', col, val }); return builder; },
    lt: (col: string, val: unknown) => { state.filters.push({ op: 'lt', col, val }); return builder; },
    in: (col: string, vals: unknown[]) => { state.filters.push({ op: 'in', col, val: vals }); return builder; },
    order: (col: string, options?: { ascending?: boolean }) => { state.order = { col, ascending: options?.ascending !== false }; return builder; },
    limit: (n: number) => { state.limit = n; return builder; },
    insert: async (values: unknown) => {
      const token = getLocalToken();
      let res: Response;
      try {
        res = await fetchWithTimeout(`${LOCAL_AUTH_URL}/api/${state.table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(values),
        });
      } catch (e: any) {
        const message = e?.name === 'AbortError' ? 'Timeout ao inserir' : 'Falha ao conectar na API local';
        return { data: [], error: { message } };
      }
      const body = await res.json().catch(() => null);
      const err = res.ok ? null : (body?.error ? { message: String(body.error) } : body || { message: 'Erro ao inserir' });
      return { data: res.ok ? [body] : [], error: err };
    },
    update: async (values: unknown) => {
      const idEq = state.filters.find((f) => f.op === 'eq' && f.col === 'id');
      if (!idEq) return { data: [], error: { message: 'Atualização local requer eq("id", ...)' } };
      const token = getLocalToken();
      let res: Response;
      try {
        res = await fetchWithTimeout(`${LOCAL_AUTH_URL}/api/${state.table}/${idEq.val}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(values),
        });
      } catch (e: any) {
        const message = e?.name === 'AbortError' ? 'Timeout ao atualizar' : 'Falha ao conectar na API local';
        return { data: [], error: { message } };
      }
      const body = await res.json().catch(() => null);
      const err = res.ok ? null : (body?.error ? { message: String(body.error) } : body || { message: 'Erro ao atualizar' });
      return { data: res.ok ? [body] : [], error: err };
    },
    delete: async () => {
      const idEq = state.filters.find((f) => f.op === 'eq' && f.col === 'id');
      if (!idEq) return { data: [], error: { message: 'Remoção local requer eq("id", ...)' } };
      const token = getLocalToken();
      let res: Response;
      try {
        res = await fetchWithTimeout(`${LOCAL_AUTH_URL}/api/${state.table}/${idEq.val}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch (e: any) {
        const message = e?.name === 'AbortError' ? 'Timeout ao remover' : 'Falha ao conectar na API local';
        return { data: [], error: { message } };
      }
      return { data: [], error: res.ok ? null : { message: 'Erro ao remover' } };
    },
    maybeSingle: async () => {
      const list = await getAll();
      return { data: list.data?.[0] ?? null, error: list.error };
    },
    single: async () => {
      const list = await getAll();
      return { data: list.data?.[0] ?? null, error: list.error };
    },
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => getAll().then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => getAll().catch(onRejected),
    finally: (onFinally: () => void) => getAll().finally(onFinally),
  };

  return builder;
}

export const api = {
  auth: {
    async getUser() {
      const u = getLocalUser();
      if (!u) return { data: { user: null }, error: null };
      return {
        data: {
          user: {
            id: u.id,
            email: u.email,
            user_metadata: { full_name: u.full_name, role: u.role },
          },
        },
        error: null,
      };
    },
    async getSession() {
      return { data: { session: null }, error: null };
    },
    onAuthStateChange(callback: (event: string, session: unknown) => void) {
      const handler = () => callback('LOCAL_AUTH_CHANGED', null);
      window.addEventListener(AUTH_EVENT, handler);
      return { data: { subscription: { unsubscribe() { window.removeEventListener(AUTH_EVENT, handler); } } } };
    },
    async signInWithPassword({ email, password }: any) {
      try {
        const user = await loginLocal(email, password);
        return {
          data: {
            user: {
              id: user.id,
              email: user.email,
              user_metadata: { full_name: user.full_name, role: user.role },
            },
            session: null,
          },
          error: null,
        };
      } catch (err: any) {
        return { data: null, error: { message: err.message || 'Erro no login local' } };
      }
    },
    async signOut() {
      clearSession();
      return { error: null };
    },
  },
  from: (table: string) => createQueryBuilder(table),
  rpc: async (fn: string, args?: unknown) => {
    const token = getLocalToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(`${LOCAL_AUTH_URL}/rpc/${fn}`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(args || {}),
      });
    } catch (e: any) {
      clearTimeout(timer);
      const message = e?.name === 'AbortError' ? 'Timeout na RPC local' : 'Falha ao conectar na RPC local';
      return { data: null, error: { message } };
    }
    clearTimeout(timer);
    const body = await res.json().catch(() => null);
    const err = res.ok ? null : (body?.error ? { message: String(body.error) } : body || { message: 'Erro na RPC local' });
    return { data: res.ok ? body : null, error: err };
  },
  functions: {
    async invoke(name: string, _options?: { body?: unknown }) {
      const token = getLocalToken();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(`${LOCAL_AUTH_URL}/functions/${name}`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(_options?.body || {}),
        });
      } catch (e: any) {
        clearTimeout(timer);
        const message = e?.name === 'AbortError' ? 'Timeout em função local' : 'Falha ao conectar na função local';
        return { data: null, error: { message } };
      }
      clearTimeout(timer);
      const body = await res.json().catch(() => null);
      const err = res.ok ? null : (body?.error ? { message: String(body.error) } : body || { message: 'Erro em função local' });
      if (err) return { data: null, error: err };
      return { data: body, error: null };
    },
  },
} as const;

export type { LocalUser };
