// מולאים לאחר יצירת פרויקט ב-Supabase (Settings → API)
const SUPABASE_URL = 'REPLACE_ME_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'REPLACE_ME_SUPABASE_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
