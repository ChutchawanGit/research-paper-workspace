import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dmrrwxgxojxihrnbjprs.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcnJ3eGd4b2p4aWhybmJqcHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NTU2NTUsImV4cCI6MjExMDUzMTY1NX0.JOAtbhV_plIdINb7vmeGbAtFfkS5fVlghGTJA28KLsk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
