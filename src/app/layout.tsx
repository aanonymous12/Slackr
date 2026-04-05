import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Slackr',
  description: 'Real-time team messaging',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
