-- Add ordered, typed website blocks for the Super Admin visual page builder.
ALTER TABLE website_content ADD COLUMN block_type TEXT NOT NULL DEFAULT 'content'
  CHECK (block_type IN ('content', 'hero', 'text', 'image', 'cta'));
ALTER TABLE website_content ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_website_content_public_order
  ON website_content(page_slug, status, sort_order, section_key);
