import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Vite tidak pernah meng-inline ikon tab, jadi untuk build satu file ikon dibenamkan di sini. */
function inlineIcons(): Plugin {
  const types: Record<string, string> = { png: 'image/png', svg: 'image/svg+xml' };
  return {
    name: 'inline-icons',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace(/(<link rel="(?:icon|apple-touch-icon)"[^>]*href=")\/([^"]+\.(png|svg))"/g, (_, head: string, path: string, ext: string) => {
          const data = readFileSync(new URL(path, import.meta.url)).toString('base64');
          return `${head}data:${types[ext]};base64,${data}"`;
        }),
    },
  };
}

// `npm run build`        -> dist/ biasa (untuk hosting: Netlify, Vercel, GitHub Pages, itch.io)
// `npm run build:single` -> dist-single/index.html (satu file, semua aset di-inline)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [inlineIcons(), viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
}));
