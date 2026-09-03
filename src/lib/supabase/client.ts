import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/config";

export { isSupabaseConfigured, isLiveMode, isShowcaseMode } from "@/lib/config";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Cliente de navegador con sesión persistente. Se reutiliza entre componentes. */
export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey)
    throw new Error("Supabase no está configurado");
  cached ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
  return cached;
}
