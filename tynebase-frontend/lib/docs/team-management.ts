import { DocArticle } from './types';

export const teamManagementArticles: DocArticle[] = [
  {
    id: 'tm-1',
    slug: 'user-roles-permissions',
    title: 'User Roles & Permissions',
    description: 'Understanding different user roles and what they can do in your workspace.',
    category: 'Team Management',
    readTime: '4 min',
    lastUpdated: '2026-01-15',
    tags: ['users', 'roles', 'permissions', 'security'],
    content: `
# User Roles & Permissions

TyneBase provides a flexible role-based system to control what users can do in your workspace.

## Role Hierarchy

### Super Admin
- Full platform access
- Can manage all tenants
- Can access super admin features
- Only available to TyneBase staff

### Admin
- Full workspace access
- Can manage all users in the workspace
- Can manage billing and settings
- Can delete/archive users

### Editor
- Can create and edit documents
- Can manage categories and collections
- Cannot manage users or settings

### Member
- Can view and edit documents (if permissions allow)
- Can comment on documents
- Cannot manage workspace settings

### Viewer
- Read-only access to documents
- Can comment if enabled
- Cannot edit or create content

## Permission Matrix

| Action | Super Admin | Admin | Editor | Member | Viewer |
|--------|-------------|-------|--------|---------|--------|
| View Documents | Yes | Yes | Yes | Yes | Yes |
| Create Documents | Yes | Yes | Yes | No | No |
| Edit Documents | Yes | Yes | Yes | Yes* | No |
| Delete Documents | Yes | Yes | Yes | No | No |
| Manage Users | Yes | Yes | No | No | No |
| Manage Settings | Yes | Yes | No | No | No |
| Manage Billing | Yes | Yes | No | No | No |

*Members can only edit documents they have permission for

## Setting User Roles

1. Go to **Settings** > **Users & Teams**
2. Find the user you want to modify
3. Click the **Role** dropdown
4. Select the new role
5. Click **Save**

## Custom Permissions

For more granular control, you can set custom permissions on individual documents or collections.
`
  },
  {
    id: 'tm-2',
    slug: 'inviting-team-members',
    title: 'Inviting Team Members',
    description: 'How to invite new users to your workspace and manage their onboarding.',
    category: 'Team Management',
    readTime: '3 min',
    lastUpdated: '2026-01-12',
    tags: ['invitations', 'onboarding', 'users'],
    content: `
# Inviting Team Members

Learn how to add new users to your TyneBase workspace and get them started quickly.

## Sending Invitations

### Method 1: Email Invitation
1. Go to **Settings** > **Users & Teams**
2. Click **+ Invite Team Member**
3. Enter the email address
4. Select the user role
5. Click **Send Invite**

### Method 2: Share Invitation Link
1. Go to **Settings** > **Users & Teams**
2. Click **Generate Invite Link**
3. Copy the link and share it
4. Anyone with the link can join (with the selected role)

## Managing Invitations

### Pending Invitations
- View all pending invites in the Users & Teams section
- Resend invitations if needed
- Cancel invitations that aren't accepted

### Accepted Invitations
- Automatically appear in your user list
- Users can immediately access based on their role
- You can modify roles after they join

## Onboarding Best Practices

### Before Inviting
- Set up your workspace structure
- Create initial categories
- Prepare any templates

### After They Join
- Assign relevant documents
- Explain your workspace structure
- Set up any specific permissions

## Troubleshooting

### User Not Receiving Email
- Check spam folder
- Verify email address is correct
- Try resending the invitation

### Link Expired
- Generate a new invitation link
- Send a fresh email invitation

### Access Issues
- Verify the user has the correct role
- Check if they're using the correct email
- Ensure they're not blocked by any restrictions
`
  },
  {
    id: 'tm-3',
    slug: 'managing-user-access',
    title: 'Managing User Access',
    description: 'Control user access, suspend accounts, and handle offboarding.',
    category: 'Team Management',
    readTime: '5 min',
    lastUpdated: '2026-01-18',
    tags: ['access-control', 'suspension', 'offboarding'],
    content: `
# Managing User Access

Control who can access your workspace and how they interact with your content.

## User Status Types

### Active
- Full access based on their role
- Can log in and use all permitted features
- Normal operating status

### Suspended
- Cannot log in or access the workspace
- Account and data are preserved
- Can be reactivated at any time

### Archived
- Soft-deleted from the workspace
- Data is preserved but user cannot access
- Can be restored if needed

## Suspending Users

### When to Suspend
- Temporary leave of absence
- Security investigations
- Policy violations (temporary)

### How to Suspend
1. Go to **Settings** > **Users & Teams**
2. Find the user
3. Click the **Suspend** button
4. Confirm the action

### Unsuspending
1. Find the suspended user
2. Click **Reactivate**
3. User can log in immediately

## Archiving Users

### When to Archive
- Employee leaves the company
- Contract ends
- Long-term inactivity

### How to Archive
1. Go to **Settings** > **Users & Teams**
2. Find the user
3. Click **Archive**
4. Confirm the action

### What Happens
- User cannot log in
- All their content remains
- Documents they created stay in the workspace
- Can be restored if needed

## Offboarding Process

### Before Offboarding
1. **Document Transfer**: Reassign their documents to other users
2. **Review Access**: Remove access to sensitive information
3. **Backup Data**: Export any important information
4. **Update Permissions**: Remove from shared documents

### Offboarding Steps
1. Archive the user account
2. Reassign their documents
3. Remove from any shared collections
4. Update any external integrations

## Security Considerations

### Immediate Actions
- Suspend immediately for security concerns
- Change shared passwords
- Review recent activity

### Long-term Management
- Regular access reviews
- Monitor for suspicious activity
- Keep audit logs

## Compliance Notes

- Maintain records of user changes
- Follow data retention policies
- Document reasons for access changes
- Consider legal requirements for data preservation
`
  },
  {
    id: 'tm-4',
    slug: 'workspace-settings',
    title: 'Workspace Settings',
    description: 'Configure your workspace preferences, security, and branding.',
    category: 'Team Management',
    readTime: '4 min',
    lastUpdated: '2026-01-20',
    tags: ['settings', 'configuration', 'security'],
    content: `
# Workspace Settings

Customise your workspace to match your team's needs and brand.

## General Settings

### Workspace Information
- **Name**: Your workspace display name
- **Description**: What your workspace is used for
- **Time Zone**: Set your team's time zone
- **Language**: Default language for the interface

### Default Preferences
- **Document Visibility**: Default visibility for new documents
- **Comment Permissions**: Who can comment on documents
- **Notification Settings**: Default notification preferences

## Security Settings

### Authentication
- **Two-Factor Authentication**: Require 2FA for all users
- **Session Duration**: How long users stay logged in
- **Password Requirements**: Set password complexity rules

### Access Control
- **IP Restrictions**: Limit access to specific IP ranges
- **Domain Restrictions**: Only allow specific email domains
- **SSO Integration**: Connect to your identity provider

### Data Protection
- **Export Restrictions**: Control who can export data
- **API Access**: Manage API keys and permissions
- **Audit Logs**: Track all workspace activity

## Branding Settings

### Company Branding
- **Logo**: Upload your company logo
- **Colors**: Set primary and secondary colors
- **Font**: Choose your preferred font family

### Custom Domain
- **Domain**: Use your own domain (e.g., docs.yourcompany.com)
- **SSL Certificate**: Automatic SSL certificate provision
- **DNS Settings**: Instructions for domain configuration

### Email Customization
- **Email Headers**: Customize email headers
- **Footer Text**: Add custom footer to emails
- **Reply-to Address**: Set custom reply-to address

## Integration Settings

### Single Sign-On (SSO)
- **SAML 2.0**: Connect to enterprise identity providers
- **OAuth 2.0**: Use Google, Microsoft, or other providers
- **LDAP**: Connect to your directory service

### Webhooks
- **Document Events**: Notifications for document changes
- **User Events**: Notifications for user management
- **Custom Events**: Set up your own webhook endpoints

### API Access
- **API Keys**: Generate and manage API keys
- **Rate Limiting**: Control API usage limits
- **IP Whitelisting**: Restrict API access by IP

## Billing Settings

### Subscription Management
- **Plan Details**: View your current plan
- **Usage Metrics**: Monitor your usage
- **Payment Methods**: Manage payment options

### Usage Alerts
- **Credit Alerts**: Get notified when credits are low
- **User Limits**: Monitor user count limits
- **Storage Alerts**: Monitor storage usage

## Advanced Settings

### Data Management
- **Export Data**: Download all your workspace data
- **Import Data**: Import from other platforms
- **Backup Settings**: Configure automatic backups

### Compliance
- **GDPR Settings**: Configure privacy settings
- **Data Retention**: Set data retention policies
- **Audit Reports**: Generate compliance reports

## Best Practices

### Security
- Enable 2FA for all admin users
- Regularly review access permissions
- Monitor audit logs for suspicious activity

### Performance
- Optimize images and media files
- Regularly clean up unused content
- Monitor API usage and limits

### User Experience
- Keep branding consistent
- Use clear, descriptive names
- Provide proper training for new users
`
  },
  {
    id: 'tm-5',
    slug: 'activity-monitoring',
    title: 'Activity Monitoring',
    description: 'Track user activity, document usage, and workspace engagement.',
    category: 'Team Management',
    readTime: '3 min',
    lastUpdated: '2026-01-22',
    tags: ['analytics', 'monitoring', 'reports'],
    content: `
# Activity Monitoring

Track how your team uses TyneBase and identify opportunities for improvement.

## Dashboard Overview

### Key Metrics
- **Active Users**: Users who logged in recently
- **Document Activity**: Created, updated, and viewed documents
- **AI Usage**: Credits consumed and features used
- **Storage Usage**: Total storage consumed

### Real-time Activity
- **Current Online**: Users currently active
- **Recent Actions**: Latest document changes
- **Popular Content**: Most viewed documents
- **Search Queries**: What users are looking for

## User Analytics

### User Activity
- **Login Frequency**: How often users access the workspace
- **Session Duration**: Average time spent per visit
- **Feature Usage**: Which features are most used
- **Last Active**: When each user was last seen

### Engagement Metrics
- **Document Creation**: Who creates the most content
- **Comments & Reactions**: User interaction levels
- **Search Behavior**: What users are searching for
- **Navigation Patterns**: How users move through content

## Document Analytics

### Content Performance
- **View Counts**: Most popular documents
- **Edit Frequency**: Most actively edited documents
- **Search Rankings**: Documents found in search
- **Share Statistics**: How often documents are shared

### Content Health
- **Outdated Content**: Documents needing updates
- **Unused Content**: Documents rarely viewed
- **Duplicate Content**: Potential duplicate topics
- **Content Gaps**: Topics not covered

## AI Usage Analytics

### Credit Consumption
- **Daily Usage**: Credits used per day
- **Feature Breakdown**: Usage by AI feature
- **User Breakdown**: Who uses AI features most
- **Cost Analysis**: AI feature costs

### Feature Performance
- **Document Generation**: AI document creation success
- **Search Quality**: AI search effectiveness
- **Content Quality**: AI-generated content performance
- **User Satisfaction**: Feedback on AI features

## Reports and Exports

### Standard Reports
- **Weekly Summary**: Key metrics and trends
- **Monthly Report**: Detailed usage analysis
- **User Activity**: Individual user statistics
- **Content Report**: Document performance metrics

### Custom Reports
- **Date Range**: Select specific time periods
- **Metrics Selection**: Choose specific metrics
- **User Filters**: Filter by user or role
- **Content Filters**: Filter by category or type

### Export Options
- **CSV Format**: For spreadsheet analysis
- **PDF Reports**: For presentations
- **API Access**: For integration with other tools
- **Scheduled Reports**: Automated delivery

## Privacy and Compliance

### Data Privacy
- **User Anonymization**: Option to anonymize user data
- **Data Retention**: Control how long data is kept
- **Export Rights**: User rights to their data
- **Consent Management**: Manage user consent

### Compliance Features
- **Audit Trails**: Complete activity logs
- **Access Controls**: Who can view analytics
- **Data Protection**: Secure data handling
- **Regulatory Support**: GDPR and other regulations

## Best Practices

### Regular Monitoring
- Review weekly activity reports
- Monitor for unusual patterns
- Track feature adoption
- Identify training needs

### Data-Driven Decisions
- Use analytics to guide content strategy
- Identify power users for feedback
- Optimize workspace organization
- Plan resource allocation

### Privacy Considerations
- Be transparent about monitoring
- Follow data protection regulations
- Provide access to personal data
- Use anonymized data where possible
`
  },
  {
    id: 'tm-6',
    slug: 'collaboration-features',
    title: 'Collaboration Features',
    description: 'Real-time collaboration, comments, and team workflows in TyneBase.',
    category: 'Team Management',
    readTime: '4 min',
    lastUpdated: '2026-01-25',
    tags: ['collaboration', 'comments', 'real-time'],
    content: `
# Collaboration Features

Work together efficiently with TyneBase's real-time collaboration tools.

## Real-Time Editing

### Live Collaboration
- **Multiple Editors**: Work on documents simultaneously
- **Live Cursors**: See where others are working
- **Change Tracking**: See edits in real-time
- **Conflict Resolution**: Automatic merge of changes

### Version History
- **Auto-Save**: Changes saved automatically
- **Version Timeline**: See document evolution
- **Rollback**: Restore previous versions
- **Change Attribution**: Who made what changes

## Comments and Discussions

### Document Comments
- **Inline Comments**: Add comments to specific sections
- **Threaded Discussions**: Reply to comments
- **Mentions**: Notify specific users
- **Resolved Comments**: Mark issues as resolved

### Review Mode
- **Suggestion Mode**: Propose changes without editing
- **Approvals**: Formal review process
- **Change Requests**: Request specific modifications
- **Review History**: Track all review activity

## Team Workflows

### Document Workflows
- **Draft Review**: Draft -> Review -> Publish process
- **Approval Chains**: Multiple reviewer workflows
- **Conditional Logic**: Rules-based routing
- **Deadline Management**: Set review deadlines

### Task Management
- **Document Tasks**: Assign tasks related to documents
- **Due Dates**: Set completion deadlines
- **Priority Levels**: Mark task importance
- **Progress Tracking**: Monitor task completion

## Sharing and Permissions

### Document Sharing
- **Public Links**: Share with external users
- **Embed Codes**: Embed in other websites
- **Password Protection**: Secure shared content
- **Expiration Dates**: Time-limited access

### Granular Permissions
- **View Only**: Read-only access
- **Comment Only**: Can comment but not edit
- **Edit Access**: Full editing permissions
- **Manage Access**: Administrative control

## Notifications

### Real-Time Alerts
- **Mention Notifications**: When you're mentioned
- **Comment Replies**: Responses to your comments
- **Document Changes**: Updates to followed documents
- **Assignment Alerts**: New task assignments

### Email Digests
- **Daily Summary**: Daily activity digest
- **Weekly Reports**: Weekly activity summary
- **Custom Frequency**: Set notification preferences
- **Unsubscribe Options**: Control email delivery

## Integration Features

### Calendar Integration
- **Due Dates**: Sync with calendar apps
- **Meeting Notes**: Link to meeting schedules
- **Reminders**: Automated deadline reminders
- **Availability**: Check team member availability

### Project Management
- **Task Sync**: Sync with PM tools
- **Milestone Tracking**: Link to project milestones
- **Resource Planning**: Track document resources
- **Progress Reports**: Automated progress updates

## Mobile Collaboration

### Mobile Apps
- **iOS and Android**: Native mobile apps
- **Offline Mode**: Work without internet
- **Push Notifications**: Real-time alerts
- **Touch Optimization**: Mobile-friendly interface

### Responsive Design
- **Tablet Support**: Optimized for tablets
- **Phone Support**: Full mobile functionality
- **Progressive Web App**: Browser-based mobile access
- **Cross-Device Sync**: Seamless device switching

## Best Practices

### Effective Collaboration
- **Clear Communication**: Use comments effectively
- **Version Control**: Save important versions
- **Permission Management**: Grant appropriate access
- **Regular Reviews**: Keep content current

### Team Productivity
- **Establish Workflows**: Create consistent processes
- **Use Templates**: Standardize document formats
- **Regular Updates**: Keep team informed
- **Feedback Loops**: Continuous improvement

### Security Considerations
- **Access Reviews**: Regular permission audits
- **External Sharing**: Control external access
- **Data Protection**: Secure sensitive information
- **Compliance**: Follow organizational policies
`
  },
  {
    id: 'tm-7',
    slug: 'notifications-preferences',
    title: 'Notifications & Preferences',
    description: 'Manage notifications, user preferences, and communication settings.',
    category: 'Team Management',
    readTime: '3 min',
    lastUpdated: '2026-01-28',
    tags: ['notifications', 'preferences', 'communication'],
    content: `
# Notifications & Preferences

Customise how you receive updates and manage your workspace experience.

## Notification Types

### Document Notifications
- **Document Created**: New documents in your workspace
- **Document Updated**: Changes to documents you follow
- **Document Shared**: When documents are shared with you
- **Comment Added**: New comments on documents

### Team Notifications
- **User Invited**: New team member invitations
- **User Joined**: When someone joins the workspace
- **Role Changes**: Updates to user roles
- **Mentions**: When someone mentions you

### System Notifications
- **Storage Alerts**: When storage is running low
- **Credit Alerts**: AI credit usage warnings
- **Security Alerts**: Important security updates
- **Maintenance**: System maintenance notifications

## Notification Channels

### In-App Notifications
- **Real-time**: Instant notifications in the app
- **Notification Center**: Centralized notification hub
- **Badge Counts**: Unread notification indicators
- **Filter Options**: Sort by type or priority

### Email Notifications
- **Instant Emails**: Real-time email alerts
- **Daily Digest**: Daily summary of activity
- **Weekly Summary**: Weekly activity reports
- **Custom Schedule**: Set your preferred frequency

### Mobile Push Notifications
- **Mobile App**: Push notifications on mobile
- **Critical Only**: Only important notifications
- **Quiet Hours**: Do not disturb periods
- **Sound Settings**: Custom notification sounds

## Notification Settings

### Personal Preferences
1. Go to **Settings** > **Notifications**
2. Choose notification types
3. Set delivery preferences
4. Configure timing options

### Email Frequency
- **Real-time**: Immediate email notifications
- **Daily**: Daily digest at specified time
- **Weekly**: Weekly summary on chosen day
- **Never**: No email notifications

### Mobile Settings
- **Push Notifications**: Enable/disable mobile alerts
- **Quiet Hours**: Set do not disturb times
- **Critical Alerts**: Always allow important notifications
- **Vibration**: Configure vibration patterns

## User Preferences

### Interface Settings
- **Theme**: Light, dark, or auto mode
- **Language**: Interface language preference
- **Time Zone**: Your local time zone
- **Date Format**: How dates are displayed

### Editor Preferences
- **Font Size**: Text size in editor
- **Auto-Save**: Frequency of auto-saves
- **Spell Check**: Enable/disable spell checking
- **Keyboard Shortcuts**: Custom shortcut preferences

### Dashboard Settings
- **Default View**: What you see first
- **Widget Layout**: Arrange dashboard widgets
- **Recent Items**: Number of recent items shown
- **Quick Actions**: Customize quick action buttons

## Communication Settings

### Profile Information
- **Display Name**: How your name appears
- **Profile Picture**: Your avatar/image
- **Bio**: Brief description about yourself
- **Contact Info**: Optional contact information

### Status and Availability
- **Online Status**: Show when you're active
- **Working Hours**: Your working schedule
- **Location**: Your time zone and location
- **Away Message**: Automatic away message

### Email Signatures
- **Default Signature**: Standard email signature
- **Contextual Signatures**: Different signatures for different contexts
- **Rich Text**: Formatting options for signatures
- **Contact Information**: Include contact details

## Privacy Settings

### Visibility Options
- **Profile Visibility**: Who can see your profile
- **Activity Status**: Show your online status
- **Last Seen**: When you were last active
- **Typing Indicators**: Show when you're typing

### Data Sharing
- **Analytics**: Include your activity in analytics
- **Usage Data**: Help improve the product
- **Personalization**: Customize based on your usage
- **Third-party**: Control data sharing with partners

## Advanced Preferences

### Accessibility
- **High Contrast**: Improved visibility
- **Large Text**: Increased font sizes
- **Keyboard Navigation**: Navigate without mouse
- **Screen Reader**: Optimized for screen readers

### Performance
- **Lazy Loading**: Load content as needed
- **Image Quality**: Balance quality and speed
- **Cache Settings**: Control browser caching
- **Background Sync**: Sync data in background

## Best Practices

### Notification Management
- **Review Regularly**: Adjust settings as needed
- **Priority Filtering**: Focus on important notifications
- **Batch Processing**: Handle notifications in batches
- **Clean Up**: Regular notification cleanup

### Privacy Considerations
- **Minimal Sharing**: Share only necessary information
- **Regular Reviews**: Periodic privacy checkups
- **Secure Settings**: Use strong authentication
- **Data Control**: Understand your data rights

### Productivity Tips
- **Focus Mode**: Limit distractions during work
- **Time Blocking**: Schedule notification-free periods
- **Priority Filtering**: Focus on high-importance items
- **Automation**: Use rules to manage notifications
`
  },
  {
    id: 'tm-8',
    slug: 'api-integrations',
    title: 'API Integrations',
    description: 'Connect TyneBase with external tools and services using APIs and webhooks.',
    category: 'Team Management',
    readTime: '5 min',
    lastUpdated: '2026-01-30',
    tags: ['api', 'integrations', 'webhooks'],
    content: `
# API Integrations

Extend TyneBase functionality with custom integrations and automations.

## API Overview

### REST API
- **Base URL**: \`https://api.tynebase.com/v1\`
- **Authentication**: Bearer token or API key
- **Rate Limits**: 1000 requests per hour
- **Data Format**: JSON requests and responses

### Authentication Methods
- **API Keys**: Generate keys for integrations
- **OAuth 2.0**: Secure user authentication
- **Service Accounts**: For server-to-server communication
- **Webhook Signatures**: Verify webhook authenticity

## Core API Endpoints

### Documents
- **GET /documents**: List all documents
- **POST /documents**: Create new document
- **GET /documents/:id**: Get document details
- **PUT /documents/:id**: Update document
- **DELETE /documents/:id**: Delete document

### Users
- **GET /users**: List workspace users
- **POST /users**: Invite new user
- **GET /users/:id**: Get user details
- **PUT /users/:id**: Update user
- **DELETE /users/:id**: Remove user

### Categories
- **GET /categories**: List categories
- **POST /categories**: Create category
- **GET /categories/:id**: Get category details
- **PUT /categories/:id**: Update category
- **DELETE /categories/:id**: Delete category

## Webhooks

### Event Types
- **document.created**: New document created
- **document.updated**: Document modified
- **document.deleted**: Document removed
- **user.invited**: User invited to workspace
- **user.joined**: User joined workspace

### Webhook Configuration
1. Go to **Settings** > **Integrations**
2. Click **Add Webhook**
3. Enter endpoint URL
4. Select events to subscribe
5. Set secret key for security

### Webhook Payload
\`\`\`json
{
  "event": "document.created",
  "timestamp": "2026-01-30T10:00:00Z",
  "workspace": "workspace-123",
  "data": {
    "document": {
      "id": "doc-456",
      "title": "New Document",
      "url": "https://workspace.tynebase.com/docs/doc-456"
    },
    "user": {
      "id": "user-789",
      "email": "user@example.com"
    }
  }
}
\`\`\`

## Popular Integrations

### Slack Integration
- **Document Notifications**: Post updates to Slack channels
- **Search Integration**: Search documents from Slack
- **Quick Actions**: Create documents from Slack commands

#### Setup
1. Install Slack app
2. Connect workspace
3. Configure channels
4. Set notification preferences

### Microsoft Teams
- **Tab Integration**: Access documents within Teams
- **Meeting Notes**: Auto-generate meeting summaries
- **Notifications**: Get updates in Teams channels

#### Setup
1. Install Teams app
2. Connect workspace
3. Add tabs to channels
4. Configure notifications

### Google Workspace
- **Drive Sync**: Sync documents with Google Drive
- **Calendar Integration**: Link documents to events
- **Gmail Integration**: Access documents from Gmail

#### Setup
1. Connect Google account
2. Grant permissions
3. Configure sync settings
4. Set up integrations

### Zapier Automation
- **Triggers**: Document events, user actions
- **Actions**: Create documents, send notifications
- **Workflows**: Multi-step automations

#### Popular Zaps
- Create documents from form submissions
- Send notifications for document updates
- Sync with CRM systems
- Archive old documents

## Custom Integrations

### SDK Libraries
- **JavaScript/Node.js**: npm install tynebase-sdk
- **Python**: pip install tynebase-python
- **Ruby**: gem install tynebase-ruby
- **PHP**: composer require tynebase/php

### Example Integration
\`\`\`javascript
const TyneBase = require('tynebase-sdk');

const client = new TyneBase({
  apiKey: 'your-api-key',
  workspace: 'your-workspace'
});

// Create a document
const document = await client.documents.create({
  title: 'New Document',
  content: 'Document content here',
  category: 'documentation'
});

// Listen for webhooks
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-tynebase-signature'];
  const payload = req.body;
  
  if (verifyWebhook(signature, payload)) {
    handleWebhookEvent(payload);
  }
  
  res.sendStatus(200);
});
\`\`\`

## Security Best Practices

### API Security
- **Use HTTPS**: Always encrypt API calls
- **Rotate Keys**: Regularly update API keys
- **Limit Permissions**: Grant minimum required access
- **Monitor Usage**: Track API usage and anomalies

### Webhook Security
- **Verify Signatures**: Always validate webhook signatures
- **Use HTTPS**: Secure webhook endpoints
- **Rate Limiting**: Protect against abuse
- **Logging**: Log webhook events for debugging

## Error Handling

### Common Errors
- **401 Unauthorized**: Invalid API key or token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **429 Rate Limited**: Too many requests

### Error Response Format
\`\`\`json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": {
      "limit": 1000,
      "reset_at": "2026-01-30T11:00:00Z"
    }
  }
}
\`\`\`

## Rate Limiting

### Limits
- **Standard Plan**: 1000 requests/hour
- **Pro Plan**: 5000 requests/hour
- **Enterprise**: Unlimited requests

### Headers
- **X-RateLimit-Limit**: Request limit
- **X-RateLimit-Remaining**: Requests remaining
- **X-RateLimit-Reset**: When limit resets

## Monitoring and Analytics

### API Usage
- **Request Metrics**: Track API call volume
- **Error Rates**: Monitor error frequencies
- **Response Times**: Track performance
- **User Analytics**: Understand usage patterns

### Integration Health
- **Webhook Status**: Monitor webhook delivery
- **Error Tracking**: Identify integration issues
- **Performance Metrics**: Track response times
- **Usage Reports**: Generate usage reports

## Support Resources

### Documentation
- **API Reference**: Complete API documentation
- **Integration Guides**: Step-by-step tutorials
- **Code Examples**: Ready-to-use code samples
- **Best Practices**: Security and performance tips

### Community
- **Developer Forum**: Get help from other developers
- **GitHub Issues**: Report bugs and request features
- **Stack Overflow**: Get answers to technical questions
- **Discord Community**: Chat with other developers

## Getting Help

### Troubleshooting
- **Check Status**: Verify API service status
- **Review Logs**: Check error logs and messages
- **Test Configuration**: Validate API settings
- **Contact Support**: Get help from our team

### Development Support
- **Sandbox Environment**: Test integrations safely
- **Development Tools**: Debug and test utilities
- **Sample Applications**: Reference implementations
- **Technical Consulting**: Expert integration assistance
`
  }
];
