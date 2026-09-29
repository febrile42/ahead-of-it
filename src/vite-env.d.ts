/// <reference types="vite/client" />

// PH3-04 (DIA-230): the Umami website id is build-time config (an
// env/repo variable, never source) — unset by default, which is what
// keeps this a no-op build (see src/analytics.ts).
interface ImportMetaEnv {
  readonly VITE_UMAMI_WEBSITE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
