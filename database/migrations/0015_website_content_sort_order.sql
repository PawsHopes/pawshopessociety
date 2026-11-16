-- ============================================================================
-- 0015: DETERMINISTIC ORDER FOR VISUAL WEBSITE CMS SECTIONS
-- ============================================================================
ALTER TABLE website_content ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_website_content_public_order
  ON website_content(page_slug, status, sort_order, section_key);
