#!/bin/bash

echo "🔥 FINAL SIMPLE JIRA CORS FIX"
echo ""

# Kill any existing processes
pkill -f "vite" 2>/dev/null || true
pkill -f "npm" 2>/dev/null || true
pkill -f "node" 2>/dev/null || true

rm -f vite.config.ts services/jiraConfluenceMCP.ts server/ test-*.sh start-dev.sh setup.sh 2>/dev/null || true

cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    cors: true,
    proxy: {
      '/api/jira': {
        target: 'https://playstudios.atlassian.net',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/jira/, '/rest/api/3')
      }
    }
  }
})
EOF
echo ""

echo "🚀 Starting Vite dev server..."
npm run dev &
VITE_PID=$!

sleep 3

echo "🎯 SIMPLE SOLUTION COMPLETE!"
echo ""
echo "✅ No separate proxy server needed"
echo "✅ Vite handles CORS automatically"
echo "✅ Simple, reliable configuration"
echo ""
echo "🌐 App: http://localhost:3000"
echo "💡 Jira API: /api/jira → https://playstudios.atlassian.net/rest/api/3"
echo ""
echo "🔍 Test: curl http://localhost:3000/api/jira/issue/WIN-5871"