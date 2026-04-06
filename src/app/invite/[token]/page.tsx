export const dynamic = 'force-dynamic'

import AcceptInviteClient from './AcceptInviteClient'

// Just render the client component - it handles everything via API
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <AcceptInviteClient token={token} />
}
