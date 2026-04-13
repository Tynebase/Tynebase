import { DocArticle } from './types';

export const coreConceptsArticles: DocArticle[] = [
  {
    id: 'cc-1',
    slug: 'document-lifecycle',
    title: 'Document Lifecycle',
    description: 'Understand how documents move through draft, review, and published states.',
    category: 'Core Concepts',
    readTime: '5 min',
    lastUpdated: '2026-01-10',
    tags: ['documents', 'workflow', 'states'],
    content: `
# Document Lifecycle

Every document in TyneBase follows a structured lifecycle that ensures quality and accountability.

## Document States

\`\`\`
┌─────────┐     ┌───────────┐     ┌───────────┐
│  Draft  │ ──▶ │ In Review │ ──▶ │ Published │
└─────────┘     └───────────┘     └───────────┘
     │                                   │
     │                                   ▼
     │                            ┌───────────┐
     └─────────────────────────▶  │  Archived │
                                  └───────────┘
\`\`\`

### Draft
- Initial creation state
- Only visible to author and admins
- Not indexed for AI search
- Can be freely edited

### In Review
- Submitted for approval
- Assigned reviewer notified
- Comments and suggestions enabled
- Changes tracked

### Published
- Visible based on permissions
- Indexed for AI/RAG search
- Version snapshot created
- Lineage tracking active

### Archived
- Hidden from navigation
- Preserved for compliance
- Searchable by admins
- Can be restored

## State Transitions

| From | To | Required |
|------|-----|----------|
| Draft | In Review | Submit action |
| In Review | Published | Reviewer approval |
| In Review | Draft | Rejection with feedback |
| Published | Archived | Archive action |
| Archived | Draft | Restore action |

## Verification Cycles

Published documents can have verification schedules:

- **30 days**: Rapidly changing content
- **90 days**: Standard documentation
- **180 days**: Stable reference material
- **365 days**: Policies and procedures

When verification is due:
1. Owner receives notification
2. Document marked "Needs Review"
3. Must verify or update to clear

## Version History

Every save creates a version snapshot:

\`\`\`json
{
  "version": 5,
  "created_by": "John Doe",
  "created_at": "2026-01-10T14:30:00Z",
  "changes": "Updated API examples",
  "word_count": 1250
}
\`\`\`

Restore any previous version with one click.
`
  },
  {
    id: 'cc-2',
    slug: 'document-lineage',
    title: 'Document Lineage & Audit Trail',
    description: 'Track the complete history of every document from creation to current state.',
    category: 'Core Concepts',
    readTime: '6 min',
    lastUpdated: '2026-01-10',
    tags: ['lineage', 'audit', 'compliance', 'tracking'],
    content: `
# Document Lineage & Audit Trail

TyneBase maintains complete lineage for every document, essential for compliance and accountability.

## What is Document Lineage?

Lineage tracks the complete history of a document:
- **Who** created, edited, or viewed it
- **What** changes were made
- **When** each action occurred
- **How** it was created (manual, AI, template)
- **Why** changes were made (via comments)

## Lineage Events

### Creation Events

| Event | Description |
|-------|-------------|
| \`document_created\` | Manual creation |
| \`document_uploaded\` | File upload |
| \`document_ai_generated\` | AI generation |
| \`document_cloned_from_template\` | Template use |

### Modification Events

| Event | Description |
|-------|-------------|
| \`content_edited\` | Content changes |
| \`metadata_updated\` | Title, tags, category |
| \`version_created\` | New version saved |
| \`version_restored\` | Previous version restored |

### State Changes

| Event | Description |
|-------|-------------|
| \`state_draft\` | Moved to draft |
| \`state_in_review\` | Submitted for review |
| \`state_published\` | Published |
| \`state_archived\` | Archived |

### AI Operations

| Event | Description |
|-------|-------------|
| \`ai_generation_completed\` | AI created content |
| \`rag_context_retrieved\` | Used in RAG query |
| \`document_indexed\` | Added to AI index |
| \`embedding_created\` | Vectors generated |

## AI Generation Metadata

When AI generates a document, we capture:

\`\`\`json
{
  "event_type": "ai_generation_completed",
  "ai_metadata": {
    "model": "deepseek-v3",
    "provider": "bedrock",
    "prompt_hash": "sha256:abc123...",
    "tokens_input": 450,
    "tokens_output": 2100,
    "credits_charged": 0.2,
    "rag_sources": ["doc_123", "doc_456"],
    "temperature": 0.7,
    "generation_time_ms": 4500
  }
}
\`\`\`

## Viewing Lineage

Access document lineage:

1. Open any document
2. Click **menu** → **View History**
3. See complete timeline of document versions with:
   - Version number and timestamp
   - Author information
   - Content preview
   - Ability to restore previous versions

## Compliance Benefits

- **SOC 2**: Complete audit trail
- **GDPR**: Data processing records
- **HIPAA**: Access logging
- **ISO 27001**: Change management

## Lineage API

Retrieve lineage programmatically:

\`\`\`bash
GET /v1/documents/{id}/lineage
\`\`\`

Response includes full event history with actor details.
`
  },
  {
    id: 'cc-3',
    slug: 'content-audit',
    title: 'Content Audit Dashboard',
    description: 'Monitor documentation health, identify stale content, and maintain quality.',
    category: 'Core Concepts',
    readTime: '7 min',
    lastUpdated: '2026-01-10',
    tags: ['audit', 'quality', 'analytics', 'maintenance'],
    content: `
# Content Audit Dashboard

The Content Audit dashboard helps you maintain a healthy, accurate knowledge base.

## Dashboard Overview

\`\`\`
┌─────────────────────────────────────────────────────────┐
│  Content Health Score: 87/100                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Stale    │  │ Low      │  │ Pending  │  │ Broken  │ │
│  │ Content  │  │ Engage   │  │ Review   │  │ Links   │ │
│  │    12    │  │    8     │  │    5     │  │    3    │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                         │
│  Document Health Distribution                           │
│  ████████████████████░░░░  85% Healthy                 │
│  ████░░░░░░░░░░░░░░░░░░░░  12% Needs Review            │
│  █░░░░░░░░░░░░░░░░░░░░░░░   3% Critical                │
│                                                         │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Health Metrics

### Stale Content
Documents not updated within their verification period:

| Age | Status | Action |
|-----|--------|--------|
| 0-90 days | Fresh | None needed |
| 90-180 days | Aging | Review recommended |
| 180+ days | Stale | Verification required |

### Engagement Metrics

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Views/month | >50 | 10-50 | <10 |
| Helpful votes | >70% | 50-70% | <50% |
| Bounce rate | <30% | 30-50% | >50% |

### Content Quality

AI Analyses documents for:
- **Readability**: Flesch-Kincaid score
- **Completeness**: Missing sections
- **Accuracy**: Outdated references
- **Formatting**: Structure issues

## AI Suggestions

The audit system provides AI-powered recommendations:

- **Update Needed**: Technical details may be outdated
- **Expand Section**: Topic needs more detail
- **Add Examples**: Code samples would help
- **Consolidate**: Similar documents exist
- **Archive**: No longer relevant

## Bulk Operations

From the audit dashboard, perform bulk actions:

1. Select multiple documents
2. Choose action:
   - Assign for review
   - Update verification date
   - Change category
   - Archive

## Scheduled Reports

Configure automated audit reports:

- **Frequency**: Daily, Weekly, Monthly
- **Recipients**: Admin team email
- **Content**: Health summary, action items
- **Format**: Email or Slack notification

## Content Audit API

\`\`\`bash
GET /v1/audit/summary
GET /v1/audit/stale-content
GET /v1/audit/suggestions
\`\`\`
`
  },
  {
    id: 'cc-4',
    slug: 'templates',
    title: 'Templates & Community Library',
    description: 'Use and create reusable document templates for consistent documentation.',
    category: 'Core Concepts',
    readTime: '5 min',
    tags: ['templates', 'community', 'reusable'],
    lastUpdated: '2026-04-13',
    content: `
# Templates & Community Library

Use and create reusable document templates for consistent documentation. Templates & Community Library Templates ensure consistency and speed up documentation creation.

## Using Templates

Navigate to the template library via Tools > Templates. From here, you can:
1. Create a template via Create a Template
2. Browse and search through existing templates
3. Preview template content
4. Use a Template

## Creating Templates

1. Enter a template title and description
2. Select the templates category, or create a new one via New Category
3. Choose visibility:
   - Internal: Only visible and usable by your team
   - Public: Share with your community
4. Enter your template content
5. Click Create Template

You can also create a template using AI. Click Open AI Generator to open the Generate Template with AI screen. Describe your template and select your AI model. Click Generate template to generate your new template.

## Template Best Practices

- Use placeholders: [Company Name], [Date]
- Include instructional comments
- Provide example content
- Structure with clear headings

## Community Library

### Discovering Templates

Browse community-contributed templates:
- Featured: Curated by TyneBase team
- Popular: Most used templates
- Recent: Newly published
- Categories: Filter by type

### Contributing Templates

Share your templates with the community:
1. Create and refine your template
2. Ensure Public visibility is selected
3. Add description and tags
4. Submit for review

Approved templates will appear in the public library.

## Template Variables

Templates support dynamic variables:

# {{ project_name }} API Documentation
**Version**: {{version}}
**Last Updated**: {{date}}
**Author**: {{author}}

## Overview
{{ project_name }} provides...

Variables are prompted when using the template.
`
  },
  {
    id: 'cc-5',
    slug: 'community-forum',
    title: 'Community Forum',
    description: 'Collaborate with your team through discussions, Q&A, and announcements.',
    category: 'Core Concepts',
    readTime: '4 min',
    lastUpdated: '2026-01-10',
    tags: ['community', 'forum', 'collaboration', 'discussions'],
    content: `
# Community Forum

The Community Forum enables team collaboration beyond documentation.

## Forum Features

### Discussions

Start conversations on any topic:

- **Questions**: Get help from teammates
- **Ideas**: Propose improvements
- **Announcements**: Share important updates
- **Show & Tell**: Highlight achievements

### Q&A Format

For questions, enable Q&A mode:

- Answers can be marked as solutions
- Solved questions show ✅
- Solutions appear first
- Author or admin can mark solution

## Creating a Discussion

1. Navigate to **Community**
2. Click **+ New Discussion**
3. Choose type (Question, Idea, etc.)
4. Write title and content
5. Add tags for discoverability
6. Post

### Formatting

Full Markdown support:
- Code blocks with syntax highlighting
- Images and file attachments
- @mentions for notifications
- Links to documents

## Engagement Features

### Reactions

React to posts and replies:
- 👍 Upvote helpful content
- ❤️ Show appreciation
- 🎉 Celebrate wins

### Following

- Follow discussions for updates
- Watch categories
- Notification preferences in Settings

## Moderation

Admins can:
- Pin important discussions
- Lock threads
- Move to different categories
- Edit or remove content
- Assign moderator roles

## Integration with Knowledge Base

### Link to Docs

Reference documentation in discussions:

\`\`\`
Check out [[Getting Started Guide]] for setup steps.
\`\`\`

### Promote to Documentation

Great answers can become docs:

1. Select answer content
2. Click **Create Document**
3. Edit and publish

## Search

Search across all discussions:
- Filter by category, author, date
- Find solved vs. open questions
- Sort by engagement or recency
`
  }
];
