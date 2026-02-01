-- Migration: Add Legal Document Import Event Types to Lineage
-- Purpose: Add event types for legal document imports (PDF, Word, Excel, etc.)
-- Date: 2026-01-30

-- Add new event types to lineage_event_type enum
ALTER TYPE lineage_event_type ADD VALUE IF NOT EXISTS 'imported_from_pdf';
ALTER TYPE lineage_event_type ADD VALUE IF NOT EXISTS 'imported_from_word';
ALTER TYPE lineage_event_type ADD VALUE IF NOT EXISTS 'imported_from_excel';
ALTER TYPE lineage_event_type ADD VALUE IF NOT EXISTS 'imported_from_powerpoint';
ALTER TYPE lineage_event_type ADD VALUE IF NOT EXISTS 'imported_from_email';
ALTER TYPE lineage_event_type ADD VALUE IF NOT EXISTS 'imported_from_image';
ALTER TYPE lineage_event_type ADD VALUE IF NOT EXISTS 'imported_from_text';
ALTER TYPE lineage_event_type ADD VALUE IF NOT EXISTS 'converted_from_audio';

-- Add comment for documentation
COMMENT ON TYPE lineage_event_type IS 'Event types for document lineage tracking. Includes creation, AI generation, conversions, imports, and lifecycle events.';
