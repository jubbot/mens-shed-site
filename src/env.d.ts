/// <reference types="astro/client" />
import type { SupabaseClient, User } from '@supabase/supabase-js';

declare namespace App {
  interface Locals {
    supabase: SupabaseClient;
    user: User | null;
  }
}
