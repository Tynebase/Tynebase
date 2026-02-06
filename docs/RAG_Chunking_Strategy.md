# TyneBase RAG & Chunking Strategy

## Overview

TyneBase implements a sophisticated **hybrid chunking strategy** combined with **two-stage RAG retrieval** to achieve +50-70% accuracy improvement over baseline approaches. The system is designed for EU/UK GDPR compliance with data residency requirements.

## Document Processing Pipeline

### 1. Document Normalization to Markdown

All documents are normalized to Markdown format before chunking to preserve structure and improve LLM comprehension.

**Why Markdown Normalization?**
- **Structure preservation**: Headings, tables, lists survive processing
- **LLM-friendly**: Models are trained extensively on Markdown
- **Consistent chunking**: Easier to split at semantic boundaries
- **Rich context**: Bold, links, code blocks provide semantic signals

**Supported Formats:**
- PDFs (using PyMuPDF4LLM for structure preservation)
- DOCX (using Mammoth for style preservation)
- HTML (using Turndown for clean conversion)
- Markdown (native support)
- Plain text (basic structure wrapping)

### 2. Intelligent Semantic Chunking

Based on 2025 RAG research, we use a **hybrid chunking strategy** that preserves document structure while maintaining semantic coherence.

**Chunking Strategy Comparison:**
| Strategy | Accuracy Improvement | Best For |
|----------|---------------------|----------|
| Fixed-size | Baseline | Prototyping only |
| Recursive | +15-25% | General documents |
| Semantic | +40-70% | Knowledge bases, technical docs |
| By-Title/Heading | +30-45% | Structured reports, manuals |
| **Hybrid (Our Choice)** | **+50-70%** | **All document types** |

**Our Approach: Structure-Aware Semantic Chunking**

The chunking process uses a four-pass approach:

1. **First pass**: Split by document structure (headings, sections)
2. **Second pass**: Apply semantic chunking within large sections
3. **Third pass**: Merge small adjacent chunks if semantically similar
4. **Final**: Add contextual prefix to each chunk (document title + parent heading)

**Key Configuration:**
- **Target chunk size**: 400 tokens (optimal for retrieval precision)
- **Overlap**: 50 tokens (~12% overlap for context continuity)
- **Minimum chunk size**: 50 tokens (avoid tiny chunks)
- **Semantic similarity threshold**: 0.85 (for merging adjacent chunks)
- **Context prefixes**: Critical for preserving meaning

### 3. Vector Embedding System

**Embedding Model**: OpenAI text-embedding-3-large
- **Dimensions**: 3072 (updated from 1536 for higher accuracy)
- **Max tokens**: 8191 per request
- **Processing**: Batch processing (100 items per batch)
- **Region**: EU endpoint for GDPR compliance

**Database Storage:**
- **Vector database**: PostgreSQL with pgvector extension
- **Indexing**: HNSW index for fast similarity search
- **Similarity metric**: Cosine similarity
- **Search function**: Optimized for tenant isolation

### 4. Two-Stage RAG Retrieval with Reranking

Research shows reranking improves retrieval accuracy by 20-48%. We use a two-stage approach:

**Stage 1: Fast Vector Similarity Search**
- Retrieve top 50 candidates using vector similarity
- Minimum similarity threshold: 0.5
- Tenant-isolated search
- Fast but broad retrieval

**Stage 2: Cross-Encoder Reranking**
- Rerank top candidates using sophisticated models
- Select final top 5-10 results
- Slower but highly precise
- Significant accuracy improvement

**Reranking Model Options:**
| Model | Latency | Accuracy | Provider | Region |
|-------|---------|----------|----------|--------|
| Cohere Rerank v3.5 | 200-400ms | Highest | AWS Bedrock | EU (Frankfurt) |
| Google Semantic Ranker | 300-500ms | High | Vertex AI | EU (Netherlands) |
| Mixedbread mxbai-v2 | 100-200ms | High | Local (ONNX) | Local (Fly.io) |

### 5. Hybrid Search: Vector + Full-Text

For optimal results, the system combines:
- **Vector similarity** (70% weight): Semantic understanding
- **Full-text search** (30% weight): Keyword matching
- **Combined scoring**: Best of both approaches

### 6. EU-Compliant AI Provider Strategy

The system uses a model router to ensure EU data residency:

**Primary Providers:**
- **OpenAI**: EU-specific endpoint (api.eu.openai.com)
- **Google Vertex AI**: Europe-west3 (Frankfurt)
- **AWS Bedrock**: EU-Central-1 (Frankfurt)

**Model Selection Logic:**
- **Video/Audio processing**: Gemini 3.0 Flash (native multimodal)
- **Transcription**: Whisper 3 Turbo
- **RAG/Text generation**: Provider preference based on quality/speed/cost priorities
- **Complex reasoning**: Claude Sonnet 4.5 or DeepSeek V3

## Key Benefits

### Accuracy Improvements
- **Hybrid chunking**: +50-70% over baseline
- **Reranking**: +20-48% additional improvement
- **Hybrid search**: Better relevance for diverse queries

### Compliance & Security
- **EU data residency**: All processing within EU borders
- **Tenant isolation**: Complete data separation
- **GDPR compliant**: Privacy-by-design architecture

### Performance
- **Fast retrieval**: Vector search for initial candidates
- **Precise results**: Reranking for final selection
- **Scalable**: Batch processing and efficient indexing

### Context Preservation
- **Document structure**: Maintained through chunking
- **Contextual prefixes**: Critical for meaning preservation
- **Semantic coherence**: Intelligent merging and splitting

## Implementation Highlights

The strategy emphasizes:
1. **Structure-aware processing** rather than naive text splitting
2. **Multi-stage retrieval** for balance of speed and precision
3. **EU compliance** as a fundamental requirement
4. **Context preservation** to maintain document meaning
5. **Hybrid approaches** combining multiple techniques for optimal results

This comprehensive approach ensures that TyneBase delivers highly accurate, contextually relevant AI responses while maintaining strict compliance with EU data protection regulations.
