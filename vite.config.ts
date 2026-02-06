import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@services': resolve(__dirname, './services'),
      '@types': resolve(__dirname, './types'),
    }
  },
  
  build: {
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: false,
    
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-ai': ['@google/genai'],
          'services-core': [
            './services/geminiService',
            './services/githubService',
            './services/modelRotation',
          ],
          'services-analysis': [
            './services/performanceAnalyzer',
            './services/breakingChangeDetector',
            './services/codeDuplicationDetector',
            './services/dependencyScanner',
          ],
          'services-ui': [
            './services/darkMode',
            './services/exportService',
            './services/keyboardShortcuts',
            './services/progressTracker',
          ],
          'services-data': [
            './services/reviewHistory',
            './services/reviewPresets',
            './services/contextCache',
          ],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    
    chunkSizeWarningLimit: 500,
    
    reportCompressedSize: true,
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react', '@google/genai'],
    exclude: [],
  },
  
  esbuild: {
    target: 'es2022',
    legalComments: 'none',
    treeShaking: true,
  },
  
  server: {
    port: 3000,
    cors: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api/jira': {
        target: 'https://playstudios.atlassian.net',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const urlObj = new URL(req.url!, 'http://localhost');
            const targetParam = urlObj.searchParams.get('target');
            
            if (targetParam) {
              const targetUrl = new URL(targetParam);
              proxyReq.path = targetUrl.pathname + targetUrl.search;
              proxyReq.setHeader('Host', targetUrl.host);
              proxyReq.setHeader('Origin', targetUrl.origin);
            }
          });
        },
        rewrite: (path) => {
          const urlObj = new URL(path, 'http://localhost');
          const targetParam = urlObj.searchParams.get('target');
          if (targetParam) {
            const targetUrl = new URL(targetParam);
            return targetUrl.pathname + targetUrl.search;
          }
          return path;
        }
      },
      '/api/confluence': {
        target: 'https://playstudios.atlassian.net',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const urlObj = new URL(req.url!, 'http://localhost');
            const targetParam = urlObj.searchParams.get('target');
            
            if (targetParam) {
              const targetUrl = new URL(targetParam);
              proxyReq.path = targetUrl.pathname + targetUrl.search;
              proxyReq.setHeader('Host', targetUrl.host);
              proxyReq.setHeader('Origin', targetUrl.origin);
            }
          });
        },
        rewrite: (path) => {
          const urlObj = new URL(path, 'http://localhost');
          const targetParam = urlObj.searchParams.get('target');
          if (targetParam) {
            const targetUrl = new URL(targetParam);
            return targetUrl.pathname + targetUrl.search;
          }
          return path;
        }
      }
    }
  },
  
  preview: {
    port: 4173,
    cors: true,
  }
})
