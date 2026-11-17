import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { publicContentRoutes } from '../src/routes/public/content';
import type { Bindings, AppVariables } from '../src/types/env';

describe('public CMS content feed', () => {
  it('returns published sections in deterministic drag-and-drop order only', async () => {
    let sql = '';
    const rows = [
      { id: 'c1', pageSlug: 'index.html', sectionKey: 'top_of_page', title: 'Welcome', sortOrder: 0 },
      { id: 'c2', pageSlug: 'index.html', sectionKey: 'after_intro', title: 'Our work', sortOrder: 1 },
    ];
    const DB = {
      prepare(query: string) {
        sql = query;
        return { all: async () => ({ results: rows }) };
      },
    };
    const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
    app.route('/content', publicContentRoutes);
    const response = await app.request('/content', {}, { DB } as unknown as Bindings);
    expect(response.status).toBe(200);
    const payload = await response.json() as { data: { items: Array<{ id: string }> } };
    expect(payload.data.items.map((item) => item.id)).toEqual(['c1', 'c2']);
    expect(sql).toContain("WHERE wc.status = 'published'");
    expect(sql).toContain('wc.sort_order AS sortOrder');
    expect(sql).toContain('ORDER BY wc.page_slug ASC, wc.sort_order ASC, wc.section_key ASC');
    expect(response.headers.get('cache-control')).toContain('max-age=60');
  });
});
