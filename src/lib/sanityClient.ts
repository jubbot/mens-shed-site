// src/lib/sanityClient.ts
// Minimal no-op stub so Netlify build succeeds
export const sanityClient = {
  fetch: async <T = unknown>(_query?: string, _params?: Record<string, unknown>): Promise<T> => {
    return [] as unknown as T; // return empty arrays by default
  },
};

// Optional helper some codebases use for images:
export function urlForImage(_src: unknown): { url: () => string } {
  return { url: () => "" };
}
