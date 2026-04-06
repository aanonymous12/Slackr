import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Check if session is expired (last sign-in > 24h for invite-joined users)
  if (user && !error) {
    const lastSignIn = user.last_sign_in_at
    if (lastSignIn) {
      const hoursSinceLogin = (Date.now() - new Date(lastSignIn).getTime()) / (1000 * 60 * 60)
      const sessionDuration = Number(process.env.SESSION_DURATION_HOURS || 24)
      if (hoursSinceLogin > sessionDuration && !pathname.startsWith('/auth')) {
        // Sign out and redirect to login
        await supabase.auth.signOut()
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        url.searchParams.set('reason', 'session_expired')
        return NextResponse.redirect(url)
      }
    }
  }

  if (!user && !pathname.startsWith('/auth') && !pathname.startsWith('/invite') && !pathname.startsWith('/api')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
