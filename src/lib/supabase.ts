import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const url =
  import.meta.env
    .VITE_SUPABASE_URL;

const chavePublicavel =
  import.meta.env
    .VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigurado =
  Boolean(
    url &&
      chavePublicavel &&
      !url.includes(
        "SEU-PROJETO"
      )
  );

export const supabase:
  | SupabaseClient
  | null =
  supabaseConfigurado
    ? createClient(
        url,
        chavePublicavel,
        {
          auth: {
            persistSession:
              true,
            autoRefreshToken:
              true,
            detectSessionInUrl:
              true,
          },
        }
      )
    : null;
