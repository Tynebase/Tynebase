import { DocArticle } from './types';

export const securityArticles: DocArticle[] = [
  {
    id: 'sec-1',
    slug: 'sso-setup',
    title: 'Setting Up SSO with Okta or Azure AD',
    description: 'Configure Single Sign-On for enterprise authentication.',
    category: 'Security & Compliance',
    readTime: '8 min',
    lastUpdated: '2026-01-10',
    tags: ['sso', 'okta', 'azure', 'saml', 'enterprise'],
    content: `
# Setting Up SSO with Okta or Azure AD

Enable Single Sign-On for seamless, secure authentication.

## Prerequisites

- TyneBase Enterprise plan
- Admin access to your identity provider
- Domain verification completed

## Okta Configuration

### Step 1: Create SAML Application in Okta

1. Log into Okta Admin Console
2. Navigate to **Applications** → **Create App Integration**
3. Select **SAML 2.0**
4. Click **Next**

### Step 2: Configure SAML Settings

<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Field</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Value</div>
  <div style="background: white; padding: 12px 16px;"><strong>Single sign-on URL</strong></div>
  <div style="background: white; padding: 12px 16px;"><code>https://your-subdomain.tynebase.com/api/auth/saml/callback</code></div>
  <div style="background: white; padding: 12px 16px;"><strong>Audience URI</strong></div>
  <div style="background: white; padding: 12px 16px;"><code>https://your-subdomain.tynebase.com</code></div>
  <div style="background: white; padding: 12px 16px;"><strong>Name ID format</strong></div>
  <div style="background: white; padding: 12px 16px;">EmailAddress</div>
  <div style="background: white; padding: 12px 16px;"><strong>Application username</strong></div>
  <div style="background: white; padding: 12px 16px;">Email</div>
</div>

### Step 3: Attribute Statements

<div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Name</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Value</div>
  <div style="background: white; padding: 12px 16px;"><code>email</code></div>
  <div style="background: white; padding: 12px 16px;">user.email</div>
  <div style="background: white; padding: 12px 16px;"><code>firstName</code></div>
  <div style="background: white; padding: 12px 16px;">user.firstName</div>
  <div style="background: white; padding: 12px 16px;"><code>lastName</code></div>
  <div style="background: white; padding: 12px 16px;">user.lastName</div>
</div>

### Step 4: Download Metadata

Click **View SAML setup instructions** and download the IdP metadata XML.

### Step 5: Configure TyneBase

1. Go to **Settings** → **Security** → **SSO**
2. Select **Okta** as provider
3. Upload the metadata XML
4. Click **Save Configuration**
5. Test with **Send Test Request**

## Azure AD Configuration

### Step 1: Create Enterprise Application

1. Open Azure Portal → Azure Active Directory
2. Navigate to **Enterprise Applications** → **New Application**
3. Click **Create your own application**
4. Name it "TyneBase" and select **Non-gallery**

### Step 2: Set Up SAML

1. Go to **Single sign-on** → **SAML**
2. Edit **Basic SAML Configuration**:

<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Field</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Value</div>
  <div style="background: white; padding: 12px 16px;"><strong>Identifier (Entity ID)</strong></div>
  <div style="background: white; padding: 12px 16px;"><code>https://your-subdomain.tynebase.com</code></div>
  <div style="background: white; padding: 12px 16px;"><strong>Reply URL (ACS URL)</strong></div>
  <div style="background: white; padding: 12px 16px;"><code>https://your-subdomain.tynebase.com/api/auth/saml/callback</code></div>
  <div style="background: white; padding: 12px 16px;"><strong>Sign on URL</strong></div>
  <div style="background: white; padding: 12px 16px;"><code>https://your-subdomain.tynebase.com/login</code></div>
</div>

### Step 3: Configure Claims

Add these claims in **Attributes & Claims**:

<div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Claim</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Source</div>
  <div style="background: white; padding: 12px 16px;"><code>emailaddress</code></div>
  <div style="background: white; padding: 12px 16px;">user.mail</div>
  <div style="background: white; padding: 12px 16px;"><code>givenname</code></div>
  <div style="background: white; padding: 12px 16px;">user.givenname</div>
  <div style="background: white; padding: 12px 16px;"><code>surname</code></div>
  <div style="background: white; padding: 12px 16px;">user.surname</div>
</div>

### Step 4: Download Certificate

Download **Certificate (Base64)** from the SAML Signing Certificate section.

### Step 5: Configure TyneBase

1. Go to **Settings** → **Security** → **SSO**
2. Select **Azure AD** as provider
3. Enter:
   - Login URL
   - Azure AD Identifier
   - Upload Certificate
4. Save and test

## SCIM Provisioning

Enable automatic user provisioning:

### Okta SCIM

1. In Okta app settings, go to **Provisioning**
2. Enable SCIM connector
3. Enter TyneBase SCIM endpoint: \`https://api.tynebase.com/scim/v2\`
4. Use API key from TyneBase Settings

### Azure AD SCIM

1. In Enterprise app, go to **Provisioning**
2. Set Mode to **Automatic**
3. Enter Tenant URL: \`https://api.tynebase.com/scim/v2\`
4. Enter Secret Token from TyneBase

## Testing SSO

1. Open incognito/private browser
2. Navigate to your TyneBase URL
3. Click **Sign in with SSO**
4. Authenticate with IdP
5. Verify user is created in TyneBase

## Troubleshooting

<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Issue</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Solution</div>
  <div style="background: white; padding: 12px 16px;">Invalid signature</div>
  <div style="background: white; padding: 12px 16px;">Re-download and upload IdP certificate</div>
  <div style="background: white; padding: 12px 16px;">User not created</div>
  <div style="background: white; padding: 12px 16px;">Check attribute mapping</div>
  <div style="background: white; padding: 12px 16px;">Redirect loop</div>
  <div style="background: white; padding: 12px 16px;">Verify ACS URL is correct</div>
  <div style="background: white; padding: 12px 16px;">403 error</div>
  <div style="background: white; padding: 12px 16px;">Ensure user is assigned to app in IdP</div>
</div>
`
  },
  {
    id: 'sec-2',
    slug: 'gdpr-compliance',
    title: 'GDPR Compliance',
    description: 'How TyneBase ensures GDPR compliance for EU data protection.',
    category: 'Security & Compliance',
    readTime: '6 min',
    lastUpdated: '2026-01-10',
    tags: ['gdpr', 'privacy', 'compliance', 'eu'],
    content: `
# GDPR Compliance

TyneBase is designed for GDPR compliance from the ground up.

## Our Commitment

- All data processing within EU/UK data centers
- Privacy by design and default
- Complete data portability
- Right to erasure support
- Transparent data handling

## Data Processing

### Where Data is Stored

<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Data Type</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Location</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Provider</div>
  <div style="background: white; padding: 12px 16px;">Database</div>
  <div style="background: white; padding: 12px 16px;">EU (Frankfurt)</div>
  <div style="background: white; padding: 12px 16px;">Supabase</div>
  <div style="background: white; padding: 12px 16px;">File Storage</div>
  <div style="background: white; padding: 12px 16px;">EU (Frankfurt)</div>
  <div style="background: white; padding: 12px 16px;">Supabase</div>
  <div style="background: white; padding: 12px 16px;">AI Processing</div>
  <div style="background: white; padding: 12px 16px;">EU endpoints</div>
  <div style="background: white; padding: 12px 16px;">OpenAI EU, Vertex AI</div>
  <div style="background: white; padding: 12px 16px;">Embeddings</div>
  <div style="background: white; padding: 12px 16px;">EU (Frankfurt)</div>
  <div style="background: white; padding: 12px 16px;">Supabase pgvector</div>
</div>

### Data We Collect

<div style="display: grid; grid-template-columns: 1fr 1fr 1.5fr 1fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Category</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Data</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Purpose</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Lawful Basis</div>
  <div style="background: white; padding: 12px 16px;">Account</div>
  <div style="background: white; padding: 12px 16px;">Email, name</div>
  <div style="background: white; padding: 12px 16px;">Service provision</div>
  <div style="background: white; padding: 12px 16px;">Contract</div>
  <div style="background: white; padding: 12px 16px;">Content</div>
  <div style="background: white; padding: 12px 16px;">Documents</div>
  <div style="background: white; padding: 12px 16px;">Core functionality</div>
  <div style="background: white; padding: 12px 16px;">Contract</div>
  <div style="background: white; padding: 12px 16px;">Usage</div>
  <div style="background: white; padding: 12px 16px;">Page views, actions</div>
  <div style="background: white; padding: 12px 16px;">Analytics</div>
  <div style="background: white; padding: 12px 16px;">Legitimate interest</div>
  <div style="background: white; padding: 12px 16px;">AI</div>
  <div style="background: white; padding: 12px 16px;">Prompts, generations</div>
  <div style="background: white; padding: 12px 16px;">AI features</div>
  <div style="background: white; padding: 12px 16px;">Consent</div>
</div>

## User Rights

### Right of Access (Art. 15)

Export all your data:

1. Go to **Settings** → **Privacy**
2. Click **Export My Data**
3. Download JSON/ZIP archive

Export includes:
- Profile information
- All documents you created
- Comments and discussions
- Activity history

### Right to Erasure (Art. 17)

Delete your account and data:

1. Go to **Settings** → **Privacy**
2. Click **Delete Account**
3. 30-day grace period begins
4. Permanent deletion after 30 days

During grace period:
- Account is deactivated
- Data preserved but inaccessible
- Can cancel deletion

### Right to Portability (Art. 20)

Data export in machine-readable format:
- JSON for structured data
- Markdown for documents
- CSV for activity logs

## Consent Management

### Granular Consent

Control what data processing you allow:

<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Purpose</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Default</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Can Withdraw</div>
  <div style="background: white; padding: 12px 16px;">Essential services</div>
  <div style="background: white; padding: 12px 16px;">Required</div>
  <div style="background: white; padding: 12px 16px;">No</div>
  <div style="background: white; padding: 12px 16px;">Analytics</div>
  <div style="background: white; padding: 12px 16px;">Off</div>
  <div style="background: white; padding: 12px 16px;">Yes</div>
  <div style="background: white; padding: 12px 16px;">AI processing</div>
  <div style="background: white; padding: 12px 16px;">Off</div>
  <div style="background: white; padding: 12px 16px;">Yes</div>
  <div style="background: white; padding: 12px 16px;">Knowledge indexing</div>
  <div style="background: white; padding: 12px 16px;">Off</div>
  <div style="background: white; padding: 12px 16px;">Yes</div>
</div>

### Managing Consent

1. Go to **Settings** → **Privacy** → **Consent**
2. Toggle each purpose on/off
3. Changes take effect immediately

## Data Protection Officer

Contact our DPO for privacy inquiries:

- **Email**: dpo@tynebase.com
- **Response time**: 72 hours

## Breach Notification

In case of data breach:

1. Detection and containment
2. Assessment of risk
3. Notification within 72 hours (if required)
4. User communication
5. Post-incident review
`
  },
  {
    id: 'sec-3',
    slug: 'permissions-rbac',
    title: 'Permissions & Role-Based Access Control',
    description: 'Configure granular permissions and roles for your team.',
    category: 'Security & Compliance',
    readTime: '5 min',
    lastUpdated: '2026-01-10',
    tags: ['permissions', 'rbac', 'roles', 'access-control'],
    content: `
# Permissions & Role-Based Access Control

TyneBase uses RBAC to manage what users can do in your workspace.

## Role Hierarchy

![Role Hierarchy Diagram](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=Role+Hierarchy:+Super+Admin+%E2%86%92+Admin+%E2%86%92+Editor+%E2%86%92+Contributor+%E2%86%92+View+Only)

*Hierarchical structure showing permission inheritance from Super Admin down to View Only roles.*

## Role Capabilities

<div style="display: grid; grid-template-columns: 1.2fr 0.8fr 0.8fr 0.8fr 0.8fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Capability</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">View Only</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Contributor</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Editor</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Admin</div>
  <div style="background: white; padding: 12px 16px;">Read documents</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">Create drafts</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">Edit own docs</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">Edit any doc</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">Publish</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">Delete docs</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">Own only</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">Use AI features</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">View audit</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">Manage users</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
  <div style="background: white; padding: 12px 16px;">Workspace settings</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">❌</div>
  <div style="background: white; padding: 12px 16px;">✅</div>
</div>

## Assigning Roles

### During Invitation

When inviting users, select their role:

1. Go to **Settings** → **Users**
2. Click **+ Invite Users**
3. Enter email addresses
4. Select role from dropdown
5. Send invitations

### Changing Roles

Modify existing user roles:

1. Find user in **Settings** → **Users**
2. Click user row
3. Select new role
4. Confirm change

## Category-Level Permissions

Restrict access to specific categories:

1. Go to **Knowledge** → **Categories**
2. Click category settings ⚙️
3. Set visibility:
   - **Public**: All workspace members
   - **Restricted**: Selected roles only
   - **Private**: Selected users only

## Document-Level Permissions

Override category permissions per document:

1. Open document
2. Click **Share** button
3. Add specific users or change visibility
4. Save

## API Key Scopes

When creating API keys, limit permissions:

\`\`\`json
{
  "scopes": [
    "documents:read",
    "search:query"
  ],
  "restrictions": {
    "categories": ["cat_public"],
    "ip_whitelist": ["192.168.1.0/24"]
  }
}
\`\`\`

## Audit Trail

All permission changes are logged:

- Who changed what
- Previous and new values
- Timestamp
- IP address

View in **Settings** → **Audit Logs**.
`
  },
  {
    id: 'sec-4',
    slug: 'data-encryption',
    title: 'Data Encryption & Security',
    description: 'How TyneBase protects your data with encryption and security measures.',
    category: 'Security & Compliance',
    readTime: '5 min',
    lastUpdated: '2026-01-10',
    tags: ['encryption', 'security', 'protection'],
    content: `
# Data Encryption & Security

TyneBase implements multiple layers of security to protect your data.

## Encryption at Rest

All stored data is encrypted:

<div style="display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Data Type</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Encryption</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Key Management</div>
  <div style="background: white; padding: 12px 16px;">Database</div>
  <div style="background: white; padding: 12px 16px;">AES-256</div>
  <div style="background: white; padding: 12px 16px;">Supabase managed</div>
  <div style="background: white; padding: 12px 16px;">File storage</div>
  <div style="background: white; padding: 12px 16px;">AES-256</div>
  <div style="background: white; padding: 12px 16px;">Supabase managed</div>
  <div style="background: white; padding: 12px 16px;">Backups</div>
  <div style="background: white; padding: 12px 16px;">AES-256</div>
  <div style="background: white; padding: 12px 16px;">Isolated keys</div>
</div>

## Encryption in Transit

All data transmission uses:

- **TLS 1.3**: Latest protocol version
- **HTTPS**: All endpoints encrypted
- **HSTS**: Strict transport security
- **Certificate pinning**: Mobile apps

## Authentication Security

### Password Requirements

- Minimum 12 characters
- Must include uppercase, lowercase, number
- Breach database checking
- No common passwords

### Multi-Factor Authentication

Enable MFA for additional security:

1. Go to **Settings** → **Security**
2. Click **Enable MFA**
3. Scan QR code with authenticator app
4. Enter verification code
5. Save backup codes

Supported methods:
- Authenticator apps (TOTP)
- SMS (backup only)
- Hardware keys (WebAuthn)

## Session Security

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Setting</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Value</div>
  <div style="background: white; padding: 12px 16px;">Session timeout</div>
  <div style="background: white; padding: 12px 16px;">24 hours</div>
  <div style="background: white; padding: 12px 16px;">Idle timeout</div>
  <div style="background: white; padding: 12px 16px;">1 hour</div>
  <div style="background: white; padding: 12px 16px;">Concurrent sessions</div>
  <div style="background: white; padding: 12px 16px;">Unlimited</div>
  <div style="background: white; padding: 12px 16px;">Session revocation</div>
  <div style="background: white; padding: 12px 16px;">Immediate</div>
</div>

View and revoke sessions in **Settings** → **Security** → **Sessions**.

## Infrastructure Security

### Network Security

- DDoS protection (Cloudflare)
- WAF rules
- Rate limiting
- IP reputation filtering

### Application Security

- Input validation
- SQL injection prevention (RLS)
- XSS protection
- CSRF tokens

## Compliance Certifications

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Standard</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Status</div>
  <div style="background: white; padding: 12px 16px;">SOC 2 Type II</div>
  <div style="background: white; padding: 12px 16px;">Certified</div>
  <div style="background: white; padding: 12px 16px;">GDPR</div>
  <div style="background: white; padding: 12px 16px;">Compliant</div>
  <div style="background: white; padding: 12px 16px;">HIPAA</div>
  <div style="background: white; padding: 12px 16px;">Available (Enterprise)</div>
  <div style="background: white; padding: 12px 16px;">ISO 27001</div>
  <div style="background: white; padding: 12px 16px;">In progress</div>
</div>

## Security Reporting

Report vulnerabilities responsibly:

- **Email**: security@tynebase.com
- **PGP Key**: Available on our security page
- **Bug Bounty**: Coming soon

Response SLA:
- Critical: 24 hours
- High: 72 hours
- Medium: 7 days
`,
  },
  {
    id: 'sec-5',
    slug: 'soc2-compliance',
    title: 'SOC 2 Type II Compliance',
    description: 'Understanding TyneBase SOC 2 certification and what it means for your organization.',
    category: 'Security & Compliance',
    readTime: '5 min',
    lastUpdated: '2026-01-10',
    tags: ['soc2', 'compliance', 'audit', 'enterprise'],
    content: `
# SOC 2 Type II Compliance

TyneBase maintains SOC 2 Type II certification, demonstrating our commitment to security, availability, and confidentiality.

## What is SOC 2?

SOC 2 (Service Organization Control 2) is a framework developed by the AICPA for managing customer data based on five Trust Service Criteria:

| Principle | Description |
|-----------|-------------|
| **Security** | Protection against unauthorized access |
| **Availability** | System accessibility as agreed |
| **Processing Integrity** | Accurate and timely processing |
| **Confidentiality** | Data protection as committed |
| **Privacy** | Personal information handling |

## Type I vs Type II

| Aspect | Type I | Type II |
|--------|--------|---------|
| **Scope** | Point-in-time assessment | Extended period (6-12 months) |
| **Evidence** | Controls are designed | Controls are operating effectively |
| **Rigor** | Lower | Higher |
| **Trust Level** | Basic | Enterprise-grade |

TyneBase holds **Type II** certification, the more rigorous standard.

## Our Controls

### Access Control

- Role-based access control (RBAC)
- Multi-factor authentication
- SSO integration (SAML 2.0)
- Session management
- API key rotation

### Data Protection

- AES-256 encryption at rest
- TLS 1.3 in transit
- Key management procedures
- Data classification
- Secure deletion

### Change Management

- Code review requirements
- Automated testing
- Staged deployments
- Rollback procedures
- Change documentation

### Incident Response

- 24/7 monitoring
- Defined escalation paths
- Incident classification
- Communication procedures
- Post-incident reviews

### Business Continuity

- Automated backups
- Disaster recovery plan
- Geographic redundancy
- Recovery time objectives (RTO)
- Recovery point objectives (RPO)

## Requesting Our SOC 2 Report

Enterprise customers can request our full SOC 2 Type II report:

1. Contact your account manager
2. Sign NDA if required
3. Receive report within 2 business days

The report includes:
- Independent auditor's opinion
- Description of controls
- Test results and findings
- Management's assertion

## Continuous Compliance

We maintain compliance through:

- **Quarterly internal audits**
- **Annual external audits**
- **Continuous monitoring**
- **Employee training**
- **Vendor assessments**

## Contact

For compliance inquiries:
- **Email**: compliance@tynebase.com
- **Enterprise Portal**: Request via dashboard
`,
  },
  {
    id: 'sec-6',
    slug: 'audit-logs',
    title: 'Audit Logs & Activity Monitoring',
    description: 'Track all user actions and system events for compliance and security.',
    category: 'Security & Compliance',
    readTime: '4 min',
    lastUpdated: '2026-01-10',
    tags: ['audit', 'logs', 'monitoring', 'compliance'],
    content: `
# Audit Logs & Activity Monitoring

TyneBase provides comprehensive audit logging to help you maintain compliance and investigate security incidents.

## What We Log

### User Actions

<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Event</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Details Captured</div>
  <div style="background: white; padding: 12px 16px;"><strong>Login/Logout</strong></div>
  <div style="background: white; padding: 12px 16px;">User, timestamp, IP, device</div>
  <div style="background: white; padding: 12px 16px;"><strong>Document CRUD</strong></div>
  <div style="background: white; padding: 12px 16px;">Action, document ID, user, changes</div>
  <div style="background: white; padding: 12px 16px;"><strong>Permission changes</strong></div>
  <div style="background: white; padding: 12px 16px;">Who, what, before/after</div>
  <div style="background: white; padding: 12px 16px;"><strong>Search queries</strong></div>
  <div style="background: white; padding: 12px 16px;">Query text, results count, user</div>
  <div style="background: white; padding: 12px 16px;"><strong>AI usage</strong></div>
  <div style="background: white; padding: 12px 16px;">Prompts, model used, tokens</div>
  <div style="background: white; padding: 12px 16px;"><strong>Settings changes</strong></div>
  <div style="background: white; padding: 12px 16px;">Setting name, old/new value</div>
</div>

### System Events

<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Event</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Details</div>
  <div style="background: white; padding: 12px 16px;"><strong>API calls</strong></div>
  <div style="background: white; padding: 12px 16px;">Endpoint, method, status, latency</div>
  <div style="background: white; padding: 12px 16px;"><strong>Authentication</strong></div>
  <div style="background: white; padding: 12px 16px;">Success/failure, method used</div>
  <div style="background: white; padding: 12px 16px;"><strong>Rate limiting</strong></div>
  <div style="background: white; padding: 12px 16px;">Triggered rules, affected users</div>
  <div style="background: white; padding: 12px 16px;"><strong>Errors</strong></div>
  <div style="background: white; padding: 12px 16px;">Stack traces, context</div>
</div>

## Accessing Audit Logs

### Via Dashboard

1. Go to **Settings** → **Audit Logs**
2. Use filters:
   - Date range
   - User
   - Event type
   - Resource
3. Export as CSV or JSON

### Via API

\`\`\`bash
curl -X GET "https://api.tynebase.com/v1/audit-logs" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d "start_date=2026-01-01" \\
  -d "end_date=2026-01-31" \\
  -d "event_type=document.updated"
\`\`\`

### Response Example

\`\`\`json
{
  "logs": [
    {
      "id": "log_abc123",
      "timestamp": "2026-01-15T10:30:00Z",
      "event_type": "document.updated",
      "user_id": "user_xyz",
      "user_email": "jane@company.com",
      "resource_type": "document",
      "resource_id": "doc_456",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "metadata": {
        "fields_changed": ["title", "content"],
        "version_before": 3,
        "version_after": 4
      }
    }
  ],
  "pagination": {
    "total": 1250,
    "page": 1,
    "per_page": 50
  }
}
\`\`\`

## Retention Policies

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Plan</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Retention Period</div>
  <div style="background: white; padding: 12px 16px;">Free</div>
  <div style="background: white; padding: 12px 16px;">7 days</div>
  <div style="background: white; padding: 12px 16px;">Pro</div>
  <div style="background: white; padding: 12px 16px;">90 days</div>
  <div style="background: white; padding: 12px 16px;">Enterprise</div>
  <div style="background: white; padding: 12px 16px;">Custom (up to 7 years)</div>
</div>

## SIEM Integration

Export logs to your SIEM:

- **Splunk**: Native integration
- **Datadog**: Webhook support
- **Elastic**: API export
- **Custom**: Webhook to any endpoint

Configure in **Settings** → **Integrations** → **SIEM**.

## Alerts

Set up alerts for specific events:

1. Go to **Settings** → **Audit Logs** → **Alerts**
2. Create rule:
   - Event type trigger
   - Threshold (e.g., 5 failed logins)
   - Time window
   - Notification channel (email, Slack)

## Best Practices

- **Review regularly**: Weekly audit log reviews
- **Set alerts**: For suspicious activities
- **Export backups**: Download logs before retention expires
- **Document access**: Track who views sensitive data
`,
  },
  {
    id: 'sec-7',
    slug: 'content-audit',
    title: 'Content Audit & Document Health',
    description: 'Monitor document quality, freshness, and compliance across your knowledge base.',
    category: 'Security & Compliance',
    readTime: '5 min',
    lastUpdated: '2026-01-10',
    tags: ['content-audit', 'document-health', 'quality', 'compliance'],
    content: `
# Content Audit & Document Health

Keep your knowledge base accurate and up-to-date with TyneBase's content audit features.

## Document Health Score

Each document receives a health score based on:

<div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Factor</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Weight</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Description</div>
  <div style="background: white; padding: 12px 16px;"><strong>Freshness</strong></div>
  <div style="background: white; padding: 12px 16px;">30%</div>
  <div style="background: white; padding: 12px 16px;">Time since last update</div>
  <div style="background: white; padding: 12px 16px;"><strong>Completeness</strong></div>
  <div style="background: white; padding: 12px 16px;">25%</div>
  <div style="background: white; padding: 12px 16px;">Required sections filled</div>
  <div style="background: white; padding: 12px 16px;"><strong>Accuracy</strong></div>
  <div style="background: white; padding: 12px 16px;">20%</div>
  <div style="background: white; padding: 12px 16px;">Verified information</div>
  <div style="background: white; padding: 12px 16px;"><strong>Engagement</strong></div>
  <div style="background: white; padding: 12px 16px;">15%</div>
  <div style="background: white; padding: 12px 16px;">Views, searches, feedback</div>
  <div style="background: white; padding: 12px 16px;"><strong>Links</strong></div>
  <div style="background: white; padding: 12px 16px;">10%</div>
  <div style="background: white; padding: 12px 16px;">Working internal/external links</div>
</div>

### Score Ranges

<div style="display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Score</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Status</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Action Required</div>
  <div style="background: white; padding: 12px 16px;">80-100</div>
  <div style="background: white; padding: 12px 16px;"></div>
  <div style="background: white; padding: 12px 16px;">None</div>
  <div style="background: white; padding: 12px 16px;">60-79</div>
  <div style="background: white; padding: 12px 16px;"></div>
  <div style="background: white; padding: 12px 16px;">Review soon</div>
  <div style="background: white; padding: 12px 16px;">40-59</div>
  <div style="background: white; padding: 12px 16px;"></div>
  <div style="background: white; padding: 12px 16px;">Update required</div>
  <div style="background: white; padding: 12px 16px;">0-39</div>
  <div style="background: white; padding: 12px 16px;"></div>
  <div style="background: white; padding: 12px 16px;">Immediate action</div>
</div>

## Running Content Audits

### Automated Audits

TyneBase runs weekly automated audits:

1. Go to **Knowledge** → **Content Audit**
2. View latest report
3. Filter by:
   - Health score
   - Category
   - Owner
   - Last updated

### Manual Audit

Trigger a manual audit:

1. Click **Run Audit Now**
2. Select scope (all or specific categories)
3. Wait for completion
4. Review results

## Audit Checks

### Freshness Check

Documents are flagged based on age:

- **30 days**: Minor flag
- **90 days**: Needs review
- **180 days**: Stale content warning
- **365 days**: Critical - archive or update

### Link Checker

Automatically detects:
- Broken internal links
- Dead external URLs
- Redirect chains
- Missing images

### Compliance Check

Verifies documents meet your standards:
- Required metadata present
- Proper categorization
- Approval workflow completed
- Version history maintained

### Duplicate Detection

AI-powered detection of:
- Exact duplicates
- Near-duplicates
- Overlapping content
- Conflicting information

## Setting Up Audit Rules

Create custom audit rules:

\`\`\`json
{
  "rule_name": "Quarterly Review Required",
  "trigger": {
    "last_updated_days": 90,
    "categories": ["policies", "procedures"]
  },
  "action": {
    "assign_reviewer": "category_owner",
    "send_notification": true,
    "due_days": 14
  }
}
\`\`\`

## Content Audit Reports

### Dashboard Metrics

- Total documents
- Health score distribution
- Stale content percentage
- Documents reviewed this month

### Export Reports

Download audit reports:
- PDF summary
- CSV detailed data
- Scheduled email reports

## Best Practices

1. **Set review cycles**: Different content needs different frequencies
2. **Assign owners**: Every document should have a responsible person
3. **Archive don't delete**: Keep historical records
4. **Use templates**: Ensure consistency across documents
5. **Automate reminders**: Don't rely on memory
`,
  },
  {
    id: 'sec-8',
    slug: 'backup-recovery',
    title: 'Automated Backups & Disaster Recovery',
    description: 'How TyneBase protects your data with automated backups and recovery procedures.',
    category: 'Security & Compliance',
    readTime: '4 min',
    lastUpdated: '2026-01-10',
    tags: ['backup', 'recovery', 'disaster-recovery', 'data-protection'],
    content: `
# Automated Backups & Disaster Recovery

TyneBase ensures your data is protected with comprehensive backup and recovery capabilities.

## Backup Schedule

### Automatic Backups

<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Backup Type</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Frequency</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Retention</div>
  <div style="background: white; padding: 12px 16px;"><strong>Continuous</strong></div>
  <div style="background: white; padding: 12px 16px;">Real-time WAL</div>
  <div style="background: white; padding: 12px 16px;">7 days</div>
  <div style="background: white; padding: 12px 16px;"><strong>Daily</strong></div>
  <div style="background: white; padding: 12px 16px;">Every 24 hours</div>
  <div style="background: white; padding: 12px 16px;">30 days</div>
  <div style="background: white; padding: 12px 16px;"><strong>Weekly</strong></div>
  <div style="background: white; padding: 12px 16px;">Every Sunday</div>
  <div style="background: white; padding: 12px 16px;">90 days</div>
  <div style="background: white; padding: 12px 16px;"><strong>Monthly</strong></div>
  <div style="background: white; padding: 12px 16px;">1st of month</div>
  <div style="background: white; padding: 12px 16px;">1 year</div>
</div>

### What's Backed Up

- All documents and content
- User accounts and permissions
- Categories and structure
- Comments and discussions
- AI generation history
- Audit logs
- Settings and configurations

## Recovery Options

### Point-in-Time Recovery

Restore to any point within retention period:

1. Go to **Settings** → **Backups**
2. Select **Point-in-Time Recovery**
3. Choose date and time
4. Preview affected data
5. Confirm restoration

### Document-Level Recovery

Restore individual documents:

1. Open document
2. Click **Version History**
3. Select version to restore
4. Choose to restore or create copy

### Full Workspace Recovery

For disaster scenarios:

1. Contact support immediately
2. Verify identity (admin required)
3. Specify recovery point
4. Data restored within 4 hours

## Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single document | < 5 minutes | 0 (versioned) |
| Category restore | < 15 minutes | < 1 hour |
| Full workspace | < 4 hours | < 24 hours |
| Disaster recovery | < 24 hours | < 24 hours |

## Geographic Redundancy

Your data is replicated across multiple regions:

### Primary Region (EU-Frankfurt)
- Active database
- Real-time writes
- Primary file storage

### Secondary Region (EU-Dublin)
- Standby replica
- Async replication (< 1 second lag)
- Failover capability

### Backup Region (EU-Amsterdam)
- Cold storage backups
- Monthly archives
- Long-term retention

## Self-Service Backup Export

Download your own backups:

1. Go to **Settings** → **Data Export**
2. Select export format:
   - JSON (structured data)
   - Markdown (documents)
   - ZIP (complete archive)
3. Choose scope
4. Download link emailed within 1 hour

## Disaster Recovery Plan

### Automatic Failover

System automatically fails over when:
- Primary database unreachable > 30 seconds
- Primary region unavailable
- Corruption detected

### Manual Failover

Admins can trigger failover:

1. Go to **Settings** → **Advanced** → **Disaster Recovery**
2. Click **Initiate Failover**
3. Confirm action
4. System switches to secondary within 5 minutes

## Testing Recovery

We recommend quarterly recovery tests:

1. **Test restore**: Restore sample data to verify integrity
2. **Verify content**: Check restored documents are complete
3. **Document results**: Keep records for compliance

Enterprise customers can request assisted recovery testing.

## Contact

For recovery assistance:
- **Email**: support@tynebase.com
- **Emergency**: +44xxxxxxxx-TYNEBASE (24/7 for Enterprise)
`,
  }
];
