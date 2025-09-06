import { createClient } from '@supabase/supabase-js';

// TODO: 換成你的 Supabase 專案憑證（Anon Key）
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://YOUR-PROJECT.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR-ANON-KEY'
);
