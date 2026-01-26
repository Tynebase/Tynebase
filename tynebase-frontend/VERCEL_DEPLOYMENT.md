# Vercel Deployment Guide for TyneBase Frontend

## Prerequisites

1. Vercel account with CLI installed: `npm i -g vercel`
2. Backend API deployed to Fly.io: `https://tynebase-backend.fly.dev`
3. Collaboration server deployed to Fly.io: `wss://tynebase-collab.fly.dev`
4. Supabase project with credentials

## Environment Variables Setup

Before deploying, set these environment variables in Vercel dashboard or via CLI:

### Required Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
SUPABASE_SECRET_KEY=sb_secret_your-key

# Backend API Configuration
NEXT_PUBLIC_API_URL=https://tynebase-backend.fly.dev
NEXT_PUBLIC_WS_URL=wss://tynebase-collab.fly.dev
NEXT_PUBLIC_APP_URL=https://tynebase.vercel.app

# Node Environment
NODE_ENV=production
```

### Setting Variables via CLI

```bash
# Set production environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SECRET_KEY production
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_WS_URL production
vercel env add NEXT_PUBLIC_APP_URL production
```

### Setting Variables via Dashboard

1. Go to your project in Vercel dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with appropriate scope (Production, Preview, Development)

## Deployment Configuration

The `vercel.json` file includes:

### Build Settings
- **Framework**: Next.js (auto-detected)
- **Build Command**: `npm run build`
- **Install Command**: `npm install`
- **Region**: London (lhr1) - closest to Fly.io backend

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### API Rewrites
- `/api/*` routes are proxied to `https://tynebase-backend.fly.dev/api/*`
- This allows frontend to call `/api/auth/login` instead of full backend URL
- Simplifies CORS configuration

## Deployment Steps

### 1. Initial Deployment

```bash
# Navigate to frontend directory
cd tynebase-frontend

# Login to Vercel (if not already)
vercel login

# Deploy to production
vercel --prod
```

### 2. Verify Deployment

After deployment completes:

1. Check build logs for errors
2. Visit the deployment URL
3. Test authentication flow:
   - Signup → Login → Dashboard
4. Verify API connectivity:
   - Open browser console
   - Check network tab for API calls
   - Ensure no CORS errors

### 3. Custom Domain (Optional)

```bash
# Add custom domain
vercel domains add yourdomain.com

# Update environment variable
vercel env add NEXT_PUBLIC_APP_URL production
# Enter: https://yourdomain.com
```

## Backend CORS Configuration

Ensure backend allows your Vercel domain:

```typescript
// backend/src/server.ts
fastify.register(cors, {
  origin: [
    'http://localhost:3000',
    'https://tynebase.vercel.app',
    'https://yourdomain.com', // if using custom domain
  ],
  credentials: true,
});
```

## Troubleshooting

### Build Fails

**Issue**: Build fails with module not found
**Solution**: 
```bash
# Clear cache and rebuild
vercel --prod --force
```

### Environment Variables Not Loading

**Issue**: `process.env.NEXT_PUBLIC_*` is undefined
**Solution**:
1. Verify variables are set in Vercel dashboard
2. Ensure variable names start with `NEXT_PUBLIC_` for client-side access
3. Redeploy after adding variables

### API Calls Fail with CORS Error

**Issue**: Browser console shows CORS error
**Solution**:
1. Verify backend CORS configuration includes Vercel domain
2. Check backend is deployed and accessible
3. Verify `NEXT_PUBLIC_API_URL` is correct

### WebSocket Connection Fails

**Issue**: Real-time collaboration doesn't work
**Solution**:
1. Verify `NEXT_PUBLIC_WS_URL` uses `wss://` protocol
2. Check collaboration server is running on Fly.io
3. Test WebSocket endpoint: `wscat -c wss://tynebase-collab.fly.dev`

### Authentication Redirects to Wrong URL

**Issue**: After login, redirects to localhost
**Solution**:
1. Update `NEXT_PUBLIC_APP_URL` to production URL
2. Update Supabase OAuth redirect URLs
3. Redeploy

## Monitoring

### Vercel Analytics

Enable analytics in Vercel dashboard:
1. Go to project settings
2. Enable Web Analytics
3. View real-time traffic and performance

### Error Tracking

Check deployment logs:
```bash
# View recent logs
vercel logs

# Follow logs in real-time
vercel logs --follow
```

## Rollback

If deployment has issues:

```bash
# List recent deployments
vercel ls

# Promote previous deployment to production
vercel promote <deployment-url>
```

## CI/CD Integration

### GitHub Integration

1. Connect repository to Vercel
2. Enable automatic deployments:
   - Production: `main` branch
   - Preview: Pull requests
3. Configure branch protection rules

### Environment-Specific Deployments

- **Production**: `main` branch → `tynebase.vercel.app`
- **Staging**: `staging` branch → `tynebase-staging.vercel.app`
- **Preview**: Pull requests → `tynebase-pr-123.vercel.app`

## Performance Optimization

### Next.js Configuration

The `next.config.ts` includes:
- React Compiler enabled for better performance
- Automatic image optimization
- Static page generation where possible

### Caching Strategy

Vercel automatically caches:
- Static assets (images, fonts, CSS)
- API responses (with appropriate headers)
- Static pages

## Security Checklist

- [x] Environment variables set securely
- [x] Security headers configured
- [x] CORS properly configured
- [x] API keys not exposed in client code
- [x] HTTPS enforced
- [x] Frame protection enabled

## Post-Deployment Testing

1. **Authentication Flow**
   - [ ] Signup creates new tenant
   - [ ] Login redirects to dashboard
   - [ ] Token persists across page refreshes
   - [ ] Logout clears session

2. **API Integration**
   - [ ] Documents CRUD operations work
   - [ ] AI generation completes successfully
   - [ ] RAG chat returns responses
   - [ ] File uploads process correctly

3. **Real-Time Features**
   - [ ] Collaboration syncs between users
   - [ ] Cursor positions update in real-time
   - [ ] Changes persist after disconnect

4. **Error Handling**
   - [ ] 404 pages display correctly
   - [ ] API errors show user-friendly messages
   - [ ] Rate limits display countdown
   - [ ] Network errors handled gracefully

## Support

For deployment issues:
1. Check Vercel deployment logs
2. Review backend API health: `https://tynebase-backend.fly.dev/health`
3. Test WebSocket connection: `wscat -c wss://tynebase-collab.fly.dev`
4. Verify environment variables in Vercel dashboard
