import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
  plugins: [react(), { name: 'mock-supabase', enforce: 'pre', resolveId(id, importer) { if (/(^|\/)supabase$/.test(id) && (id.includes('services') || (importer || '').includes('/services/'))) return path.resolve(__dirname, '_banco/supabase-mock.ts'); } }],
  server: { port: 4177, host: '127.0.0.1' },
});
