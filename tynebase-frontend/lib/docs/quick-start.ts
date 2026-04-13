import { DocArticle } from './types';

export const quickStartArticles: DocArticle[] = [
  {
    id: 'qs-1',
    slug: 'creating-first-document',
    title: 'Creating Your First Document',
    description: 'Learn how to create, edit and publish your first knowledge base article in TyneBase.',
    category: 'Quick start',
    readTime: '3 min',
    lastUpdated: '2026-04-10',
    tags: ['getting-started', 'documents', 'basics'],
    content: `
# Creating Your First Document

Welcome to TyneBase! This guide will walk you through creating your first knowledge base document.

## Choose a Creation Method

TyneBase offers multiple ways to create documents:

- **Blank Document**: Start from scratch with our rich text editor
- **From a template**: Use a pre-built template from our library
- **From an AI prompt**: Describe what you need and let AI generate it
- **From a video**: Upload a YouTube link or video file
- **From an audio source**: Upload an audio source

For this guide, select **Blank Document**.

## Opening the Document Editor

After signing in, you'll land on your workspace dashboard. Click **+ New Document** at the top right-hand side of the page:

![New Document button|240px](/newdocument.png)

To open the document editor:

![Document editor](/doceditor.png)

From here, you can start drafting your document.

## Writing Your Content

Our editor supports:

- **Rich Text Formatting**: Bold, italic, headings, lists
- **Code Blocks**: Syntax highlighting for 50+ languages
- **Tables**: Create structured data tables
- **Images & Files**: Drag and drop media
- **Embeds**: YouTube, Loom, Figma, and more

## Setting Metadata

Before publishing, set the metadata for your document. These settings are found within the **Document settings** tab:

![Document settings tab|240px](/docsettingstab.png)

| Field | Description |
|-------|-------------|
| **Title** | Clear, searchable document title |
| **Category** | Organise into your knowledge structure |
| **Tags** | Add keywords for better discoverability |
| **Visibility** | Public, Internal or Restricted |

## Publishing Your Document

Once you are finished with your article, you can either save it as a **draft** to work on it later or save and publish it.

To publish your article, click **Save & Publish**:

![Save and Publish button|240px](/save_publish.png)

To make your document live. It will immediately:

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

> Please note that this guide is intended for administrators.

## Step 1: Configure Branding

Navigate to **Admin > Branding** to display the Branding & Domain screen. From here, you can customise the following:

- **Custom Domain**: Point your own domain to your TyneBase workspace portal
- **Logo**: Upload your company logo (SVG or PNG recommended)
- **Primary Colour**: Your brand's main colour
- **Secondary Colour**: Accent colour for highlights

Click **Save** to save your changes.

## Step 2: Create Categories

Categories organise your knowledge base. Navigate to **Knowledge Base > Categories** and click **New Category**. The Create New Category screen is displayed. Here, you can give your new category a Name, Description, Icon and Colour.

Once you have added the details of your category, click **Create Category**.

To add documents to your category, from the **All documents** screen, select which documents you want to add and click **Assign a Category**. Select your category from the drop-down menu and click **Assign Category**.

## Step 3: Understanding Permissions

TyneBase uses role-based access control (RBAC):

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access, user management and branding |
| **Editor** | Create, edit and publish documents |
| **Contributor** | Create drafts and suggest edits |
| **View Only** | Read-only access |

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

1. Navigate to **Admin > Users & Teams**
2. Click **+ Invite Member**
3. Enter the email address of the user you want to invite
4. Select the role for the user
5. Click **Send Invite**

The user will receive an email with a secure signup link. Once followed, they will be able to access your platform, with access dependent on the role selected.

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

| Team Type | Recommended Role |
|-----------|------------------|
| Documentation team | Editor – Can create and edit workspace content |
| General employees | Viewer – Read-only access |
| IT/Operations | Admin – Can manage members and workspace settings |
| Your clients / Users | Community contributor – Can participate in community discussions |
| IT/Operations | Community Admin – Can moderate community discussions |

## Pending Invitations

Track invitation status in **Admin > Users & Teams > Pending**:

- **Pending**: Invitation sent, not yet accepted
- **Expired**: 7-day expiration — you can resend an invitation
- **Accepted**: User has joined

## Managing Users

Once users have joined, you can:

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
    tags: ['ai', 'generation', 'getting-started'],
    lastUpdated: '2026-04-13',
    content: `
# Your First AI Generation

Use AI to automatically generate documentation from a simple prompt. Your First AI Generation TyneBase's AI can generate comprehensive documentation from simple descriptions.

## Accessing AI Assistant

From your dashboard, click AI Assistant to generate content from:
- Prompt: Describe what you want your documentation to be
- URL: Enter a URL to scape content from and output as various types
- Import documents & media: Drag and drop various types of documentation to import them into TyneBase

## Generating from a Prompt

### Step 1: Describe Your Document

Enter a clear, detailed prompt:

Create a comprehensive onboarding guide for new software engineers. Include sections on:
- Setting up development environment
- Code review process
- Deployment procedures
- Team communication channels

### Step 2: Configure Options

| Option | Description |
|--------|-------------|
| **Output Style** | Select which output style of document you want: Full Article, Summary, Outline, With Template (Uses an existing template). You can select multiple output styles. |
| **AI Provider** | You have 3 options of AI provider at the moment: Deepseek, Gemini 2.5, Claude Sonnet 4.5. Different AI providers cost different credits, so please ensure you check the final credit cost before generating your document. |
| **With Template** | Select and use an existing template within TyneBase as the basis for your document. |
| **Include** | Code examples, diagrams, checklists |

### Step 3: Generate & Review

Click Generate and wait for the document to be produced. The AI will:
1. Analyse your prompt
2. Retrieve relevant context from your existing docs (RAG)
3. Generate structured content
4. Format with proper headings, lists, and code blocks

### Step 4: Edit & Publish

AI-generated content is created as a Draft. Review and edit your document before publishing:
- Verify accuracy of technical details
- Add company-specific information
- Adjust tone and formatting
- Include relevant links
- Add any required screenshots

## Tips for Better Results

- Be Specific: More detail = better output
- Provide Context: Reference existing docs or standards
- Use Examples: "Similar to our API documentation..."
- Iterate: Generate multiple versions and combine the best parts

## Document Lineage

All AI-generated documents automatically track:
- Source prompt
- AI model used
- Generation timestamp
- Token usage and cost
- Edit history post-generation

In addition to creating content via a prompt, on this screen, you can also generate content from a URL or by Importing Documents & media. This works in the same way as generating from a prompt, except you need to either enter a URL to scrape from, or select and upload the documents to create content from. Finally, you can also generate content from a video, from audio and also enhance your documents through AI. These will be covered in another article.
`
  },
  {
    id: 'qs-5',
    slug: 'understanding-dashboard',
    title: 'Understanding Your Dashboard',
    description: 'Navigate the TyneBase dashboard and understand key metrics.',
    category: 'Quick start',
    readTime: '4 min',
    tags: ['dashboard', 'navigation', 'overview'],
    lastUpdated: '2026-04-13',
    content: `
# Understanding Your Dashboard

Navigate the TyneBase dashboard and key metrics. Understanding Your Dashboard The TyneBase dashboard gives you a complete overview of your knowledge base and has quick buttons to help you generate content from AI, access your templates and access the content audit screen.

## Dashboard Layout

The dashboard features a sidebar with navigation, main content area with quick stats, recent activity feed, and content health metrics.

## Key Metrics

### Content Overview

| Metric | Description |
|--------|-------------|
| **Total Documents** | Total amount of articles in your knowledge base. Includes and numbers how many of these documents are published. |
| **Team members** | How many active users you have. |
| **AI Generations** | How many AI generations you have left based on the amount of credits you have. |
| **Content Health** | Your overall content health. |

### Additional Features

From the dashboard, you can also:
- Access the AI Assistant
- Browse the Template library
- Access the Content audit screen
- View your recent documents
- View your recent activity
- Create a new document

Each of these features will be covered more in-depth in other help articles.

## Global Search

In addition, you have access to a global search option. Press ⌘ + K (Mac) or Ctrl + K (Windows) to open global search, or click in the search box.
`
  },
  {
    id: 'qs-6',
    slug: 'article-setting-up-workspace',
    title: 'Setting Up Your Workspace Guide',
    description: 'Configure your TyneBase workspace with branding, categories and team settings.',
    category: 'Quick start',
    readTime: '5 min',
    tags: ['workspace', 'setup', 'branding', 'categories'],
    lastUpdated: '2026-04-13',
    content: `
# Setting Up Your Workspace

Configure your TyneBase workspace with branding, categories and team settings. Setting Up Your Workspace Your TyneBase workspace is your team's central knowledge hub. This guide covers essential configuration. Please note that this guide is intended for administrators.

## Workspace Structure

Your workspace includes Knowledge Base, AI Assistant, Community, and Templates Library.

## Configure Branding

Navigate to Admin > Branding to display the Branding & Domain screen.

From here, you can customise the following:
- Custom Domain: Point your own domain to your TyneBase workspace portal
- Logo: Upload your company logo (SVG or PNG recommended)
- Favicon: Custom browser tab icon
- Primary Colour: Your brand's main colour
- Secondary Colour: Accent colour for highlights

Click Save to save your changes.

## Create Categories

Categories organise your knowledge base. To manage your categories, navigate to Knowledge Base > Categories.

Click New Category.

The Create New Category screen is displayed. Here, you can give your new category a Name, Description, Icon and Colour. Once you have added the details of your category, click Create Category. Your new category will be created.

To add documents to your category, from the All documents screen, select which documents you want to add to your category and then click Assign a Category.

The Assign a Category screen will be displayed. Select your category from the drop down menu and click Assign Category: Your documents will now be assigned to your chosen category.

## Understanding Permissions

TyneBase uses role-based access control (RBAC):

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access, user management and branding |
| **Editor** | Create, edit and publish documents |
| **Contributor** | Create drafts and suggest edits |
| **View Only** | Read-only access |

## Configure AI Settings

In Settings → AI Configuration:
- Select your preferred AI provider (OpenAI, Google, or Anthropic)
- Set monthly AI generation limits
- Configure RAG indexing preferences
- Enable/disable AI features per role
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
