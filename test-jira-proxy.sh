#!/bin/bash

# Test Jira CORS bypass functionality
# This script tests the Vite proxy configuration for bypassing CORS issues

echo "Testing Jira API CORS bypass through Vite proxy..."
echo ""

# Test 1: Direct access (should fail with CORS)
echo "1. Testing direct Jira API access (should fail with CORS):"
curl -v \
  'https://playstudios.atlassian.net/rest/api/3/issue/WIN-3641' \
  -H 'Accept: application/json' \
  2>&1 | head -10
echo ""

# Test 2: Proxy access (should work)
echo "2. Testing proxy access through Vite dev server:"
echo "   Make sure Vite dev server is running on http://localhost:3000"
echo ""

# This simulates what the Jira MCP service now does
TARGET_URL="https://playstudios.atlassian.net/rest/api/3/issue/WIN-3641"
ENCODED_TARGET=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TARGET_URL'))")

curl -v \
  "http://localhost:3000/api/jira?target=$ENCODED_TARGET" \
  -H 'Accept: application/json' \
  -H 'Authorization: Basic bmhvbmhAZ2VhcmdhbWVzLmNvbTpBVEFUVDN4RmZHRjA3UlR5Z2ZlbGtsVDZDT0xlaWRhdXVrU0tjVmlBbEVlWENzSEpLWUVDRmkyY2JGdjVvcUh2cHZ5LVdnYko5VS1BWUROQkdfSEwtU1N4bkRqTjEwcTE2R3JJWEpYRFo4VDZHcEJmNWNKX3ZySUpaTTA3TEhGWm91U2xSZ05zYlQ3b2lJLVZqTEl6VXF3MjdrODFQNkI3S2pkVXhUZ2hlckZjZUpLX1FObW5yUnc9NjQ2REJFNzE=' \
  2>&1 | head -20
echo ""

# Test 3: Confluence proxy access
echo "3. Testing Confluence proxy access:"
CONFLUENCE_TARGET="https://playstudios.atlassian.net/wiki/api/v2/search?cql=text~\"WIN-3641\""
ENCODED_CONFLUENCE=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$CONFLUENCE_TARGET'))")

curl -v \
  "http://localhost:3000/api/confluence?target=$ENCODED_CONFLUENCE" \
  -H 'Accept: application/json' \
  -H 'Authorization: Basic bmhvbmhAZ2VhcmdhbWVzLmNvbTpBVEFUVDN4RmZHRjA3UlR5Z2ZlbGtsVDZDT0xlaWRhdXVrU0tjVmlBbEVlWENzSEpLWUVDRmkyY2JGdjVvcUh2cHZ5LVdnYko5VS1BWUROQkdfSEwtU1N4bkRqTjEwcTE2R3JJWEpYRFo4VDZHcEJmNWNKX3ZySUpaTTA3TEhGWm91U2xSZ05zYlQ3b2lJLVZqTEl6VXF3MjdrODFQNkI3S2pkVXhUZ2hlckZjZUpLX1FObW5yUnc9NjQ2REJFNzE=' \
  2>&1 | head -10
echo ""

echo "4. Expected behavior:"
echo "   - Direct access should show CORS error"
echo "   - Proxy access should succeed (if Vite dev server is running)"
echo "   - Proxy requests will have proper Host and Origin headers for Atlassian"
echo ""

echo "To run tests:"
echo "1. Start Vite dev server: npm run dev"
echo "2. Run this script: ./test-jira-proxy.sh"