#!/bin/bash
# Switch deployment platform for OAuth configuration
# Usage: ./scripts/switch-platform.sh [vercel|netlify|cloudflare|local]
#
# Note: All platforms use the same custom domain (shorteam.j0araya.com)
# You need to update DNS records in Cloudflare to point to the selected platform

set -e

PLATFORM=$1
ENV_FILE=".env"
CUSTOM_DOMAIN="shorteam.j0araya.com"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to get platform URL (compatible with Bash 3.x)
get_platform_url() {
    case $1 in
        local)
            echo "http://localhost:3002"
            ;;
        vercel|netlify|cloudflare)
            echo "https://$CUSTOM_DOMAIN"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Function to print usage
usage() {
    echo -e "${YELLOW}Usage: ./scripts/switch-platform.sh [platform]${NC}"
    echo ""
    echo "Available platforms (all use custom domain: $CUSTOM_DOMAIN):"
    echo -e "  ${GREEN}local${NC}      - http://localhost:3002"
    echo -e "  ${GREEN}vercel${NC}     - https://$CUSTOM_DOMAIN (DNS → Vercel)"
    echo -e "  ${GREEN}netlify${NC}    - https://$CUSTOM_DOMAIN (DNS → Netlify)"
    echo -e "  ${GREEN}cloudflare${NC} - https://$CUSTOM_DOMAIN (DNS → Cloudflare Pages)"
    echo ""
    echo "Examples:"
    echo "  ./scripts/switch-platform.sh local"
    echo "  ./scripts/switch-platform.sh vercel"
    echo "  ./scripts/switch-platform.sh netlify"
    echo "  ./scripts/switch-platform.sh cloudflare"
    echo ""
    echo "Note: When switching platforms, you need to update DNS records in Cloudflare"
    exit 1
}

# Check if platform argument is provided
if [ -z "$PLATFORM" ]; then
    echo -e "${RED}Error: Platform not specified${NC}"
    usage
fi

# Get the URL for the selected platform
PLATFORM_URL=$(get_platform_url "$PLATFORM")

# Check if platform is valid
if [ -z "$PLATFORM_URL" ]; then
    echo -e "${RED}Error: Invalid platform '$PLATFORM'${NC}"
    usage
fi

echo -e "${YELLOW}Switching to platform: ${GREEN}$PLATFORM${NC}"
echo -e "${YELLOW}URL: ${GREEN}$PLATFORM_URL${NC}"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Creating .env file from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        touch .env
    fi
fi

# Update or add NEXTAUTH_URL in .env
if grep -q "^NEXTAUTH_URL=" "$ENV_FILE"; then
    # Use different sed syntax for macOS vs Linux
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$PLATFORM_URL|" "$ENV_FILE"
    else
        sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$PLATFORM_URL|" "$ENV_FILE"
    fi
    echo -e "${GREEN}✅ Updated NEXTAUTH_URL in .env${NC}"
else
    echo "NEXTAUTH_URL=$PLATFORM_URL" >> "$ENV_FILE"
    echo -e "${GREEN}✅ Added NEXTAUTH_URL to .env${NC}"
fi

# Display current configuration
echo ""
echo -e "${YELLOW}Current OAuth configuration:${NC}"
grep "^NEXTAUTH_URL=" "$ENV_FILE"
echo ""

# Calculate OAuth redirect URI
REDIRECT_URI="$PLATFORM_URL/api/auth/callback/google"
echo -e "${YELLOW}OAuth Redirect URI:${NC}"
echo -e "${GREEN}$REDIRECT_URI${NC}"
echo ""

# Remind user to update Google Cloud Console
echo -e "${YELLOW}⚠️  Remember to update Google Cloud Console:${NC}"
echo "   1. Go to: https://console.cloud.google.com/apis/credentials?project=short-team"
echo "   2. Edit your OAuth 2.0 Client ID"
echo "   3. Add redirect URI: $REDIRECT_URI"
echo ""

# Update platform-specific environment variables if needed
case $PLATFORM in
    vercel)
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}For Vercel deployment:${NC}"
        echo ""
        echo -e "${GREEN}1. Add custom domain to Vercel:${NC}"
        echo "   vercel domains add $CUSTOM_DOMAIN"
        echo ""
        echo -e "${GREEN}2. Update DNS in Cloudflare:${NC}"
        echo "   Type: CNAME"
        echo "   Name: shorteam"
        echo "   Target: cname.vercel-dns.com"
        echo "   Proxy: Off (DNS only)"
        echo ""
        echo -e "${GREEN}3. Set environment variable:${NC}"
        echo "   vercel env rm NEXTAUTH_URL production"
        echo "   echo \"$PLATFORM_URL\" | vercel env add NEXTAUTH_URL production"
        echo ""
        echo -e "${GREEN}4. Deploy:${NC}"
        echo "   vercel --prod"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        ;;
    netlify)
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}For Netlify deployment:${NC}"
        echo ""
        echo -e "${GREEN}1. Add custom domain to Netlify:${NC}"
        echo "   Go to: Site settings > Domain management > Add custom domain"
        echo "   Or use: netlify domains:add $CUSTOM_DOMAIN"
        echo ""
        echo -e "${GREEN}2. Update DNS in Cloudflare:${NC}"
        echo "   Type: CNAME"
        echo "   Name: shorteam"
        echo "   Target: <your-netlify-site>.netlify.app"
        echo "   Proxy: Off (DNS only)"
        echo ""
        echo -e "${GREEN}3. Set environment variable:${NC}"
        echo "   netlify env:set NEXTAUTH_URL \"$PLATFORM_URL\""
        echo ""
        echo -e "${GREEN}4. Deploy:${NC}"
        echo "   netlify deploy --prod"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        ;;
    cloudflare)
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}For Cloudflare Pages deployment:${NC}"
        echo ""
        echo -e "${GREEN}1. Add custom domain in Cloudflare Pages:${NC}"
        echo "   Dashboard > Workers & Pages > short-app > Custom domains"
        echo "   Add: $CUSTOM_DOMAIN"
        echo ""
        echo -e "${GREEN}2. DNS is automatically configured (Cloudflare manages both)${NC}"
        echo ""
        echo -e "${GREEN}3. Set environment variable:${NC}"
        echo "   Update NEXTAUTH_URL in Cloudflare Pages dashboard"
        echo "   Or use: wrangler pages secret put NEXTAUTH_URL"
        echo "   Value: $PLATFORM_URL"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        ;;
esac

echo ""
echo -e "${GREEN}✅ Platform switched successfully!${NC}"
