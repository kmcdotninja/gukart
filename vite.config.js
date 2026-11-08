import { defineConfig } from 'vite';
// --host in the npm scripts exposes the dev server on your Wi-Fi so you can open it on your phone
export default defineConfig({ server: { host: true }, build: { chunkSizeWarningLimit: 900 } });
