import { DocArticle } from './types';

export const teamManagementArticles: DocArticle[] = [
  {
    id: 'tm-1',
    slug: 'user-roles-permissions',
    title: 'User Roles & Permissions',
    description: 'Understanding different user roles and what they can do in your workspace.',
    category: 'Team Management',
    readTime: '4 min',
    tags: ['users', 'roles', 'permissions', 'security'],
    lastUpdated: '2026-04-13',
    content: `
# User Roles & Permissions

Understanding different user roles and what they can do in your workspace. TyneBase provides a flexible role-based system to control what users can do in your workspace.

## Role Hierarchy

### Admin
- Full workspace access
- Can manage all users in the workspace
- Can manage billing and settings
- Can delete/archive users

### Editor
- Can create and edit documents
- Can manage categories and collections
- Cannot manage users or settings

### Viewer
- Read-only access to documents
- Can comment if enabled
- Cannot edit or create content

### Community Contributor
- Can participate in community discussions
- Create posts
- Can reply to other posts and interact
- Does not count toward workspace seat limits

### Community Admin
- Can moderate community discussions
- Delete posts
- Manage community content
- Does not count toward workspace seat limits

## Permission Matrix

| Action | Admin | Editor | Member | Viewer |
|--------|-------|--------|---------|--------|
| View Documents | Yes | Yes | Yes | Yes |
| Create Documents | Yes | Yes | No | No |
| Edit Documents | Yes | Yes | Yes* | No |
| Delete Documents | Yes | Yes | No | No |
| Manage Users | Yes | No | No | No |
| Manage Settings | Yes | No | No | No |
| Manage Billing | Yes | No | No | No |

*Members can only edit documents they have the permission for

## Setting User Roles

1. Navigate to Admin > Users & Teams
2. Find the user you want to modify
3. Click Change role
4. Select the new role
5. Click Save Changes

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
    tags: ['invitations', 'onboarding', 'users'],
    lastUpdated: '2026-04-13',
    content: `
# Inviting Team Members

How to invite new users to your workspace and manage their onboarding. Inviting Team Members Learn how to add new users to your TyneBase workspace and get them started quickly.

## Sending Invitations

### Email Invitation
1. Navigate to Admin > Users & Teams
2. Click + Invite Member
3. Enter the new member's email address
4. Select the user role
5. Click Send Invite

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
    slug: 'inviting-your-team',
    title: 'Inviting Your Team',
    description: 'Add team members to your workspace and assign appropriate roles with bulk import and SSO options.',
    category: 'Team Management',
    readTime: '3 min',
    tags: ['invitations', 'bulk-import', 'sso', 'onboarding'],
    lastUpdated: '2026-04-13',
    content: `
# Inviting Your Team

Add team members to your workspace and assign appropriate roles. Inviting Your Team Collaborate effectively by adding your team to TyneBase.

## Invitation Methods

### Email Invitations
1. Navigate to Admin > Users & Teams
2. Click + Invite Member
3. Enter the email address of the user you want to invite
4. Select the role for the user
5. Click Send Invite

The user will receive an email with a secure signup link. Once followed, they will be able to access your platform, with access dependent on the role selected.

### Bulk Import (Enterprise Level Feature)
For larger teams you can use CSV import:

email,role,department
john@company.com,editor,Engineering
jane@company.com,admin,Product
bob@company.com,contributor,Sales

### SSO Auto-Provisioning (Enterprise)
With SCIM enabled, users are automatically provisioned when they authenticate via your identity provider.

## Role Assignment Best Practices

| Team Type | Recommended Role |
|-----------|------------------|
| Documentation team | Editor – Can create and edit workspace content |
| General employees | Viewer – Read-only access |
| IT/Operations | Admin – Can manage members and workspace settings |
| Your clients / Users | Community contributor – Can participate in community discussions |
| IT/Operations | Community Admin – Can moderate community discussions |

## Managing Users

Once users have joined, you can:
- Change roles at any time
- Transfer document ownership
- Revoke access immediately
- View activity logs per user
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

Track document activity across your knowledge base to see what's being created, edited, and published.

## Activity Feed

Access the activity feed by navigating to **Knowledge > Activity**.

### Activity Types

The activity feed tracks the following document events:

- **Created**: New documents added to the knowledge base
- **Edited**: Content changes to existing documents
- **Published**: Documents moved from draft to published state
- **Unpublished**: Documents moved from published back to draft
- **AI Generated**: Documents created using AI generation
- **AI Enhanced**: Documents improved using AI enhancement
- **Converted from Video**: Documentation generated from video content
- **Converted from PDF/DOCX**: Documentation imported from files
- **Converted from URL**: Documentation imported from web URLs

### Viewing Activity

Each activity entry shows:
- **Actor**: Who performed the action
- **Action**: What type of activity occurred
- **Target**: Which document was affected
- **Timestamp**: When the activity happened
- **Detail**: Additional context about the action

### Filtering and Search

- **Search**: Find specific activities by text
- **Filter by Type**: Show only certain activity types
- **Pagination**: Browse through activity history

## Use Cases

### Team Visibility
- See who is actively contributing to the knowledge base
- Track document creation and updates
- Monitor AI generation usage
- Identify most active team members

### Content Tracking
- Follow document lifecycle from creation to publication
- See when documents are being updated
- Track import activities from various sources
- Monitor content changes over time

### Audit Trail
- Review complete history of document activities
- Track who made changes to specific documents
- Maintain accountability for content modifications
- Support compliance requirements
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
- **Live Cursors**: See where others are working with colored cursors
- **Change Tracking**: See edits in real-time
- **Conflict Resolution**: Automatic merge of changes
- **Connection Status**: See who's connected and online

### Version History
- **Auto-Save**: Changes saved automatically
- **Version Timeline**: See document evolution
- **Rollback**: Restore previous versions
- **Change Attribution**: Who made what changes
- **Word/Character Count**: Track document statistics

## Using the Collaborative Editor

### Accessing Real-Time Editing
Real-time collaboration is available when editing documents. The collaborative editor shows:
- **Connection Indicator**: Green when connected, amber when connecting, red when disconnected
- **Active Users**: Number of users currently editing the document
- **Live Cursors**: Colored cursors showing where other users are working
- **User Names**: Display names of collaborators

### Editor Features
- **Rich Text Formatting**: Bold, italic, strikethrough, code
- **Headings**: H1, H2, H3
- **Lists**: Bullet and numbered lists
- **Blockquotes**: Quote blocks
- **Undo/Redo**: Full history support
- **AI Enhance**: AI-powered content suggestions

## Best Practices

### Effective Collaboration
- **Clear Communication**: Use the editor's real-time presence to coordinate
- **Version Control**: The system automatically saves versions
- **Coordinate Editing**: Avoid editing the same section simultaneously
- **Check Connection**: Ensure you're connected before making important changes

### Team Productivity
- **Use Templates**: Standardize document formats
- **Regular Updates**: Keep team informed through activity feed
- **Leverage AI**: Use AI Enhance for content improvements
- **Monitor Activity**: Check the Activity feed for team contributions
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
    readTime: '2 min',
    lastUpdated: '2026-01-30',
    tags: ['api', 'integrations', 'webhooks'],
    content: `
# API Integrations

Extend TyneBase functionality with custom integrations and automations.

## Coming Soon

We're working on a comprehensive API and integration platform that will include:

### Planned Features

- **REST API**: Full programmatic access to documents, users, and workspace settings
- **Webhooks**: Real-time notifications for document events, user actions, and more
- **SDK Libraries**: Official SDKs for JavaScript/Node.js, Python, and other popular languages
- **Popular Integrations**: 
  - Slack integration for notifications
  - Microsoft Teams integration
  - Google Workspace sync
  - Zapier automation

### What to Expect

- **API Keys**: Secure authentication for your integrations
- **Rate Limiting**: Fair usage limits based on your plan
- **Webhook Signatures**: Verify webhook authenticity for security
- **Comprehensive Documentation**: Complete API reference and integration guides
- **Developer Portal**: Testing tools and sandbox environment

## Stay Updated

This feature is currently in development. To be notified when it launches:

1. Watch our GitHub repository for announcements
2. Follow our blog for product updates
3. Join our Community for early access opportunities

## In the Meantime

While we build our API platform, you can:
- Use our export features to download your data
- Leverage our AI features for content generation
- Set up automated workflows within the platform
- Provide feedback on what integrations you'd like to see

## Request Features

Have a specific integration need? Let us know:
- Contact our support team
- Post in our Community
- Vote on feature requests in our roadmap

We're prioritizing integrations based on customer feedback.
`
  }
];
