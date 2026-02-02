#!/bin/bash

echo "🔍 FINAL Jira CORS FIX - Simple & Reliable"
echo ""

echo "📋 1. Install dependencies..."
if command -v npx &> /dev/null; then
  echo "Using npx to run Vite"
  npx vite dev
else
  echo "Using local Vite"
  npm run dev
fi

echo ""
echo "🎯 2. Jira CORS Fix - Using Vite built-in proxy..."
echo ""

# Create simple vite config for Jira proxy
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    cors: true,
    proxy: {
      // Jira API proxy - handles CORS automatically
      '/api': {
        target: 'https://playstudios.atlassian.net',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
EOF

echo "✅ Vite proxy configuration created"
echo ""

echo "🚀 3. Start development server..."
npm run dev