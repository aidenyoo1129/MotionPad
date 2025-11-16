# Deployment Guide

## Option 1: Vercel (Recommended - Easiest for Next.js)

### Steps:
1. **Sign up/Login to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with your GitHub account

2. **Import Your Project**
   - Click "Add New Project"
   - Import your `Hands-Free` repository from GitHub
   - Vercel will auto-detect Next.js settings

3. **Configure Environment Variables**
   - In the project settings, go to "Environment Variables"
   - Add: `ANTHROPIC_API_KEY` = `your_anthropic_api_key_here`
   - Make sure to add it for Production, Preview, and Development

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy your app
   - Your app will be live at `https://your-project-name.vercel.app`

### Important Notes:
- ✅ Vercel provides HTTPS by default (required for camera/MediaPipe)
- ✅ Automatic deployments on every push to main branch
- ✅ Preview deployments for pull requests
- ✅ Free tier available

---

## Option 2: Netlify

### Steps:
1. **Sign up/Login to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Sign up with your GitHub account

2. **Create `netlify.toml`** (create this file in your project root):
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

3. **Import Your Project**
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Build command: `npm run build`
   - Publish directory: `.next`

4. **Configure Environment Variables**
   - Go to Site settings → Environment variables
   - Add: `ANTHROPIC_API_KEY` = `your_anthropic_api_key_here`

5. **Deploy**
   - Netlify will automatically deploy
   - Your app will be live at `https://your-project-name.netlify.app`

---

## Option 3: Railway

### Steps:
1. **Sign up/Login to Railway**
   - Go to [railway.app](https://railway.app)
   - Sign up with your GitHub account

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `Hands-Free` repository

3. **Configure Build Settings**
   - Railway auto-detects Next.js
   - Build command: `npm run build`
   - Start command: `npm start`

4. **Add Environment Variables**
   - Go to Variables tab
   - Add: `ANTHROPIC_API_KEY` = `your_anthropic_api_key_here`

5. **Deploy**
   - Railway will automatically deploy
   - Your app will be live at `https://your-project-name.up.railway.app`

---

## Option 4: Self-Hosted (VPS/Docker)

### Using Docker:

1. **Create `Dockerfile`**:
   ```dockerfile
   FROM node:20-alpine AS base
   
   # Install dependencies only when needed
   FROM base AS deps
   RUN apk add --no-cache libc6-compat
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci
   
   # Rebuild the source code only when needed
   FROM base AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build
   
   # Production image
   FROM base AS runner
   WORKDIR /app
   ENV NODE_ENV production
   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nextjs
   
   COPY --from=builder /app/public ./public
   COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
   COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
   
   USER nextjs
   EXPOSE 3000
   ENV PORT 3000
   CMD ["node", "server.js"]
   ```

2. **Update `next.config.js`** to enable standalone output:
   ```js
   const nextConfig = {
     output: 'standalone',
     // ... rest of your config
   }
   ```

3. **Build and run**:
   ```bash
   docker build -t hands-free .
   docker run -p 3000:3000 -e ANTHROPIC_API_KEY=your_key hands-free
   ```

---

## Environment Variables Required

Make sure to set these in your deployment platform:

- `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude AI

---

## Important Notes for Production

1. **HTTPS is Required**: 
   - MediaPipe camera access requires HTTPS
   - All recommended platforms provide HTTPS by default

2. **Camera Permissions**:
   - Users will need to grant camera permissions in their browser
   - Some browsers may block camera access on non-HTTPS sites

3. **API Routes**:
   - Your API routes (`/api/generate-roadmap`, `/api/parse-pdf`) will work automatically
   - Make sure `ANTHROPIC_API_KEY` is set in production

4. **Build Optimization**:
   - Next.js will automatically optimize your build
   - MediaPipe will only load on the client side (configured in `next.config.js`)

---

## Quick Deploy Commands

### Test build locally first:
```bash
npm run build
npm start
```

### If build succeeds, you're ready to deploy!

