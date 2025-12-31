import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

// Database type definitions
export interface PixivImage {
    id: string;
    pid: number;
    title: string;
    artist: string;
    tags: string[];
    original_url: string;
    r2_url: string | null;
    created_at: string;
}

export interface CrawlerSettings {
    id: string;
    cron_expression: string;
    tags: string[];
    r18_enabled: boolean;
    updated_at: string;
}

// Singleton clients
let serverClient: SupabaseClient | null = null;
let browserClient: SupabaseClient | null = null;

// Server-side client with service role key (for API routes)
export function createServerClient(): SupabaseClient {
    if (serverClient) return serverClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('Missing Supabase environment variables');
    }

    serverClient = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return serverClient;
}

// Client-side client with anon key (for browser)
export function createBrowserClient(): SupabaseClient {
    if (browserClient) return browserClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
    }

    browserClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);

    return browserClient;
}

