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
            <td style="padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <img src="https://tynebase.com/Tynebase_logo_black_1700.webp" alt="TyneBase" width="140" style="display: block; margin: 0 auto;" />
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
      Your Role Has Changed
    </h2>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      Hi ${userName || 'there'},
    </p>
    <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
      Your role in <strong style="color: #1e293b;">${tenantName}</strong> has been updated by ${changedBy}.
    </p>
    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
        <div style="text-align: center;">
          <p style="margin: 0 0 4px; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Previous Role</p>
          <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600; text-transform: capitalize;">${oldRole}</p>
        </div>
        <div style="color: #E85002; font-size: 20px;">→</div>
        <div style="text-align: center;">
          <p style="margin: 0 0 4px; color: #94a3b8; font-size: 12px; text-transform: uppercase;">New Role</p>
          <p style="margin: 0; color: #E85002; font-size: 16px; font-weight: 600; text-transform: capitalize;">${newRole}</p>
        </div>
      </div>
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
      You've Been Removed from a Workspace
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
      Review the invitation and accept it to join the workspace.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${acceptUrl}" style="display: inline-block; padding: 14px 32px; background-color: #E85002; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 10px;">
        Review Invitation
      </a>
    </div>
    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
      This invite was sent to ${to}. If you already have a TyneBase account, sign in first and then accept the workspace invite.
    </p>
  `;

  return sendEmail({
    to,
    subject: `Join ${tenantName} on TyneBase`,
    html: emailTemplate(content),
  });
}
