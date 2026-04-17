-- Fix YouTube watch URLs in existing documents by converting them to embed URLs
-- This resolves X-Frame-Options blocking issues

UPDATE documents
SET content = REGEXP_REPLACE(
    content,
    'https://www\.youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
    'https://www.youtube.com/embed/\1',
    'g'
)
WHERE content LIKE '%youtube.com/watch%';

-- Also fix youtu.be short URLs
UPDATE documents
SET content = REGEXP_REPLACE(
    content,
    'https://youtu\.be/([a-zA-Z0-9_-]{11})',
    'https://www.youtube.com/embed/\1',
    'g'
)
WHERE content LIKE '%youtu.be/%';

-- Also fix YouTube Shorts URLs
UPDATE documents
SET content = REGEXP_REPLACE(
    content,
    'https://www\.youtube\.com/shorts/([a-zA-Z0-9_-]{11})',
    'https://www.youtube.com/embed/\1',
    'g'
)
WHERE content LIKE '%youtube.com/shorts%';

-- Verify the changes
SELECT id, title,
    CASE
        WHEN content LIKE '%youtube.com/watch%' OR content LIKE '%youtube.com/shorts%' OR content LIKE '%youtu.be/%' THEN 'STILL HAS NON-EMBED URL'
        WHEN content LIKE '%youtube.com/embed%' THEN 'HAS EMBED URL'
        ELSE 'NO YOUTUBE'
    END as youtube_status
FROM documents
WHERE content LIKE '%youtube.com%' OR content LIKE '%youtu.be%';
