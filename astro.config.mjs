import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify'; // Functions runtime (good for SSR + cookies)

export default defineConfig({
  output: 'server',      // <— enable SSR for all routes
  adapter: netlify(),    // keep the Netlify adapter
});
