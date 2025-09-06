// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://<你的-project-ref>.supabase.co';      // ← 換成你的
const SUPABASE_ANON_KEY = '<你的 anon public key>';                  // ← 換成你的

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
