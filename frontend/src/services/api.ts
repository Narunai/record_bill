import { supabase } from '../lib/supabase';

type ApiResponse<T> = {
  data: T;
  status: number;
};

type TransactionType = 'income' | 'expense';

type TransactionRow = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  amount_text: string | null;
  category: string;
  note: string | null;
  date: string;
};

type TransactionPayload = {
  type: TransactionType;
  amount: number | string;
  category: string;
  note?: string;
  date?: string;
  amount_text?: string;
};

function createHttpError(status: number, detail: string) {
  const error = new Error(detail) as Error & { response?: { status: number; data: { detail: string } } };
  error.response = { status, data: { detail } };
  return error;
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw createHttpError(401, error.message);
  }
  const userId = data.user?.id;
  if (!userId) {
    throw createHttpError(401, 'Not authenticated');
  }
  return userId;
}

function parsePath(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(normalizedPath, 'http://localhost');
  return {
    pathname: url.pathname.replace(/\/+$/, '') || '/',
    searchParams: url.searchParams,
  };
}

function dateRangeForQuery(searchParams: URLSearchParams) {
  const date = searchParams.get('date');
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  if (date) {
    const start = new Date(`${date}T00:00:00.000`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (month && year) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (year) {
    const start = new Date(Number(year), 0, 1);
    const end = new Date(Number(year) + 1, 0, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  return null;
}

function normalizeAmount(amount: number | string, amountText?: string) {
  const raw = (amountText ?? String(amount)).replace(/\s+/g, '');
  if (!raw) {
    throw createHttpError(400, 'Missing amount');
  }

  const parts = raw.split('+').map((part) => part.trim()).filter(Boolean);
  const values = parts.map((part) => {
    const value = Number(part);
    if (!Number.isFinite(value)) {
      throw createHttpError(400, `Invalid amount part: ${part}`);
    }
    return value;
  });

  if (values.length === 0) {
    throw createHttpError(400, 'Missing amount');
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    total,
    display: raw,
  };
}

async function fetchTransactions(path: string): Promise<ApiResponse<TransactionRow[]>> {
  const { searchParams } = parsePath(path);
  const userId = await getCurrentUserId();

  let query = supabase
    .from('transactions')
    .select('id,user_id,type,amount,amount_text,category,note,date')
    .eq('user_id', userId);

  const range = dateRangeForQuery(searchParams);
  if (range) {
    query = query.gte('date', range.start).lt('date', range.end);
  }

  const { data, error } = await query.order('date', { ascending: false });
  if (error) {
    throw createHttpError(500, error.message);
  }

  return { data: (data ?? []) as TransactionRow[], status: 200 };
}

async function fetchFrequent(path: string): Promise<ApiResponse<{ category: string; count: number }[]>> {
  const { searchParams } = parsePath(path);
  const type = searchParams.get('type');
  if (type !== 'income' && type !== 'expense') {
    throw createHttpError(400, 'Invalid transaction type');
  }

  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('transactions')
    .select('category')
    .eq('user_id', userId)
    .eq('type', type);

  if (error) {
    throw createHttpError(500, error.message);
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const category = (row as { category: string }).category;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const frequent = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { data: frequent, status: 200 };
}

async function insertTransaction(payload: TransactionPayload): Promise<ApiResponse<TransactionRow>> {
  const userId = await getCurrentUserId();
  const { total, display } = normalizeAmount(payload.amount, payload.amount_text);
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: payload.type,
      amount: total,
      amount_text: display,
      category: payload.category,
      note: payload.note || null,
      date: payload.date ?? new Date().toISOString(),
    })
    .select('id,user_id,type,amount,amount_text,category,note,date')
    .single();

  if (error) {
    throw createHttpError(500, error.message);
  }

  return { data: data as TransactionRow, status: 201 };
}

async function updateTransaction(path: string, payload: Partial<TransactionPayload>): Promise<ApiResponse<TransactionRow>> {
  const { pathname } = parsePath(path);
  const transactionId = pathname.split('/').filter(Boolean).pop();
  if (!transactionId) {
    throw createHttpError(400, 'Missing transaction id');
  }

  const updateData: Record<string, unknown> = {};
  if (payload.amount !== undefined) {
    const { total, display } = normalizeAmount(payload.amount, payload.amount_text);
    updateData.amount = total;
    updateData.amount_text = display;
  }
  if (payload.type) updateData.type = payload.type;
  if (payload.category !== undefined) updateData.category = payload.category;
  if (payload.note !== undefined) updateData.note = payload.note || null;
  if (payload.date !== undefined) updateData.date = payload.date;

  const { data, error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', transactionId)
    .select('id,user_id,type,amount,amount_text,category,note,date')
    .single();

  if (error) {
    throw createHttpError(500, error.message);
  }

  return { data: data as TransactionRow, status: 200 };
}

async function deleteTransaction(path: string): Promise<ApiResponse<null>> {
  const { pathname } = parsePath(path);
  const transactionId = pathname.split('/').filter(Boolean).pop();
  if (!transactionId) {
    throw createHttpError(400, 'Missing transaction id');
  }

  const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
  if (error) {
    throw createHttpError(500, error.message);
  }

  return { data: null, status: 204 };
}

const api = {
  async get(path: string): Promise<ApiResponse<any>> {
    if (path.startsWith('/transactions/frequent')) {
      return fetchFrequent(path);
    }
    if (path.startsWith('/transactions')) {
      return fetchTransactions(path);
    }

    throw createHttpError(404, `Unknown GET ${path}`);
  },

  async post(path: string, payload: TransactionPayload): Promise<ApiResponse<any>> {
    if (path.startsWith('/transactions')) {
      return insertTransaction(payload);
    }

    throw createHttpError(404, `Unknown POST ${path}`);
  },

  async put(path: string, payload: Partial<TransactionPayload>): Promise<ApiResponse<any>> {
    if (path.startsWith('/transactions/')) {
      return updateTransaction(path, payload);
    }

    throw createHttpError(404, `Unknown PUT ${path}`);
  },

  async delete(path: string): Promise<ApiResponse<any>> {
    if (path.startsWith('/transactions/')) {
      return deleteTransaction(path);
    }

    throw createHttpError(404, `Unknown DELETE ${path}`);
  },
};

export default api;
