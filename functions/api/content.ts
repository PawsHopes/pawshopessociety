interface D1Result {
  results?: Record<string, unknown>[];
}

interface D1Statement {
  all(): Promise<D1Result>;
}

interface D1Binding {
  prepare(sql: string): D1Statement;
}

interface PagesEnv {
  DB?: D1Binding;
}

interface PagesContext {
  env: PagesEnv;
}

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  if (!context.env.DB) {
    return Response.json(
      { success: false, error: { code: 'CONTENT_FEED_UNAVAILABLE', message: 'Public content is temporarily unavailable.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const result = await context.env.DB.prepare(`
      SELECT wc.id, wc.page_slug AS pageSlug, wc.section_key AS sectionKey,
        wc.title, wc.body_json AS bodyJson, wc.seo_title AS seoTitle,
        wc.seo_description AS seoDescription, wc.published_at AS publishedAt,
        ma.public_url AS mediaUrl
      FROM website_content wc
      LEFT JOIN media_assets ma ON ma.id = wc.media_asset_id
      WHERE wc.status = 'published'
      ORDER BY wc.page_slug ASC, wc.section_key ASC, wc.sort_order ASC
    `).all();

    return Response.json(
      { success: true, data: { items: result.results || [] } },
      { headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Content-Type-Options': 'nosniff',
      } },
    );
  } catch {
    return Response.json(
      { success: false, error: { code: 'CONTENT_FEED_UNAVAILABLE', message: 'Public content is temporarily unavailable.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
};
