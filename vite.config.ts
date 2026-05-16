import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const isGitHubPagesBuild = process.env.GITHUB_PAGES === 'true';

  return {
    base: isGitHubPagesBuild ? '/QuantEdge-AI/' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
            if (id.includes('lightweight-charts') || id.includes('tradingview')) return 'vendor-charts';
            if (id.includes('jspdf') || id.includes('html-to-image')) return 'vendor-export';
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('@google') || id.includes('genai')) return 'vendor-ai';
            if (id.includes('technicalindicators')) return 'vendor-indicators';
            if (id.includes('lucide') || id.includes('motion')) return 'vendor-ui';
            return undefined;
          },
        },
      },
    },
  };
});
