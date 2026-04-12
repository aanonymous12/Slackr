import nodemailer from 'nodemailer'

function transport() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD not set')
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
}

const T = {
  bg:'#0d0f11',card:'#161a1e',card2:'#1e2328',border:'#2a2f35',border2:'#353b42',
  purple:'#7b2d8b',purpleD:'#4a154b',blue:'#4a90d9',green:'#2eb67d',greenL:'#4ade80',
  amber:'#f0a500',yellow:'#ffd900',t1:'#f0f2f5',t2:'#c8ccd2',t3:'#8b9299',t4:'#4a5058',
}

function base(accent: string, header: string, body: string, footer: string) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;color:${T.t2}}
.outer{background:${T.bg};padding:40px 16px 60px}
.wrap{max-width:540px;margin:0 auto}
.hg{background:linear-gradient(135deg,${T.purpleD} 0%,${accent} 100%);padding:28px 32px 22px;border-radius:16px 16px 0 0;position:relative;overflow:hidden}
.hg::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.06)}
.hg::after{content:'';position:absolute;bottom:-40px;left:20px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.04)}
.logo-row{display:flex;align-items:center;gap:10px;position:relative;z-index:1}
.lm{width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.15);display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#fff;flex-shrink:0;border:1px solid rgba(255,255,255,.2)}
.lt{color:#fff;font-size:18px;font-weight:800;letter-spacing:-.4px}
.ls{color:rgba(255,255,255,.65);font-size:11px;margin-top:1px}
.ht{color:#fff;font-size:22px;font-weight:800;margin-top:18px;position:relative;z-index:1;line-height:1.25}
.hs{color:rgba(255,255,255,.75);font-size:14px;margin-top:6px;position:relative;z-index:1}
.cb{background:${T.card};border-left:1px solid ${T.border};border-right:1px solid ${T.border};padding:28px 32px}
.wsb{display:flex;align-items:center;gap:14px;background:${T.card2};border:1px solid ${T.border2};border-radius:12px;padding:14px 16px;margin:18px 0}
.wsi{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;flex-shrink:0}
.wsn{color:${T.t1};font-size:16px;font-weight:700}
.wsm{color:${T.t3};font-size:12px;margin-top:3px}
.pill{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;border:1px solid}
.cw{text-align:center;margin:26px 0 18px}
.btn{display:inline-block;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:-.1px}
.ib{background:${T.card2};border:1px solid ${T.border2};border-radius:10px;padding:14px 16px;margin:16px 0}
.il{color:${T.t3};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}
.iv{color:${T.blue};font-size:12px;word-break:break-all;line-height:1.5}
.qb{border-left:3px solid ${accent};background:${T.card2};border-radius:0 8px 8px 0;padding:12px 16px;margin:16px 0;color:${T.t2};font-size:14px;line-height:1.6}
.dv{height:1px;background:${T.border};margin:20px 0}
.ft{background:${T.card};border:1px solid ${T.border};border-top:none;border-radius:0 0 16px 16px;padding:16px 32px 20px;color:${T.t4};font-size:12px;line-height:1.6}
.ft a{color:${T.t3};text-decoration:none}
.cr{text-align:center;margin-top:20px;color:${T.t4};font-size:11px}
.cr a{color:${T.t3};text-decoration:none}
p{color:${T.t2};font-size:14px;line-height:1.7;margin-bottom:14px}
strong{color:${T.t1}}
@media(max-width:580px){.outer{padding:16px 10px 40px}.hg{padding:22px 20px 18px}.cb{padding:22px 20px}.ft{padding:14px 20px 18px}.ht{font-size:19px}.btn{padding:13px 24px;font-size:14px}}
</style></head>
<body><div class="outer"><div class="wrap">
<div class="hg">
<div class="logo-row"><div class="lm">S</div><div><div class="lt">Slackr</div><div class="ls">Team messaging &amp; collaboration</div></div></div>
${header}
</div>
<div class="cb">${body}</div>
<div class="ft">${footer}</div>
</div><div class="cr">&#169; Slackr &middot; <a href="#">Open app</a></div></div>
</body></html>`
}

// ── INVITE ─────────────────────────────────────────────────────────
export async function sendInviteEmail({ to, inviterName, workspaceName, workspaceColor, inviteUrl, role, appUrl }: { to:string;inviterName:string;workspaceName:string;workspaceColor?:string;inviteUrl:string;role:string;appUrl:string }) {
  const color = workspaceColor||T.purple; const letter = workspaceName[0]?.toUpperCase()||'W'
  const rl = role.charAt(0).toUpperCase()+role.slice(1)
  await transport().sendMail({
    from:`"${workspaceName} · Slackr" <${process.env.GMAIL_USER}>`, to,
    subject:`${inviterName} invited you to ${workspaceName} on Slackr`,
    html: base(T.blue,
      `<div class="ht">You're invited to join a workspace 🎉</div><div class="hs">${inviterName} wants you on the team</div>`,
      `<p><strong>${inviterName}</strong> invited you to join <strong>${workspaceName}</strong> as a <span class="pill" style="color:${T.blue};border-color:rgba(74,144,217,.35);background:rgba(74,144,217,.1)">${rl}</span>.</p>
      <div class="wsb"><div class="wsi" style="background:${color}">${letter}</div><div><div class="wsn">${workspaceName}</div><div class="wsm">Invited as ${rl} &middot; Expires in 7 days</div></div></div>
      <div class="cw"><a href="${inviteUrl}" class="btn" style="background:${T.blue};color:#fff">Accept invitation &rarr;</a></div>
      <div class="ib"><div class="il">Or copy this invite link</div><div class="iv">${inviteUrl}</div></div>
      <div class="dv"></div><p style="font-size:12px;color:${T.t3};margin:0">🔒 Expires in <strong>7 days</strong>. If you weren't expecting this, ignore it.</p>`,
      `Sent by <strong style="color:${T.t2}">${inviterName}</strong> &middot; ${workspaceName} &middot; <a href="${appUrl}">Open Slackr</a>`
    ),
    text:`${inviterName} invited you to ${workspaceName} as ${role}.\n\nAccept: ${inviteUrl}\n\nExpires in 7 days.`,
  })
}

// ── HUDDLE ─────────────────────────────────────────────────────────
export async function sendHuddleEmail({ to, starterName, channelName, joinUrl, workspaceName, appUrl }: { to:string[];starterName:string;channelName:string;joinUrl:string;workspaceName:string;appUrl:string }) {
  if (!to.length) return
  await transport().sendMail({
    from:`"${workspaceName} · Slackr" <${process.env.GMAIL_USER}>`, bcc:to.join(','),
    subject:`🎙️ ${starterName} started a huddle in #${channelName}`,
    html: base(T.green,
      `<div class="ht">🎙️ Huddle started in #${channelName}</div><div class="hs">${starterName} is live — join now</div>`,
      `<p><strong>${starterName}</strong> just started a live huddle in <strong>#${channelName}</strong> on <strong>${workspaceName}</strong>. Click below to join directly.</p>
      <div class="wsb" style="border-color:rgba(46,182,125,.35);background:rgba(46,182,125,.06)">
        <div style="width:12px;height:12px;border-radius:50%;background:${T.green};flex-shrink:0"></div>
        <div><div class="wsn" style="color:${T.greenL}">Live now &middot; #${channelName}</div><div class="wsm">${workspaceName} &middot; Started by ${starterName}</div></div>
      </div>
      <div class="cw"><a href="${joinUrl}" class="btn" style="background:${T.green};color:#fff;box-shadow:0 4px 20px rgba(46,182,125,.3)">🎙️ Join huddle now &rarr;</a></div>
      <div class="ib"><div class="il">Direct join link</div><div class="iv">${joinUrl}</div></div>
      <div class="dv"></div><p style="font-size:12px;color:${T.t3};margin:0">The huddle may have ended — the link will open the channel if so.</p>`,
      `Started by <strong style="color:${T.t2}">${starterName}</strong> in ${workspaceName} &middot; <a href="${appUrl}">Open Slackr</a>`
    ),
    text:`${starterName} started a huddle in #${channelName}.\n\nJoin: ${joinUrl}`,
  })
}

// ── MENTION ─────────────────────────────────────────────────────────
export async function sendMentionEmail({ to, mentionedByName, channelName, messagePreview, messageUrl, workspaceName, appUrl }: { to:string;mentionedByName:string;channelName?:string;messagePreview:string;messageUrl:string;workspaceName:string;appUrl:string }) {
  await transport().sendMail({
    from:`"${workspaceName} · Slackr" <${process.env.GMAIL_USER}>`, to,
    subject:`${mentionedByName} mentioned you${channelName?` in #${channelName}`:''}`,
    html: base(T.yellow,
      `<div class="ht">@ You were mentioned</div><div class="hs">${mentionedByName} tagged you${channelName?` in #${channelName}`:''}</div>`,
      `<p><strong>${mentionedByName}</strong> mentioned you${channelName?` in <strong>#${channelName}</strong>`:''} on <strong>${workspaceName}</strong>:</p>
      <div class="qb">${messagePreview.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div>
      <div class="cw"><a href="${messageUrl}" class="btn" style="background:${T.yellow};color:#111">View message &rarr;</a></div>`,
      `${workspaceName} on Slackr &middot; <a href="${appUrl}">Open app</a>`
    ),
    text:`${mentionedByName} mentioned you:\n\n${messagePreview}\n\nView: ${messageUrl}`,
  })
}

// ── ANNOUNCEMENT ─────────────────────────────────────────────────────
export async function sendAnnouncementEmail({ to, senderName, message, channelUrl, workspaceName, appUrl }: { to:string[];senderName:string;message:string;channelUrl:string;workspaceName:string;appUrl:string }) {
  if (!to.length) return
  await transport().sendMail({
    from:`"${workspaceName} · Slackr" <${process.env.GMAIL_USER}>`, bcc:to.join(','),
    subject:`📢 New announcement in ${workspaceName}`,
    html: base(T.amber,
      `<div class="ht">📢 New announcement</div><div class="hs">${senderName} posted in ${workspaceName}</div>`,
      `<p><strong>${senderName}</strong> posted a new announcement in <strong>${workspaceName}</strong>:</p>
      <div class="qb">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div>
      <div class="cw"><a href="${channelUrl}" class="btn" style="background:${T.amber};color:#111">View announcement &rarr;</a></div>`,
      `You received this because you're a member of <strong style="color:${T.t2}">${workspaceName}</strong> &middot; <a href="${appUrl}">Open Slackr</a>`
    ),
    text:`${senderName} posted:\n\n${message}\n\nView: ${channelUrl}`,
  })
}

// ── TASK ─────────────────────────────────────────────────────────
export async function sendTaskEmail({ to, creatorName, taskTitle, taskAssignee, workspaceName, boardUrl, appUrl }: { to:string[];creatorName:string;taskTitle:string;taskAssignee?:string;workspaceName:string;boardUrl:string;appUrl:string }) {
  if (!to.length) return
  await transport().sendMail({
    from:`"${workspaceName} · Slackr" <${process.env.GMAIL_USER}>`, bcc:to.join(','),
    subject:`✅ New task: ${taskTitle}`,
    html: base(T.green,
      `<div class="ht">✅ New task added</div><div class="hs">${creatorName} created a task in ${workspaceName}</div>`,
      `<p><strong>${creatorName}</strong> added a new task to <strong>${workspaceName}</strong>:</p>
      <div class="wsb"><div class="wsi" style="background:${T.green};font-size:18px">✅</div><div><div class="wsn">${taskTitle.replace(/</g,'&lt;')}</div><div class="wsm">${taskAssignee?`Assigned to: ${taskAssignee}`:'Unassigned'}</div></div></div>
      <div class="cw"><a href="${boardUrl}" class="btn" style="background:${T.green};color:#fff">View task board &rarr;</a></div>`,
      `Admin notification for <strong style="color:${T.t2}">${workspaceName}</strong> &middot; <a href="${appUrl}">Open Slackr</a>`
    ),
    text:`${creatorName} added a task:\n\n${taskTitle}${taskAssignee?`\nAssigned to: ${taskAssignee}`:''}\n\nView: ${boardUrl}`,
  })
}

// ── PASSWORD RESET ─────────────────────────────────────────────────
export async function sendPasswordResetEmail({ to, resetUrl, appUrl }: { to:string;resetUrl:string;appUrl:string }) {
  await transport().sendMail({
    from:`"Slackr Security" <${process.env.GMAIL_USER}>`, to,
    subject:'Reset your Slackr password',
    html: base(T.blue,
      `<div class="ht">🔑 Reset your password</div><div class="hs">We received a password reset request</div>`,
      `<p>Someone requested a password reset for the Slackr account associated with this email address. Click below to set a new password.</p>
      <div class="cw"><a href="${resetUrl}" class="btn" style="background:${T.blue};color:#fff">Reset password &rarr;</a></div>
      <div class="ib"><div class="il">Or paste this link in your browser</div><div class="iv">${resetUrl}</div></div>
      <div class="dv"></div>
      <div class="ib" style="border-color:rgba(240,165,0,.3);background:rgba(240,165,0,.06)"><p style="margin:0;font-size:13px;color:${T.amber}">&#9201; This link expires in <strong>1 hour</strong>. If you didn't request this, safely ignore this email.</p></div>`,
      `Slackr security &middot; Never share this link &middot; <a href="${appUrl}">Open Slackr</a>`
    ),
    text:`Reset your password:\n\n${resetUrl}\n\nExpires in 1 hour.`,
  })
}
