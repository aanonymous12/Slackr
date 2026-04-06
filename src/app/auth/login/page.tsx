'use client'

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#72767d' }}>Loading…</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
