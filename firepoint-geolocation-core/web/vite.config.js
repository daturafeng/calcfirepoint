import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
export default defineConfig({
    plugins: [react(), cesium()],
    // Cesium's engine imports this CommonJS package with a default import.  It
    // must be pre-bundled so the browser receives an ESM-compatible default.
    optimizeDeps: { include: ['mersenne-twister'] },
});
