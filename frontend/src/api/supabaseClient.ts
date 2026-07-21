import { createClient } from '@supabase/supabase-js';

// Replace these with your actual values from Supabase Dashboard -> Settings -> API
const supabaseUrl = 'https://kpumxcnqbhpyhkgdyayb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdW14Y25xYmhweWhrZ2R5YXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTMyNjksImV4cCI6MjEwMDIyOTI2OX0._8KyAPhfFoDpBa-1bxr4tNXjBuHuZZfyPoUK0e9tz_g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
