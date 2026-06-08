import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cqhfherjakytjraaaxhj.supabase.co";
const SUPABASE_KEY = "sb_publishable_z2QU7gdFPZLxvm4_FIkiMQ_8zWtVB3s";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);