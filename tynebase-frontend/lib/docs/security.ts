import { DocArticle } from './types';

export const securityArticles: DocArticle[] = [
  {
    id: 'sec-1',
    slug: 'sso-setup',
    title: 'Google OAuth Authentication',
    description: 'Sign in to TyneBase using your Google account.',
    category: 'Security & Compliance',
    readTime: '3 min',
    lastUpdated: '2026-01-10',
    tags: ['sso', 'google', 'oauth', 'authentication'],
    content: `
# Google OAuth Authentication

Sign in to TyneBase quickly and securely using your Google account.

## How It Works

TyneBase uses Google OAuth 2.0 via Supabase Auth for secure authentication:

- **No Password Required**: Use your existing Google account
- **Secure**: Industry-standard OAuth 2.0 protocol
- **Quick**: One-click sign-in
- **Safe**: Your Google password is never shared with TyneBase

## Signing In with Google

### Step 1: Click "Continue with Google"

On the login page, click the **Continue with Google** button below the email/password form.

### Step 2: Authorize TyneBase

1. Google will ask you to authorize TyneBase
2. Review the permissions requested (email and profile access)
3. Click **Allow** to proceed

### Step 3: Automatic Account Creation

If this is your first time signing in:
- A TyneBase account is automatically created
- Your Google email is used as your TyneBase email
- Your Google profile picture is used as your avatar

### Step 4: Access Your Workspace

After successful authentication:
- You're redirected to your dashboard
- If you're part of multiple workspaces, you can select which one to access

## Benefits

### For Users

- **Fast Sign-In**: No need to remember another password
- **Secure**: Google's robust security infrastructure
- **Convenient**: One-click access from any device
- **Unified**: Use the same account across Google services

### For Administrators

- **Reduced Support**: Fewer password reset requests
- **Security**: Leverages Google's security measures
- **Compliance**: Meets enterprise authentication standards
- **Audit Trail**: All sign-ins are logged

## Privacy & Data

### What We Access

TyneBase only requests:
- **Email**: To identify your account
- **Profile Information**: Name and profile picture for your avatar

### What We Don't Access

- Your Google password
- Your Google contacts
- Your Google Drive or other Google services
- Any other Google data

## Troubleshooting

### Google Sign-In Not Working

**Issue**: Clicking "Continue with Google" doesn't respond

**Solutions**:
- Check your internet connection
- Ensure you're not blocking pop-ups
- Try in an incognito/private browser window
- Clear your browser cache and cookies

### Authorization Error

**Issue**: Google shows an authorization error

**Solutions**:
- Ensure you're signed into your Google account
- Check that TyneBase is authorized in your Google Account settings
- Contact your IT administrator if your organization restricts OAuth apps

### Account Already Exists

**Issue**: You already have a TyneBase account with the same email

**Solution**: Google OAuth will automatically link to your existing account. No action needed.

## Security Features

### Session Management

- Sessions are managed securely by Supabase Auth
- Tokens are stored securely in HTTP-only cookies
- Sessions expire after 1 hour of inactivity
- You can sign out from all devices in your account settings

### Multi-Factor Authentication

While Google OAuth provides strong security, you can also enable additional MFA:
- Go to **Settings** → **Security**
- Enable **Two-Factor Authentication**
- Set up an authenticator app as a backup

## Coming Soon

We're working on additional SSO options:
- Microsoft Azure AD
- Okta SAML
- Other enterprise identity providers

Have a specific SSO need? Contact our support team to request it.
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

| Data Type | Location | Provider |
|-----------|----------|----------|
| Database | EU (Frankfurt) | Supabase |
| File Storage | EU (Frankfurt) | Supabase |
| AI Processing | EU endpoints | OpenAI EU, Vertex AI |
| Embeddings | EU (Frankfurt) | Supabase pgvector |

### Data We Collect

| Category | Data | Purpose | Lawful Basis |
|----------|------|---------|--------------|
| Account | Email, name | Service provision | Contract |
| Content | Documents | Core functionality | Contract |
| Usage | Page views, actions | Analytics | Legitimate interest |
| AI | Prompts, generations | AI features | Consent |

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

| Purpose | Default | Can Withdraw |
|---------|---------|--------------|
| Essential services | Required | No |
| Analytics | Off | Yes |
| AI processing | Off | Yes |
| Knowledge indexing | Off | Yes |

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
    lastUpdated: '2026-04-13',
    tags: ['permissions', 'rbac', 'roles', 'access-control'],
    content: `
# Permissions & Role-Based Access Control

TyneBase uses RBAC to manage what users can do in your workspace.

## Role Hierarchy

Roles follow a hierarchical structure where higher roles inherit all permissions of lower roles:

**Admin** → **Editor** → **Contributor** → **View Only**

## Role Capabilities

| Capability | View Only | Contributor | Editor | Admin |
|-----------|-----------|-------------|--------|-------|
| Read documents | ✅ | ✅ | ✅ | ✅ |
| Create drafts | ❌ | ✅ | ✅ | ✅ |
| Edit own docs | ❌ | ✅ | ✅ | ✅ |
| Edit any doc | ❌ | ❌ | ✅ | ✅ |
| Publish | ❌ | ❌ | ✅ | ✅ |
| Delete docs | ❌ | ❌ | Own only | ✅ |
| Use AI features | ❌ | ✅ | ✅ | ✅ |
| View audit | ❌ | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ✅ |
| Workspace settings | ❌ | ❌ | ❌ | ✅ |

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

## Document Sharing

Share documents with specific users:

1. Open document
2. Click **Share** button
3. Add users by email
4. Set access level
5. Save

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

| Data Type | Encryption | Key Management |
|-----------|------------|----------------|
| Database | AES-256 | Supabase managed |
| File storage | AES-256 | Supabase managed |
| Backups | AES-256 | Isolated keys |

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

MFA is currently in development. Coming soon:
- Authenticator apps (TOTP)
- SMS verification
- Hardware keys (WebAuthn)

## Session Security

| Setting | Value |
|---------|-------|
| Session timeout | 24 hours |
| Idle timeout | 1 hour |
| Concurrent sessions | Unlimited |
| Session revocation | Immediate |

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

## Compliance

We're working toward formal compliance certifications:

| Standard | Status |
|----------|--------|
| **SOC 2 Type II** | In progress (see SOC 2 doc) |
| **GDPR** | Compliant (see GDPR doc) |
| **HIPAA** | Coming soon (Enterprise) |
| **ISO 27001** | Planned |

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
    readTime: '2 min',
    lastUpdated: '2026-01-10',
    tags: ['soc2', 'compliance', 'audit', 'enterprise'],
    content: `
# SOC 2 Type II Compliance

## Coming Soon

We are actively working toward SOC 2 Type II certification to demonstrate our commitment to security, availability, and confidentiality.

## What is SOC 2?

SOC 2 (Service Organization Control 2) is a framework developed by the AICPA for managing customer data based on five Trust Service Criteria:

| Principle | Description |
|-----------|-------------|
| **Security** | Protection against unauthorized access |
| **Availability** | System accessibility as agreed |
| **Processing Integrity** | Accurate and timely processing |
| **Confidentiality** | Data protection as committed |
| **Privacy** | Personal information handling |

## Our Current Security Practices

While we work toward formal certification, we implement:

### Access Control

- Role-based access control (RBAC)
- Google OAuth authentication
- Session management via Supabase Auth

### Data Protection

- AES-256 encryption at rest (via Supabase)
- TLS 1.3 in transit
- EU data residency (Frankfurt region)

### Change Management

- Code review requirements
- Staged deployments
- Rollback procedures

## Timeline

We expect to begin the SOC 2 Type II audit process in 2026. Enterprise customers requiring SOC 2 compliance should contact our sales team to discuss options.

## Contact

For compliance inquiries:
- **Email**: compliance@tynebase.com
`,
  },
  {
    id: 'sec-6',
    slug: 'audit-logs',
    title: 'Audit Logs & Activity Monitoring',
    description: 'Track all user actions and system events for compliance and security.',
    category: 'Security & Compliance',
    readTime: '3 min',
    lastUpdated: '2026-01-10',
    tags: ['audit', 'logs', 'monitoring', 'compliance'],
    content: `
# Audit Logs & Activity Monitoring

TyneBase provides comprehensive audit logging to help you maintain compliance and investigate security incidents.

## What We Log

### User Actions

| Event | Details Captured |
|-------|----------------|
| **Login/Logout** | User, timestamp, IP address |
| **Document CRUD** | Action, document ID, user, changes |
| **Permission changes** | Who, what, before/after values |
| **Settings changes** | Setting name, old/new value |
| **User invitations** | Invited user, who invited, timestamp |
| **AI usage** | Prompts, model used, tokens consumed |

### Action Types

Logs are categorized by action type:
- **auth**: Authentication events
- **document**: Document operations
- **user**: User management
- **settings**: Settings changes
- **chat**: Chat and discussion activity

## Accessing Audit Logs

### Via Dashboard

1. Go to **Settings** → **Audit Logs**
2. Use filters:
   - Action type
   - Search by action or target name
   - Pagination
3. Export logs as CSV

### Via API

\`\`\`bash
curl -X GET "https://api.tynebase.com/api/audit/logs" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d "action_type=document" \\
  -d "search=update"
\`\`\`

### Export to CSV

Download all filtered logs as CSV:
1. Go to **Settings** → **Audit Logs**
2. Apply desired filters
3. Click **Export CSV**
4. File includes: timestamp, action, actor, target, IP, and metadata

## Content Health Monitoring

Audit logs include content health statistics:

- **Total documents**: Document count in workspace
- **Published vs Draft**: Publication status breakdown
- **Stale documents**: Documents not updated recently
- **Needs review**: Documents requiring attention
- **Health distribution**: Excellent, good, needs review, poor

View in **Settings** → **Audit Logs** → **Statistics**.

## Document Reviews

Schedule and track document reviews:

- Create reviews for specific documents
- Set due dates and priority levels
- Assign reviewers
- Track review status (pending, in progress, completed)
- View review queue

## Retention

Audit logs are retained according to your plan:
- Logs are stored indefinitely for compliance
- Export CSV for your own records
- Contact support for custom retention policies

## Best Practices

- **Review regularly**: Check audit logs weekly
- **Export backups**: Download logs periodically
- **Track sensitive access**: Monitor who views confidential documents
- **Monitor failed logins**: Investigate repeated authentication failures
`,
  },
  {
    id: 'sec-7',
    slug: 'content-audit',
    title: 'Content Audit & Document Health',
    description: 'Monitor document quality, freshness, and compliance across your knowledge base.',
    category: 'Security & Compliance',
    readTime: '2 min',
    lastUpdated: '2026-01-10',
    tags: ['content-audit', 'document-health', 'quality', 'compliance'],
    content: `
# Content Audit & Document Health

## Coming Soon

We're developing comprehensive content audit features to help you maintain knowledge base quality.

## Planned Features

### Document Health Scoring

AI-powered health scores based on:
- **Freshness**: Time since last update
- **Completeness**: Required sections filled
- **Accuracy**: Verified information
- **Engagement**: Views, searches, feedback
- **Links**: Working internal/external links

### Automated Audits

- Weekly automated content audits
- Manual audit triggers
- Custom audit rules
- Scheduled reviews

### Audit Checks

- Freshness monitoring
- Link validation
- Compliance verification
- Duplicate detection

### Reports & Alerts

- Health score dashboards
- Stale content identification
- Review assignments
- Export capabilities

## Current Alternatives

While we build this feature, you can:

- Use **Version History** to track document changes
- Sort documents by **Last Updated** to identify stale content
- Use **Search** to find duplicate or overlapping content
- Assign **Document Owners** to track responsibility

## Stay Updated

This feature is in development. To be notified when it launches:
- Watch our GitHub repository
- Join our Community

## Feature Requests

Have specific audit needs? Let us know:
- Contact our support team
- Post in our Community
- Vote on feature requests in our roadmap
`,
  },
  {
    id: 'sec-8',
    slug: 'backup-recovery',
    title: 'Automated Backups & Disaster Recovery',
    description: 'How TyneBase protects your data with automated backups and recovery procedures.',
    category: 'Security & Compliance',
    readTime: '3 min',
    lastUpdated: '2026-01-10',
    tags: ['backup', 'recovery', 'disaster-recovery', 'data-protection'],
    content: `
# Automated Backups & Disaster Recovery

TyneBase ensures your data is protected with automated backups via Supabase.

## Backup Schedule

### Automatic Backups

| Backup Type | Frequency | Retention |
|-------------|----------|-----------|
| **Daily** | Every 24 hours | 30 days |
| **Weekly** | Every 7 days | 8 weeks |
| **Point-in-Time Recovery** | Continuous (WAL) | 7 days |

### What's Backed Up

- All documents and content
- User accounts and permissions
- Categories and structure
- Comments and discussions
- AI generation history
- Audit logs
- Settings and configurations

## Recovery Options

### Document-Level Recovery

Restore individual documents using Version History:

1. Open document
2. Click **⋮** menu → **Version History**
3. Select version to restore
4. Click **Restore**

### Point-in-Time Recovery

For critical data recovery:

1. Contact support immediately
2. Verify identity (admin required)
3. Specify recovery point (within 7 days)
4. Support team assists with recovery

### Full Workspace Recovery

For disaster scenarios:

1. Contact support immediately
2. Verify identity (admin required)
3. Specify recovery requirements
4. Recovery time depends on data size

## Self-Service Data Export

Download your data at any time:

1. Go to **Settings** → **Data Export**
2. Select export format:
   - JSON (structured data)
   - Markdown (documents)
   - ZIP (complete archive)
3. Choose scope
4. Download immediately

## Data Residency

Your data is stored in:
- **Primary Region**: EU (Frankfurt)
- **Provider**: Supabase (AWS infrastructure)
- **Encryption**: AES-256 at rest, TLS 1.3 in transit

## Recovery Time Objectives

| Scenario | Estimated Recovery Time |
|----------|----------------------|
| Single document | < 1 minute (Version History) |
| Point-in-Time Recovery | 4-8 hours (via support) |
| Full workspace | 24-48 hours (via support) |

## Best Practices

- **Export regularly**: Download backups periodically
- **Use Version History**: Track document changes
- **Monitor storage**: Check workspace size regularly
- **Plan ahead**: Know your recovery procedures

## Contact

For recovery assistance:
- **Email**: support@tynebase.com
- **Response Time**: Within 24 hours for Enterprise

Enterprise customers can request custom backup schedules and SLAs.
`,
  }
];
