# Slackr — Full-Stack Team Messaging App

A Slack clone built with **Next.js 15 App Router** + **Supabase**.

## Features
- Real-time messaging with reactions, edits, deletes
- Threaded replies
- Public & private channels
- Direct messages (1:1 and group)
- Voice huddles
- File uploads (Supabase Storage)
- Email invites + shareable invite links  
- Role management (owner / admin / member / guest)
- Presence indicators
- Multi-workspace support

## Deploy in 5 Steps

### 1. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. In SQL Editor → run the full contents of `supabase/schema.sql`
3. Go to Settings → API → copy your Project URL and anon key

### 2. Deploy to Vercel
```bash
npx vercel --prod
```
Or push to GitHub and connect repo in Vercel dashboard.

### 3. Add Environment Variables in Vercel
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
```

### 4. Configure Supabase Auth
In Supabase → Authentication → URL Configuration:
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: `https://your-app.vercel.app/auth/callback`

### 5. Done! 🎉

## Local Development
```bash
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```
Also add `http://localhost:3000` and `http://localhost:3000/auth/callback` to Supabase redirect URLs.

## Stack
- **Next.js 15** (App Router + Server Components)
- **Supabase** (Postgres + Auth + Realtime + Storage)
- **TypeScript** + Tailwind CSS
- **Lucide React** icons
- **Vercel** deployment
