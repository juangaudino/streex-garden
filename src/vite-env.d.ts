/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Enable only on plans where Supabase Storage image transformations are available. */
  readonly VITE_SUPABASE_IMAGE_TRANSFORMS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
