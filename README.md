<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

3. **IMPORTANT: Start Jira/Confluence Proxy Server** (Required for CORS):
   ```bash
   cd server
   npm install
   npm run dev
   ```
   This runs the proxy server on port 3001 to handle Jira API calls and prevent CORS errors.

4. Run the main app:
   `npm run dev`

## 🚨 Jira/Confluence Setup - Vite CORS Solution

**Problem**: Direct browser calls to Jira/Confluence APIs fail due to CORS restrictions.

**Solution**: Vite's built-in proxy handles CORS automatically - no separate server needed!

### Vite Proxy Configuration (`vite.config.ts`):
- **Dynamic Jira Proxy**: `/api/jira` → `https://your-domain.atlassian.net/rest/api/3`
- **Dynamic Confluence Proxy**: `/api/confluence` → `https://your-domain.atlassian.net/wiki/api/v2`
- **CORS**: Handled automatically by Vite
- **Auth Headers**: Forwarded to Atlassian APIs
- **Dynamic Retargeting**: Query parameter specifies target domain

### Updated Service (`services/jiraConfluenceMCP.ts`):
- **Built-in Vite Proxy**: Uses `/api/jira?target=https://...` format
- **No Server Dependencies**: Works with `npm run dev` only
- **Error Handling**: Clear messages if Vite dev server not running

### Quick Setup:
```bash
# Just run the Vite dev server
npm run dev

# Test the proxy endpoints
./test-vite-proxy.sh
```

### Production Deployment:
For production, deploy with your production server and configure proxy URLs:
```javascript
const target = 'https://your-company.atlassian.net';
```

**Why This is Better:**
- ✅ No separate proxy server to manage
- ✅ Built-in Vite CORS handling
- ✅ Automatic proxy configuration
- ✅ Less complexity and fewer points of failure

### API Request Format:
```javascript
// Frontend calls (automatically via Vite proxy)
fetch('/api/jira/issue/WIN-5871?target=https://playstudios.atlassian.net/rest/api/3', {
  headers: { 'Authorization': 'Basic ...' }
})
```

**Result**: Jira/Confluence integration works perfectly without CORS issues! 🚀
