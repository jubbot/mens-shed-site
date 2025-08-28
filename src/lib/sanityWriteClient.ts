import { sanity } from './sanityClient';

// Reuse the already-correct projectId/dataset/apiVersion from `sanity`
export const sanityWrite = sanity.withConfig({
  token: import.meta.env.SANITY_WRITE_TOKEN, // <-- only extra thing you need
  useCdn: false,                              // writes must bypass the CDN
  perspective: 'published',
});
