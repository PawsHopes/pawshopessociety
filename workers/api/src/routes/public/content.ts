import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../../types/env';

export const publicContentRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

publicContentRoutes.get('/', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT wc.id, wc.page_slug AS pageSlug, wc.section_key AS sectionKey,
      wc.title, wc.body_json AS bodyJson, wc.seo_title AS seoTitle,
      wc.seo_description AS seoDescription, wc.published_at AS publishedAt,
      ma.public_url AS mediaUrl
    FROM website_content wc
    LEFT JOIN media_assets ma ON ma.id = wc.media_asset_id
    WHERE wc.status = 'published'
    ORDER BY wc.page_slug ASC, wc.section_key ASC, wc.sort_order ASC
  `).all();
  c.header('Cache-Control', 'public, max-age=60, s-maxage=60');
  return c.json({ success: true, data: { items: result.results || [] } });
});
