import { DocArticle } from './types';

export const quickStartArticles: DocArticle[] = [
  {
    id: 'qs-1',
    slug: 'creating-first-document',
    title: 'Creating Your First Document',
    description: 'Learn how to create, edit, and publish your first knowledge base article in TyneBase.',
    category: 'Quick start',
    readTime: '3 min',
    lastUpdated: '2026-01-10',
    tags: ['getting-started', 'documents', 'basics'],
    content: `
# Creating Your First Document

Welcome to TyneBase! This guide will walk you through creating your first knowledge base document.

## Step 1: Access the Dashboard

After signing in, you'll land on your workspace dashboard. Click the **+ Create** button in the sidebar to start a new document.

## Step 2: Choose a Creation Method

TyneBase offers multiple ways to create documents:

- **Blank Document**: Start from scratch with our rich text editor
- **From Template**: Use a pre-built template from our community library
- **AI from Prompt**: Describe what you need and let AI generate it
- **AI from Video**: Upload a YouTube link or video file

For this guide, select **Blank Document**.

## Step 3: Write Your Content

Our editor supports:

- **Rich Text Formatting**: Bold, italic, headings, lists
- **Code Blocks**: Syntax highlighting for 50+ languages
- **Tables**: Create structured data tables
- **Images & Files**: Drag and drop media
- **Embeds**: YouTube, Loom, Figma, and more

## Step 4: Set Metadata

Before publishing, configure your document:

<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Field</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Description</div>
  <div style="background: white; padding: 12px 16px;"><strong>Title</strong></div>
  <div style="background: white; padding: 12px 16px;">Clear, searchable document title</div>
  <div style="background: white; padding: 12px 16px;"><strong>Category</strong></div>
  <div style="background: white; padding: 12px 16px;">Organise into your knowledge structure</div>
  <div style="background: white; padding: 12px 16px;"><strong>Tags</strong></div>
  <div style="background: white; padding: 12px 16px;">Add keywords for better discoverability</div>
  <div style="background: white; padding: 12px 16px;"><strong>Visibility</strong></div>
  <div style="background: white; padding: 12px 16px;">Public, Internal, or Restricted</div>
</div>

## Step 5: Publish

Click **Publish** to make your document live. It will immediately:

- Appear in your knowledge base
- Become searchable via AI-powered search
- Be indexed for RAG context retrieval
- Generate document lineage tracking

## What's Next?

- [Generate documentation with AI](/docs/ai-features/ai-from-prompt)
- [Set up document verification cycles](/docs/core-concepts/verification)
- [Invite your team members](/docs/team-management/inviting-members)
`
  },
  {
    id: 'qs-2',
    slug: 'workspace-setup',
    title: 'Setting Up Your Workspace',
    description: 'Configure your TyneBase workspace with branding, categories, and team settings.',
    category: 'Quick start',
    readTime: '5 min',
    lastUpdated: '2026-01-10',
    tags: ['workspace', 'setup', 'configuration'],
    content: `
# Setting Up Your Workspace

Your TyneBase workspace is your team's central knowledge hub. This guide covers essential configuration.

## Workspace Structure

![Workspace Structure](https://via.placeholder.com/700x300/1a1a1a/ffffff?text=Workspace+Structure:+Knowledge+Base+%7C+AI+Assistant+%7C+Community+%7C+Templates)

*Your workspace includes Knowledge Base, AI Assistant, Community Forum, and Templates Library.*

## Step 1: Configure Branding

Navigate to **Settings → Branding** to customize:

- **Logo**: Upload your company logo (SVG or PNG recommended)
- **Favicon**: Custom browser tab icon
- **Primary Color**: Your brand's main color
- **Secondary Color**: Accent color for highlights

Changes apply immediately with live preview.

## Step 2: Create Categories

Categories organise your knowledge base. Go to **Knowledge → Categories**:

1. Click **+ New Category**
2. Enter a name (e.g., "Engineering Docs")
3. Choose a parent category (optional, for nesting)
4. Set the sort order

**Pro Tip**: Create a logical hierarchy that mirrors your organization structure.

## Step 3: Set Up Permissions

TyneBase uses role-based access control (RBAC):

<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Role</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Capabilities</div>
  <div style="background: white; padding: 12px 16px;"><strong>Admin</strong></div>
  <div style="background: white; padding: 12px 16px;">Full access, user management, branding</div>
  <div style="background: white; padding: 12px 16px;"><strong>Editor</strong></div>
  <div style="background: white; padding: 12px 16px;">Create, edit, publish documents</div>
  <div style="background: white; padding: 12px 16px;"><strong>Contributor</strong></div>
  <div style="background: white; padding: 12px 16px;">Create drafts, suggest edits</div>
  <div style="background: white; padding: 12px 16px;"><strong>View Only</strong></div>
  <div style="background: white; padding: 12px 16px;">Read-only access</div>
</div>

## Step 4: Configure AI Settings

In **Settings → AI Configuration**:

- Select your preferred AI provider (OpenAI, Google, or Anthropic)
- Set monthly AI generation limits
- Configure RAG indexing preferences
- Enable/disable AI features per role

## Next Steps

- [Invite team members](/docs/team-management/inviting-members)
- [Create your first template](/docs/core-concepts/templates)
- [Set up SSO authentication](/docs/security/sso-setup)
`
  },
  {
    id: 'qs-3',
    slug: 'inviting-team',
    title: 'Inviting Your Team',
    description: 'Add team members to your workspace and assign appropriate roles.',
    category: 'Quick start',
    readTime: '3 min',
    lastUpdated: '2026-01-10',
    tags: ['team', 'users', 'invitations'],
    content: `
# Inviting Your Team

Collaborate effectively by adding your team to TyneBase.

## Invitation Methods

### Email Invitations

1. Go to **Settings → Users**
2. Click **+ Invite Users**
3. Enter email addresses (one per line or comma-separated)
4. Select the role for all invitees
5. Click **Send Invitations**

Invitees receive an email with a secure signup link.

### Bulk Import (Enterprise)

For larger teams, use CSV import:

\`\`\`csv
email,role,department
john@company.com,editor,Engineering
jane@company.com,admin,Product
bob@company.com,contributor,Sales
\`\`\`

### SSO Auto-Provisioning (Enterprise)

With SCIM enabled, users are automatically provisioned when they authenticate via your identity provider.

## Role Assignment Best Practices

<div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Team Type</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Recommended Role</div>
  <div style="background: white; padding: 12px 16px;">Documentation team</div>
  <div style="background: white; padding: 12px 16px;">Editor</div>
  <div style="background: white; padding: 12px 16px;">Subject matter experts</div>
  <div style="background: white; padding: 12px 16px;">Contributor</div>
  <div style="background: white; padding: 12px 16px;">General employees</div>
  <div style="background: white; padding: 12px 16px;">View Only</div>
  <div style="background: white; padding: 12px 16px;">IT/Operations</div>
  <div style="background: white; padding: 12px 16px;">Admin</div>
</div>

## Pending Invitations

Track invitation status in **Settings → Users → Pending**:

- **Pending**: Invitation sent, not yet accepted
- **Expired**: 7-day expiration, can resend
- **Accepted**: User has joined

## Managing Users

After joining, you can:

- Change roles at any time
- Transfer document ownership
- Revoke access immediately
- View activity logs per user
`
  },
  {
    id: 'qs-4',
    slug: 'first-ai-generation',
    title: 'Your First AI Generation',
    description: 'Use AI to automatically generate documentation from a simple prompt.',
    category: 'Quick start',
    readTime: '4 min',
    lastUpdated: '2026-01-10',
    tags: ['ai', 'generation', 'getting-started'],
    content: `
# Your First AI Generation

TyneBase's AI can generate comprehensive documentation from simple descriptions.

## Accessing AI Assistant

Click **AI Assistant** in the sidebar to access three generation modes:

1. **From Prompt**: Describe what you need in natural language
2. **From Video**: Upload a YouTube link or video file
3. **Enhance**: Improve existing documents

## Generating from a Prompt

### Step 1: Describe Your Document

Enter a clear, detailed prompt:

\`\`\`
Create a comprehensive onboarding guide for new software engineers.
Include sections on:
- Setting up development environment
- Code review process
- Deployment procedures
- Team communication channels
\`\`\`

### Step 2: Configure Options

<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Option</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Description</div>
  <div style="background: white; padding: 12px 16px;"><strong>Tone</strong></div>
  <div style="background: white; padding: 12px 16px;">Professional, Casual, Technical</div>
  <div style="background: white; padding: 12px 16px;"><strong>Length</strong></div>
  <div style="background: white; padding: 12px 16px;">Brief, Standard, Comprehensive</div>
  <div style="background: white; padding: 12px 16px;"><strong>Format</strong></div>
  <div style="background: white; padding: 12px 16px;">Article, Guide, Runbook, FAQ</div>
  <div style="background: white; padding: 12px 16px;"><strong>Include</strong></div>
  <div style="background: white; padding: 12px 16px;">Code examples, diagrams, checklists</div>
</div>

### Step 3: Generate & Review

Click **Generate** and wait 15-30 seconds. The AI will:

1. Analyse your prompt
2. Retrieve relevant context from your existing docs (RAG)
3. Generate structured content
4. Format with proper headings, lists, and code blocks

### Step 4: Edit & Publish

AI-generated content is created as a **Draft**. Review and edit before publishing:

- Verify accuracy of technical details
- Add company-specific information
- Adjust tone and formatting
- Include relevant links

## Tips for Better Results

- **Be Specific**: More detail = better output
- **Provide Context**: Reference existing docs or standards
- **Use Examples**: "Similar to our API documentation..."
- **Iterate**: Generate multiple versions and combine the best parts

## Document Lineage

All AI-generated documents automatically track:

- Source prompt
- AI model used
- Generation timestamp
- Token usage and cost
- Edit history post-generation
`
  },
  {
    id: 'qs-5',
    slug: 'understanding-dashboard',
    title: 'Understanding Your Dashboard',
    description: 'Navigate the TyneBase dashboard and understand key metrics.',
    category: 'Quick start',
    readTime: '4 min',
    lastUpdated: '2026-01-10',
    tags: ['dashboard', 'navigation', 'overview'],
    content: `
# Understanding Your Dashboard

The TyneBase dashboard gives you a complete overview of your knowledge base health.

## Dashboard Layout

![Dashboard Layout](https://via.placeholder.com/900x500/1a1a1a/ffffff?text=Dashboard:+Sidebar+Navigation+%7C+Quick+Stats+%7C+Recent+Activity+%7C+Content+Health)

*The dashboard features a sidebar with navigation, main content area with quick stats, recent activity feed, and content health metrics.*

## Key Metrics

### Content Overview

<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Metric</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Description</div>
  <div style="background: white; padding: 12px 16px;"><strong>Total Documents</strong></div>
  <div style="background: white; padding: 12px 16px;">Published articles in your knowledge base</div>
  <div style="background: white; padding: 12px 16px;"><strong>Total Views</strong></div>
  <div style="background: white; padding: 12px 16px;">Cumulative document views this month</div>
  <div style="background: white; padding: 12px 16px;"><strong>AI Generations</strong></div>
  <div style="background: white; padding: 12px 16px;">Documents created by AI this month</div>
  <div style="background: white; padding: 12px 16px;"><strong>Active Users</strong></div>
  <div style="background: white; padding: 12px 16px;">Team members active in last 7 days</div>
</div>

### Content Health

The audit dashboard shows:

- **Stale Content**: Documents not updated in 90+ days
- **Low Engagement**: Articles with minimal views
- **Pending Reviews**: Documents awaiting verification
- **Orphaned Pages**: Unlinked or uncategorized docs

## Sidebar Navigation

<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Section</div>
  <div style="background: #f9fafb; padding: 12px 16px; font-weight: 600;">Purpose</div>
  <div style="background: white; padding: 12px 16px;"><strong>Knowledge</strong></div>
  <div style="background: white; padding: 12px 16px;">Browse all documents and categories</div>
  <div style="background: white; padding: 12px 16px;"><strong>AI Assistant</strong></div>
  <div style="background: white; padding: 12px 16px;">Generate new content with AI</div>
  <div style="background: white; padding: 12px 16px;"><strong>Content Audit</strong></div>
  <div style="background: white; padding: 12px 16px;">Monitor documentation health</div>
  <div style="background: white; padding: 12px 16px;"><strong>Community</strong></div>
  <div style="background: white; padding: 12px 16px;">Team discussions and Q&A</div>
  <div style="background: white; padding: 12px 16px;"><strong>Templates</strong></div>
  <div style="background: white; padding: 12px 16px;">Reusable document templates</div>
  <div style="background: white; padding: 12px 16px;"><strong>Settings</strong></div>
  <div style="background: white; padding: 12px 16px;">Workspace configuration</div>
</div>

## Global Search

Press \`⌘ + K\` (Mac) or \`Ctrl + K\` (Windows) to open global search:

- Search documents by title and content
- Find users and settings
- Access recent items
- Use AI to answer questions from your docs
`
  },
  {
    id: 'qs-tutorial',
    slug: 'getting-started-tutorial',
    title: 'Getting Started Tutorial',
    description: 'A step-by-step walkthrough for new users covering everything you need to know to get productive with TyneBase.',
    category: 'Quick start',
    readTime: '5 min',
    lastUpdated: '2026-03-25',
    tags: ['tutorial', 'onboarding', 'getting-started', 'first-time'],
    content: `
# Welcome to TyneBase!

Congratulations on setting up your workspace. This tutorial will walk you through everything you need to get productive in just a few minutes.

## Your Dashboard

The **Dashboard** is your command centre. Here you'll find:

- **Quick Stats** — document count, AI credits, storage usage, and content health at a glance
- **Quick Actions** — shortcuts to the AI Assistant, Templates, and Content Audit
- **Recent Documents** — jump back into what you were working on
- **Activity Feed** — see what your team has been up to

## Creating Your First Document

1. Click **+ New Document** in the top-right of your dashboard, or use the **Knowledge Base** section in the sidebar.
2. Choose how to create:
   - **Blank** — start from scratch with our rich editor
   - **From Template** — pick from dozens of ready-made templates
   - **AI from Prompt** — describe what you need and AI writes it
   - **AI from Video** — paste a YouTube link or upload a video file
3. Write, format, and organise your content using the block-based editor.
4. Hit **Publish** when you're ready to share.

## Using AI Features

TyneBase includes powerful AI capabilities:

- **AI Chat** — open the AI Assistant from the sidebar to generate documents, summaries, or get answers from your knowledge base
- **RAG Search** — ask questions in plain English and get cited answers from your docs
- **Video-to-Doc** — turn any video into structured documentation automatically

Each AI action uses credits from your plan. You can see your remaining credits on the dashboard.

## Organising with Categories

Keep your knowledge base tidy:

1. Go to **Knowledge Base** in the sidebar
2. Create categories (folders) to group related documents
3. Drag and drop documents between categories
4. Use colour coding to visually distinguish topics

## Collaborating with Your Team

If you're on a team plan:

- **Invite members** from Settings → Team to add colleagues
- **Team Chat** — use the built-in chat to discuss documents and assign tasks
- **Assign documents** — assign docs or tasks directly to team members from the chat
- **Role-based access** — admins, editors, and viewers each have appropriate permissions

## Publishing Your Knowledge Base

Share your docs with the world:

1. Set documents to **Published** status
2. Your public knowledge base is available at \`yourcompany.tynebase.com/docs\`
3. Customise branding (logo, colours) from Settings → Branding
4. Visitors can search, browse by category, and give feedback

## Keyboard Shortcuts

Speed up your workflow:

- \`⌘/Ctrl + K\` — Global search
- \`⌘/Ctrl + N\` — New document
- \`⌘/Ctrl + S\` — Save document
- \`⌘/Ctrl + Enter\` — Publish document

## Next Steps

You're all set! Here are some things to try:

- Create your first document using AI
- Invite a team member
- Customise your workspace branding
- Explore the template library

If you need help, visit our full documentation or reach out to support. Happy writing!
`
  }
];
