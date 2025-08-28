import { createClient } from '@sanity/client';

const projectId  = import.meta.env.PUBLIC_SANITY_PROJECT_ID!;
const dataset    = import.meta.env.PUBLIC_SANITY_DATASET!;
const apiVersion = import.meta.env.SANITY_API_VERSION || '2025-01-01';

// --- 1) Reader: published-only (safe for pages/components)
export const sanity = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: import.meta.env.DEV ? false : true, // CDN in prod
  perspective: 'published',
});

// --- 2) (Optional) Preview reader: drafts + published if you still use it
const readToken = import.meta.env.SANITY_READ_TOKEN;
export const sanityPreview = readToken
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: false,
      token: readToken,
      perspective: 'previewDrafts',
    })
  : null;

// --- 3) Server writer: use ONLY in API routes / server utilities
const writeToken = import.meta.env.SANITY_WRITE_TOKEN;
export const sanityServer = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: writeToken,          // requires write role; NEVER expose to client
  perspective: 'published',   // mutations affect published docs
});
