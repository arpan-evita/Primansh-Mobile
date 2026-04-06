import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder";

// Enhanced environment logging for debugging "Failed to fetch"
if (typeof window !== 'undefined') {
  console.log("%c[Supabase Initialization]", "color: #3b82f6; font-weight: bold;");
  
  if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes("placeholder")) {
    console.warn("CRITICAL: VITE_SUPABASE_URL is missing or using placeholder! Requests will fail.");
  } else {
    console.log("URL:", supabaseUrl);
  }

  if (!import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY === "placeholder") {
    console.warn("CRITICAL: VITE_SUPABASE_ANON_KEY is missing or using placeholder!");
  } else {
    console.log("Anon Key: Valid snippet detected (" + supabaseAnonKey.substring(0, 8) + "...)");
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to test connection explicitly from the console or UI
export const testSupabaseConnection = async () => {
  try {
    console.log("Testing connection to:", supabaseUrl);
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) {
      console.error("Connection test failed:", error.message);
      return { success: false, error: error.message };
    }
    console.log("Connection test successful! Database is reachable.");
    return { success: true };
  } catch (err: any) {
    console.error("System error during connection test:", err.message);
    return { success: false, error: err.message };
  }
};
