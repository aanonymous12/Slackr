import nodemailer from 'nodemailer'

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD env vars are required')
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

export async function sendInviteEmail({
  to,
  inviterName,
  workspaceName,
  inviteUrl,
  role,
}: {
  to: string
  inviterName: string
  workspaceName: string
  inviteUrl: string
  role: string
}) {
  const transporter = getTransporter()
  const from = `"${workspaceName} on Slackr" <${process.env.GMAIL_USER}>`

  await transporter.sendMail({
    from,
    to,
    subject: `${inviterName} invited you to join ${workspaceName} on Slackr`,
    text: `
Hi there!

${inviterName} has invited you to join the ${workspaceName} workspace on Slackr as a ${role}.

Click the link below to accept your invitation:
${inviteUrl}

This link expires in 7 days. If you weren't expecting this invite, you can safely ignore this email.

— The Slackr Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#1a1d21;padding:32px;text-align:center">
          <div style="width:52px;height:52px;border-radius:12px;background:#e8912d;display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;margin-bottom:12px">
            ${workspaceName[0]?.toUpperCase() || 'S'}
          </div>
          <h1 style="margin:0;color:#f2f3f5;font-size:22px;font-weight:700">${workspaceName}</h1>
          <p style="margin:4px 0 0;color:#72767d;font-size:14px">on Slackr</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;color:#1a1d21;font-size:16px;font-weight:600">You're invited! 🎉</p>
          <p style="margin:0 0 24px;color:#4a5568;font-size:15px;line-height:1.6">
            <strong>${inviterName}</strong> has invited you to join the 
            <strong>${workspaceName}</strong> workspace as a <strong>${role}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 24px">
              <a href="${inviteUrl}" 
                style="display:inline-block;background:#4a90d9;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px">
                Accept Invitation
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#718096;font-size:13px">Or copy this link into your browser:</p>
          <p style="margin:0 0 24px;background:#f7fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;font-size:12px;color:#4a90d9;word-break:break-all">${inviteUrl}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px">
          <p style="margin:0;color:#a0aec0;font-size:12px">
            This invite expires in 7 days. If you weren't expecting this, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
  })
}
