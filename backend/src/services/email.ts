/**
 * Email Service using Resend
 * 
 * Sends transactional emails for user actions like role changes,
 * removal notifications, etc.
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'TyneBase <support@tynebase.com>';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return false;
    }

    console.log('[Email] Sent successfully:', data?.id);
    return true;
  } catch (err) {
    console.error('[Email] Error:', err);
    return false;
  }
}

/**
 * Email template wrapper
 */
function emailTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid #e2e8f0; background-color: #111111; border-radius: 16px 16px 0 0;">
              <img src="https://tynebase.com/Tynebase_logo_white_1700.webp" alt="TyneBase" width="140" style="display: block; margin: 0 auto;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} TyneBase · <a href="https://tynebase.com" style="color: #E85002; text-decoration: none;">tynebase.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send role change notification email
 */
export async function sendRoleChangeEmail(params: {
  to: string;
  userName: string;
  tenantName: string;
  oldRole: string;
  newRole: string;
  changedBy: string;
}): Promise<boolean> {
  const { to, userName, tenantName, oldRole, newRole, changedBy } = params;
  
  const content = `
    <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 22px; font-weight: 600;">
      Your role has changed
    </h2>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      Hi ${userName || 'there'},
    </p>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      Your role in <strong style="color: #1e293b;">${tenantName}</strong> has been updated by ${changedBy}.
    </p>
    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 24px 32px; margin-bottom: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
        <tr>
          <td width="40%" style="text-align: center; vertical-align: middle; padding: 8px 0;">
            <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Previous Role</p>
            <p style="margin: 0; color: #64748b; font-size: 20px; font-weight: 600; text-transform: capitalize; line-height: 1.2;">${oldRole}</p>
          </td>
          <td width="20%" style="text-align: center; vertical-align: middle; padding: 8px 0;">
            <p style="margin: 0; color: transparent; font-size: 11px; line-height: 1;">&nbsp;</p>
            <p style="margin: 0; color: #E85002; font-size: 28px; line-height: 1;">&#8594;</p>
          </td>
          <td width="40%" style="text-align: center; vertical-align: middle; padding: 8px 0;">
            <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">New Role</p>
            <p style="margin: 0; color: #E85002; font-size: 20px; font-weight: 600; text-transform: capitalize; line-height: 1.2;">${newRole}</p>
          </td>
        </tr>
      </table>
    </div>
    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
      If you have any questions about your new permissions, please contact your workspace administrator.
    </p>
  `;

  return sendEmail({
    to,
    subject: `Your role in ${tenantName} has changed`,
    html: emailTemplate(content),
  });
}

/**
 * Send user removed notification email
 */
export async function sendUserRemovedEmail(params: {
  to: string;
  userName: string;
  tenantName: string;
  removedBy: string;
}): Promise<boolean> {
  const { to, userName, tenantName, removedBy } = params;
  
  const content = `
    <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 22px; font-weight: 600;">
      You've been removed from a workspace
    </h2>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      Hi ${userName || 'there'},
    </p>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      You have been removed from <strong style="color: #1e293b;">${tenantName}</strong> by ${removedBy}.
    </p>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      You no longer have access to the workspace's documents and resources.
    </p>
    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
      If you believe this was a mistake, please contact the workspace administrator.
    </p>
  `;

  return sendEmail({
    to,
    subject: `You've been removed from ${tenantName}`,
    html: emailTemplate(content),
  });
}

/**
 * Send welcome email when user is added to workspace
 */
export async function sendWelcomeEmail(params: {
  to: string;
  userName: string;
  tenantName: string;
  role: string;
  addedBy: string;
  loginUrl: string;
}): Promise<boolean> {
  const { to, userName, tenantName, role, addedBy, loginUrl } = params;
  
  const content = `
    <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 22px; font-weight: 600;">
      Welcome to ${tenantName}!
    </h2>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      Hi ${userName || 'there'},
    </p>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      ${addedBy} has added you to <strong style="color: #1e293b;">${tenantName}</strong> as a <strong style="color: #E85002; text-transform: capitalize;">${role}</strong>.
    </p>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      You can now access the workspace and start collaborating with your team.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background-color: #E85002; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 10px;">
        Go to Dashboard
      </a>
    </div>
  `;

  return sendEmail({
    to,
    subject: `You've been added to ${tenantName}`,
    html: emailTemplate(content),
  });
}

/**
 * Send workspace invite email
 */
export async function sendWorkspaceInviteEmail(params: {
  to: string;
  tenantName: string;
  role: string;
  invitedBy: string;
  acceptUrl: string;
}): Promise<boolean> {
  const { to, tenantName, role, invitedBy, acceptUrl } = params;
  
  const content = `
    <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 22px; font-weight: 600;">
      You're invited to join ${tenantName}
    </h2>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      ${invitedBy} invited you to join <strong style="color: #1e293b;">${tenantName}</strong> as a <strong style="color: #E85002; text-transform: capitalize;">${role}</strong>.
    </p>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      Accept this invitation to join their workspace. If you're not signed in, we'll ask you to sign in first and then finish joining automatically.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${acceptUrl}" style="display: inline-block; padding: 14px 32px; background-color: #E85002; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 10px;">
        Accept Invitation
      </a>
    </div>
    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
      This invitation was sent to ${to}. Please use the TyneBase account for this email address when accepting the invite.
    </p>
  `;

  return sendEmail({
    to,
    subject: `Join ${tenantName} on TyneBase`,
    html: emailTemplate(content),
  });
}

/**
 * Send confirmation email to user who left a workspace
 */
export async function sendUserLeftEmail(params: {
  to: string;
  userName: string;
  tenantName: string;
  restored: boolean;
  restoredTenantName?: string;
}): Promise<boolean> {
  const { to, userName, tenantName, restored, restoredTenantName } = params;

  const restoredBlock = restored && restoredTenantName
    ? `<p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">You have been restored to your original workspace <strong style="color: #1e293b;">${restoredTenantName}</strong> as an administrator.</p>`
    : '';

  const content = `
    <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 22px; font-weight: 600;">
      You've left a workspace
    </h2>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      Hi ${userName || 'there'},
    </p>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      You have successfully left <strong style="color: #1e293b;">${tenantName}</strong>. You no longer have access to that workspace's documents and resources.
    </p>
    ${restoredBlock}
    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
      If this was a mistake, contact the workspace administrator to be re-invited.
    </p>
  `;

  return sendEmail({
    to,
    subject: `You've left ${tenantName}`,
    html: emailTemplate(content),
  });
}

/**
 * Notify workspace admin that a user has left
 */
export async function sendUserLeftAdminNotification(params: {
  to: string;
  adminName: string;
  userName: string;
  userEmail: string;
  tenantName: string;
}): Promise<boolean> {
  const { to, adminName, userName, userEmail, tenantName } = params;

  const content = `
    <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 22px; font-weight: 600;">
      A team member has left your workspace
    </h2>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      Hi ${adminName || 'there'},
    </p>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      <strong style="color: #1e293b;">${userName}</strong> (${userEmail}) has left <strong style="color: #1e293b;">${tenantName}</strong>.
    </p>
    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
      They no longer have access to your workspace. You can re-invite them from the Users page if needed.
    </p>
  `;

  return sendEmail({
    to,
    subject: `${userName} has left ${tenantName}`,
    html: emailTemplate(content),
  });
}
