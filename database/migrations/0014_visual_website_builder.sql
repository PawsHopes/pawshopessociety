-- Rebuild the CMS table to support multiple independently versioned blocks
-- in the same page position. Existing sections retain their historical grouping.
DROP INDEX IF EXISTS idx_website_content_pub;

ALTER TABLE website_content RENAME TO website_content_legacy;

CREATE TABLE website_content (
  id TEXT PRIMARY KEY,
  page_slug TEXT NOT NULL,
  section_key TEXT NOT NULL,
  block_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body_json TEXT NOT NULL,
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  seo_title TEXT,
  seo_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version_number INTEGER NOT NULL DEFAULT 1,
  published_at TEXT,
  updated_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  block_type TEXT NOT NULL DEFAULT 'content' CHECK (block_type IN ('content', 'hero', 'text', 'image', 'cta')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (page_slug, block_id, version_number)
);

INSERT INTO website_content (
  id, page_slug, section_key, block_id, title, body_json, media_asset_id,
  seo_title, seo_description, status, version_number, published_at,
  updated_by, block_type, sort_order, created_at, updated_at
)
SELECT
  id, page_slug, section_key, page_slug || ':' || section_key, title, body_json, media_asset_id,
  seo_title, seo_description, status, version_number, published_at,
  updated_by, 'content', 0, created_at, updated_at
FROM website_content_legacy;

DROP TABLE website_content_legacy;

CREATE INDEX idx_website_content_pub
  ON website_content(page_slug, status, sort_order, section_key);
