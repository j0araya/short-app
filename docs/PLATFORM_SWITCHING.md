# Platform Switching Guide

This guide explains how to switch between deployment platforms (Vercel, Netlify, Cloudflare Pages) for OAuth authentication.

## Quick Start

```bash
# Switch to Vercel
./scripts/switch-platform.sh vercel

# Switch to Netlify
./scripts/switch-platform.sh netlify

# Switch to Cloudflare Pages
./scripts/switch-platform.sh cloudflare

# Switch back to local development
./scripts/switch-platform.sh local
```

## What the Script Does

The `switch-platform.sh` script automatically:

1. **Updates `.env` file** with the correct `NEXTAUTH_URL` for the selected platform
2. **Shows the OAuth redirect URI** that needs to be configured in Google Cloud Console
3. **Provides platform-specific commands** for updating environment variables in production

## Supported Platforms

| Platform | URL | OAuth Redirect URI |
|----------|-----|-------------------|
| **Local** | `http://localhost:3002` | `http://localhost:3002/api/auth/callback/google` |
| **Vercel** | `https://short-app-gray.vercel.app` | `https://short-app-gray.vercel.app/api/auth/callback/google` |
| **Netlify** | `https://shorteam.netlify.app` | `https://shorteam.netlify.app/api/auth/callback/google` |
| **Cloudflare** | `https://short-app.pages.dev` | `https://short-app.pages.dev/api/auth/callback/google` |

## Complete Deployment Workflow

### 1. Switch Platform Locally

```bash
./scripts/switch-platform.sh vercel
```

### 2. Update Google Cloud Console

The script will output the exact redirect URI you need to add. Example output:

```
⚠️  Remember to update Google Cloud Console:
   1. Go to: https://console.cloud.google.com/apis/credentials?project=short-team
   2. Edit your OAuth 2.0 Client ID
   3. Add redirect URI: https://short-app-gray.vercel.app/api/auth/callback/google
```

**Steps:**
1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=short-team)
2. Click on the OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", click **"ADD URI"**
4. Paste the redirect URI from the script output
5. Click **"SAVE"**

### 3. Update Production Environment Variables

The script provides platform-specific commands for each provider:

#### Vercel

```bash
# Remove old NEXTAUTH_URL
vercel env rm NEXTAUTH_URL production

# Add new NEXTAUTH_URL
echo "https://short-app-gray.vercel.app" | vercel env add NEXTAUTH_URL production

# Redeploy
vercel --prod
```

#### Netlify

```bash
# Set NEXTAUTH_URL
netlify env:set NEXTAUTH_URL "https://shorteam.netlify.app"

# Deploy
netlify deploy --prod
```

#### Cloudflare Pages

```bash
# Using wrangler CLI
wrangler pages secret put NEXTAUTH_URL
# Then enter: https://short-app.pages.dev

# Or update in Cloudflare Pages dashboard:
# https://dash.cloudflare.com/ > Workers & Pages > short-app > Settings > Environment Variables
```

### 4. Test OAuth Flow

After deployment:

1. Visit your production URL
2. Click **"Initialize Session"**
3. Sign in with `clipshortnews@gmail.com`
4. Verify redirect to `/dashboard`
5. Test with non-whitelisted email (should be rejected)

## Environment Variables

### Required for All Platforms

```env
NEXTAUTH_URL=<platform-url>
NEXTAUTH_SECRET=<your-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
MONGODB_URI=<your-mongodb-uri>
MONGODB_PROJECT=<your-mongodb-project>
```

### Platform-Specific URLs

- **Local**: `NEXTAUTH_URL=http://localhost:3002`
- **Vercel**: `NEXTAUTH_URL=https://short-app-gray.vercel.app`
- **Netlify**: `NEXTAUTH_URL=https://shorteam.netlify.app`
- **Cloudflare**: `NEXTAUTH_URL=https://short-app.pages.dev`

## Troubleshooting

### OAuth Callback Error

**Problem**: Getting `OAuthCallback` errors or redirect failures

**Solution**:
1. Verify `NEXTAUTH_URL` matches the platform URL exactly
2. Confirm redirect URI is added in Google Cloud Console
3. Check that production environment variables are set correctly
4. Redeploy after environment variable changes

### Platform URL Changes

If you change your Vercel project name, Netlify site name, or Cloudflare project:

1. Update the URL in `scripts/switch-platform.sh`:
   ```bash
   # Find the case statement for your platform
   vercel)
       echo "https://your-new-vercel-url.vercel.app"
       ;;
   ```

2. Re-run the script:
   ```bash
   ./scripts/switch-platform.sh vercel
   ```

3. Follow the complete deployment workflow above

### Multiple Environments

For staging vs production:

```bash
# Production
./scripts/switch-platform.sh vercel
vercel env add NEXTAUTH_URL production

# Staging
vercel env add NEXTAUTH_URL preview
```

## Security Notes

- **Never commit `.env` files** to git (already in `.gitignore`)
- **NEXTAUTH_SECRET** should be different for each environment
- Only `clipshortnews@gmail.com` is whitelisted in `lib/auth.ts`
- Google Client Secret format: `GOCSPX-xxxxxxxxxxxxxxxxxxxx`

## Custom Domains

If you add custom domains:

1. **Update the script** with your custom domain URL
2. **Add custom domain redirect URI** to Google Cloud Console
3. **Update `NEXTAUTH_URL`** to your custom domain

Example for Netlify custom domain:

```bash
# In scripts/switch-platform.sh
netlify)
    echo "https://shorteam.j0araya.com"  # Custom domain
    ;;
```

Then update Google Cloud Console with:
```
https://shorteam.j0araya.com/api/auth/callback/google
```

## Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/configuration/options#nextauth_url)
- [Google OAuth 2.0 Setup](https://support.google.com/cloud/answer/6158849)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
