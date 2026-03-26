import { DocArticle } from './types';

export const aiFeatureArticles: DocArticle[] = [
  {
    id: 'ai-1',
    slug: 'ai-from-prompt',
    title: 'Generate Documentation from Prompts',
    description: 'Create comprehensive documentation by describing what you need in natural language.',
    category: 'AI Features',
    readTime: '6 min',
    lastUpdated: '2026-01-10',
    tags: ['ai', 'generation', 'prompts', 'llm'],
    content: `
# Generate Documentation from Prompts

TyneBase's AI can transform simple descriptions into comprehensive, well-structured documentation.

## How It Works

Our AI pipeline uses a multi-stage process:

1. **Prompt Analysis**: Understanding your intent and requirements
2. **RAG Context Retrieval**: Finding relevant existing documentation
3. **Content Generation**: Creating structured, accurate content
4. **Processing**: Transforming your knowledge to md and ingesting it to the database.
5. **Post-Processing**: Formatting, linking, and quality checks


## Writing Effective Prompts

### Be Specific

❌ "Write about our API"

✅ "Create a comprehensive REST API reference for our user authentication endpoints, including request/response examples, error codes, and rate limiting details"

### Provide Context

\`\`\`
Create an onboarding guide for new backend engineers.

Context:
- We use Node.js with TypeScript
- Our API runs on Fly.io
- We use Supabase for database and auth
- Code reviews are required before merging

Include sections on:
1. Local development setup
2. Code style and conventions
3. Pull request workflow
4. Deployment process
\`\`\`

### Specify Format

| Format | Best For |
|--------|----------|
| **Article** | Explanatory content, concepts |
| **Guide** | Step-by-step procedures |
| **Runbook** | Operational procedures |
| **FAQ** | Common questions |
| **Reference** | API docs, specifications |

## AI Provider Options

TyneBase supports three EU-compliant AI providers:

### DeepSeek V3 — 0.2 credits per generation
- **Best for**: Quick drafts, routine documentation
- **Strengths**: Fastest, most economical
- **Region**: eu-west-1 via AWS Bedrock

### Google Gemini 2.5 Flash — 1 credit per generation
- **Best for**: Research-heavy content, multimodal
- **Strengths**: Large context window, balanced quality
- **Region**: europe-west2 (London) via Vertex AI

### Anthropic Claude Sonnet 4.5 — 2 credits per generation
- **Best for**: Nuanced writing, complex analysis
- **Strengths**: Detailed reasoning, best output quality
- **Region**: eu-central-1 via AWS Bedrock

## Generation Settings

| Setting | Options | Description |
|---------|---------|-------------|
| **Tone** | Professional, Casual, Technical | Writing style |
| **Length** | Brief, Standard, Comprehensive | Content depth |
| **Examples** | On/Off | Include code samples |
| **RAG Context** | On/Off | Use existing docs as reference |

## Document Lineage

Every AI-generated document tracks:

\`\`\`json
{
  "source": "ai_generated",
  "prompt_hash": "sha256:abc123...",
  "model": "deepseek-v3",
  "tokens_used": 2847,
  "credits_charged": 0.2,
  "rag_sources": ["doc-123", "doc-456"],
  "generated_at": "2026-01-10T14:30:00Z"
}
\`\`\`

## Best Practices

1. **Review Before Publishing**: AI content is created as drafts
2. **Verify Technical Details**: Especially code and configurations
3. **Add Company Context**: Include internal links and specifics
4. **Iterate**: Generate multiple versions and combine the best
5. **Use RAG**: Enable context retrieval for consistency
`
  },
  {
    id: 'ai-2',
    slug: 'ai-from-video',
    title: 'Generate Documentation from Videos',
    description: 'Upload YouTube links or video files and let AI create structured documentation.',
    category: 'AI Features',
    readTime: '5 min',
    lastUpdated: '2026-01-10',
    tags: ['ai', 'video', 'youtube', 'transcription'],
    content: `
# Generate Documentation from Videos

Transform video content into searchable, structured documentation automatically.

## Supported Sources

- **YouTube Links**: Paste any public YouTube URL
- **Video Files**: Upload MP4, WebM, MOV (up to 500MB)
- **Loom Videos**: Direct Loom link support
- **Audio Files**: MP3, WAV, M4A for podcasts/meetings

## How It Works

\`\`\`
Video Input → Transcription → Content Analysis → Documentation
     │              │                │                │
     │              │                │                └─ Formatted MD
     │              │                └─ Key points extracted
     │              └─ Whisper 3 / Gemini Flash
     └─ YouTube / Upload
\`\`\`

### Step 1: Input Video

Paste a YouTube URL or drag-and-drop a video file.

### Step 2: Processing

TyneBase automatically:
1. Downloads/processes the video
2. Extracts audio track
3. Transcribes using Gemini 2.5 Flash (native video + audio understanding)
4. Identifies speakers and key topics
5. Extracts key topics and timestamps

### Step 3: Generate Documentation

Choose your output format:

| Format | Description |
|--------|-------------|
| **Meeting Notes** | Summary, action items, decisions |
| **Tutorial** | Step-by-step guide with timestamps |
| **Transcript** | Full text with speaker labels |
| **Key Points** | Bullet-point summary |

## Native Video Understanding

For complex videos, TyneBase uses Gemini 2.5 Flash's native video capabilities:

- **Visual Content**: Understands diagrams, slides, demos
- **Code on Screen**: Extracts code shown in tutorials
- **UI Walkthroughs**: Documents interface interactions
- **Presentations**: Converts slides to documentation

## Example Output

From a 15-minute product demo video:

\`\`\`markdown
# Product Demo: Dashboard Analytics

## Overview
This document summarizes the key features demonstrated 
in the Q1 2026 product demo video.

## Features Covered

### 1. Real-time Analytics (0:00 - 3:45)
- Live visitor tracking
- Engagement metrics
- Custom date ranges

### 2. Export Options (3:45 - 7:20)
- PDF reports
- CSV data export
- Scheduled emails

### 3. Team Collaboration (7:20 - 12:00)
- Shared dashboards
- Comment threads
- @mentions

## Action Items
- [ ] Review new export formats
- [ ] Test scheduled reports
- [ ] Train team on collaboration features
\`\`\`

## Processing Times

| Video Length | Estimated Time |
|--------------|----------------|
| 5 minutes | ~30 seconds |
| 15 minutes | ~1-2 minutes |
| 1 hour | ~5-8 minutes |

## Tips for Best Results

1. **Clear Audio**: Ensure good audio quality in source video
2. **Single Speaker**: Better transcription accuracy
3. **Structured Content**: Videos with clear sections work best
4. **Choose Right Format**: Match output to your needs
`
  },
  {
    id: 'ai-3',
    slug: 'ai-search-rag',
    title: 'AI-Powered Semantic Search',
    description: 'Ask questions in natural language and get answers from your entire knowledge base.',
    category: 'AI Features',
    readTime: '6 min',
    lastUpdated: '2026-01-10',
    tags: ['ai', 'search', 'rag', 'semantic'],
    content: `
# AI-Powered Semantic Search

TyneBase's RAG (Retrieval-Augmented Generation) system lets you ask questions and get accurate answers with cited sources.

## How RAG Works

\`\`\`
User Question
      │
      ▼
┌─────────────────┐
│  Query Embedding │  ← Convert question to vector
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vector Search   │  ← Find similar document chunks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Reranking       │  ← Cross-encoder precision ranking
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Generation  │  ← Generate answer with context
└────────┬────────┘
         │
         ▼
   Answer + Sources
\`\`\`

## Using AI Search

### Quick Search

Press \`⌘ + K\` and type your question:

> "How do I set up SSO with Okta?"

The AI will:
1. Search your entire knowledge base
2. Find relevant documentation
3. Generate a comprehensive answer
4. Cite the source documents

### Advanced Queries

AI search understands context and nuance:

| Query Type | Example |
|------------|---------|
| **How-to** | "How do I configure webhooks?" |
| **Comparison** | "What's the difference between roles?" |
| **Troubleshooting** | "Why is my API returning 403?" |
| **Policy** | "What's our data retention policy?" |

## Search Results

Each result includes:

- **Answer**: AI-generated response
- **Sources**: Linked documents used
- **Confidence**: How certain the AI is
- **Related**: Suggested follow-up questions

## Indexing Configuration

### What Gets Indexed

- All published documents
- Document content and metadata
- Code blocks and tables
- Comments (optional)

### Chunking Strategy

TyneBase uses semantic chunking:

\`\`\`typescript
{
  chunkSize: 512,      // tokens per chunk
  chunkOverlap: 50,    // overlap between chunks
  splitOn: 'semantic', // respect document structure
  preserveTables: true // keep tables intact
}
\`\`\`

## Hybrid Search

We combine vector search with keyword matching:

| Method | Weight | Purpose |
|--------|--------|---------|
| **Vector** | 70% | Semantic understanding |
| **Keyword** | 30% | Exact matches, names |

## Reranking

After initial retrieval, we use cross-encoder reranking for precision:

1. Retrieve top 50 candidates (fast, broad)
2. Rerank with Cohere Rerank v3.5 (slow, precise)
3. Return top 5 most relevant chunks

## Privacy & Compliance

- All AI processing uses EU data centers
- Embeddings are tenant-isolated
- No data leaves your workspace
- Full audit trail of searches
`
  },
  {
    id: 'ai-4',
    slug: 'ai-enhance',
    title: 'Enhance Existing Documents',
    description: 'Use AI to improve, expand, and optimize your existing documentation.',
    category: 'AI Features',
    readTime: '4 min',
    lastUpdated: '2026-01-10',
    tags: ['ai', 'enhancement', 'editing', 'optimization'],
    content: `
# Enhance Existing Documents

AI can improve your documentation quality without starting from scratch.

## Enhancement Options

### Improve Clarity

Simplify complex sentences and improve readability:

**Before:**
> The implementation of the aforementioned functionality necessitates the configuration of multiple parameters...

**After:**
> To set up this feature, configure these parameters...

### Expand Content

Add depth to thin sections:

- Generate missing examples
- Add context and explanations
- Include related information
- Create comparison tables

### Add Structure

Improve document organization:

- Convert prose to bullet points
- Add section headings
- Create tables from lists
- Generate table of contents

### Technical Enhancement

For technical documentation:

- Add code examples
- Generate API request/response samples
- Create configuration snippets
- Add troubleshooting sections

## How to Enhance

1. Open any document in the editor
2. Select the content to enhance (or select all)
3. Click **AI → Enhance** or press \`⌘ + E\`
4. Choose enhancement type
5. Review and apply suggestions

## Enhancement Modes

| Mode | Description |
|------|-------------|
| **Polish** | Fix grammar, improve clarity |
| **Expand** | Add more detail and examples |
| **Simplify** | Reduce complexity, shorter sentences |
| **Technical** | Add code samples, specifications |
| **Executive** | Summary-focused, high-level |

## Suggested Improvements

AI continuously Analyses your docs and suggests:

- **Stale Content**: Needs updating
- **Missing Sections**: Gaps in coverage
- **Unclear Language**: Readability issues
- **Broken Links**: Dead internal links

Find suggestions in **Content Audit → AI Suggestions**.

## Best Practices

1. **Review Changes**: Always review AI suggestions
2. **Preserve Voice**: Maintain your documentation style
3. **Verify Accuracy**: Check technical details
4. **Track Changes**: Use version history
`
  }
];
