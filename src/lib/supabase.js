// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qczgbxfffqcdhctutdhq.supabase.co';      // ← 換成你的
const SUPABASE_ANON_KEY = '<eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjemdieGZmZnFjZGhjdHV0ZGhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNTUzMTksImV4cCI6MjA3MjczMTMxOX0.TXRjLlwhYaa6fK9Zk71_bnbSF_IGHSngj7NpvR9_AOU>';                  // ← 換成你的

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
