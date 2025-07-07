// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://flwobdnthnnnuwlvpirx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsd29iZG50aG5ubnV3bHZwaXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMzMwMzAsImV4cCI6MjA2NjYwOTAzMH0.1d12wEbb5NH1_rDmhlwWcr2pEWpLHZ8QM-5UFvGCmwU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)