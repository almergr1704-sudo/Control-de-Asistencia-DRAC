import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppOrigin } from '../types';
import { getApiUrl } from '../utils/apiConfig';

/**
 * UNIFIED SUPABASE CLIENT - DIRECCIÓN REGIONAL DE AGRICULTURA CAJAMARCA (DRAC)
 *
 * ÚNICA FUENTE DE VERDAD CENTRALIZADA POSTGRESQL PARA CLIENTE WEB Y ESCRITORIO (DESKTOP)
 */

const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
const procEnv = typeof process !== 'undefined' ? process.env : undefined;

const DEFAULT_PLACEHOLDER_URL = 'https://rfqgmoremevypexrrsyf.supabase.co';
const DEFAULT_PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcWdtb3JlbWV2eXBleHJyc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNjI3MTksImV4cCI6MjEwMzgzODcxOX0.L7VOne8N24590LxLZrYTmDPovu-Qs3Xibct6G0vhz5I';
const STORAGE_KEY = 'drac_supabase_config';

export function cleanSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return DEFAULT_PLACEHOLDER_URL;
  return rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') || DEFAULT_PLACEHOLDER_URL;
}

export function getSavedSupabaseConfig(): { url: string; anonKey: string; isCustom: boolean } {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.url && parsed?.anonKey) {
          return {
            url: cleanSupabaseUrl(parsed.url),
            anonKey: String(parsed.anonKey).trim(),
            isCustom: true,
          };
        }
      }
    } catch (_) {}
  }

  const envUrl = cleanSupabaseUrl(metaEnv?.VITE_SUPABASE_URL || procEnv?.VITE_SUPABASE_URL || DEFAULT_PLACEHOLDER_URL);
  const envKey = String(metaEnv?.VITE_SUPABASE_ANON_KEY || procEnv?.VITE_SUPABASE_ANON_KEY || DEFAULT_PLACEHOLDER_KEY).trim();
  return { url: envUrl, anonKey: envKey, isCustom: false };
}

export function isPlaceholderSupabaseUrl(url?: string): boolean {
  const cleaned = cleanSupabaseUrl(url || getSavedSupabaseConfig().url);
  return (
    !cleaned ||
    cleaned.includes('rfqgmoremevypexrrsyf.supabase.co') ||
    cleaned.includes('your-project-ref.supabase.co')
  );
}

// Detect whether running in Desktop (Electron / Node Webview / Localhost) or Web (Cloud)
export function getAppOrigin(): AppOrigin {
  if (typeof window !== 'undefined') {
    const isElectron =
      !!(window as any).electronAPI?.isDesktop ||
      !!(window as any).electronAPI ||
      !!(window as any).process?.type ||
      !!(window as any).electron;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isElectron) return 'DESKTOP';
    if (isLocalhost && (window as any).__DRAC_DESKTOP_CLIENT__) return 'DESKTOP';
  }
  return 'WEB';
}

let supabaseInstance: SupabaseClient | null = null;
let activeCfg = getSavedSupabaseConfig();

function createConfiguredClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    activeCfg = getSavedSupabaseConfig();
    supabaseInstance = createConfiguredClient(activeCfg.url, activeCfg.anonKey);
  }
  return supabaseInstance;
}

export let supabase: SupabaseClient = getSupabaseClient();

export async function updateSupabaseConfig(url: string, anonKey: string): Promise<void> {
  const cleanedUrl = cleanSupabaseUrl(url);
  const cleanedKey = String(anonKey || '').trim();
  if (typeof window !== 'undefined') {
    if (cleanedUrl && cleanedKey && !isPlaceholderSupabaseUrl(cleanedUrl)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: cleanedUrl, anonKey: cleanedKey }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  activeCfg = {
    url: cleanedUrl || DEFAULT_PLACEHOLDER_URL,
    anonKey: cleanedKey || DEFAULT_PLACEHOLDER_KEY,
    isCustom: !!cleanedKey && !isPlaceholderSupabaseUrl(cleanedUrl),
  };
  supabaseInstance = createConfiguredClient(activeCfg.url, activeCfg.anonKey);
  supabase = supabaseInstance;

  try {
    await fetch(getApiUrl('/api/supabase/config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: activeCfg.url, anonKey: activeCfg.anonKey }),
    });
  } catch (_) {}
}

/**
 * Diagnostic helper to verify REAL connectivity with Supabase PostgreSQL
 */
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  latencyMs: number;
  url: string;
  appOrigin: AppOrigin;
  sourceOfTruth: 'SUPABASE_POSTGRESQL' | 'LOCAL_HYBRID';
  isPlaceholder: boolean;
  error?: string;
}> {
  const origin = getAppOrigin();
  const cfg = getSavedSupabaseConfig();
  const placeholder = isPlaceholderSupabaseUrl(cfg.url);
  const startTime = Date.now();

  if (placeholder) {
    return {
      connected: false,
      latencyMs: 0,
      url: cfg.url,
      appOrigin: origin,
      sourceOfTruth: 'LOCAL_HYBRID',
      isPlaceholder: true,
      error: 'Instancia Supabase por defecto no configurada (URL de ejemplo inexistente en DNS). Configure una URL y Anon Key válidas para sincronización en la nube.',
    };
  }

  try {
    const client = getSupabaseClient();
    const { error } = await client.from('marcaciones_raw').select('id', { count: 'exact', head: true });
    if (!error) {
      return {
        connected: true,
        latencyMs: Math.max(5, Date.now() - startTime),
        url: cfg.url,
        appOrigin: origin,
        sourceOfTruth: 'SUPABASE_POSTGRESQL',
        isPlaceholder: false,
      };
    }
    return {
      connected: false,
      latencyMs: Math.max(5, Date.now() - startTime),
      url: cfg.url,
      appOrigin: origin,
      sourceOfTruth: 'LOCAL_HYBRID',
      isPlaceholder: false,
      error: error.message,
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: Math.max(5, Date.now() - startTime),
      url: cfg.url,
      appOrigin: origin,
      sourceOfTruth: 'LOCAL_HYBRID',
      isPlaceholder: false,
      error: err?.message || 'Error de red conectando a Supabase',
    };
  }
}

/**
 * OFFLINE QUEUE HELPER FOR DESKTOP CLIENT
 */
interface OfflineOperation {
  id: string;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: string;
  retryCount: number;
  origin: AppOrigin;
}

const OFFLINE_QUEUE_KEY = 'drac_supabase_offline_queue';

export function getOfflineQueue(): OfflineOperation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>): void {
  if (typeof window === 'undefined') return;
  const queue = getOfflineQueue();
  const newOp: OfflineOperation = {
    ...operation,
    id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };
  queue.push(newOp);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function flushOfflineQueue(
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; processed: number; failed: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { success: true, processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  const remaining: OfflineOperation[] = [];

  for (let i = 0; i < queue.length; i++) {
    const op = queue[i];
    try {
      const res = await fetch(getApiUrl(`/api/${op.table}`), {
        method: op.action === 'INSERT' ? 'POST' : op.action === 'UPDATE' ? 'PUT' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Origin': op.origin,
        },
        body: JSON.stringify(op.payload),
      });

      if (res.ok) {
        processed++;
      } else {
        op.retryCount++;
        remaining.push(op);
        failed++;
      }
    } catch {
      op.retryCount++;
      remaining.push(op);
      failed++;
    }

    if (onProgress) {
      onProgress(i + 1, queue.length);
    }
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  return { success: failed === 0, processed, failed };
}
