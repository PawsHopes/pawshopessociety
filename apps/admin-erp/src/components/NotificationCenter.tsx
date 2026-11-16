import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: number | boolean;
  createdAt: string;
};

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<{ items: NotificationItem[]; unreadCount: number }>('/api/v1/admin/notifications?limit=40');
    if (result.success && result.data) {
      setItems(result.data.items || []);
      setUnreadCount(Number(result.data.unreadCount || 0));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  const markRead = async (item: NotificationItem) => {
    if (!Boolean(item.isRead)) {
      await apiFetch('/api/v1/admin/notifications/' + encodeURIComponent(item.id) + '/read', { method: 'POST' });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: 1 } : entry));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    setOpen(false);
    if (item.link?.startsWith('/')) navigate(item.link);
  };

  const markAllRead = async () => {
    const result = await apiFetch('/api/v1/admin/notifications/read-all', { method: 'POST' });
    if (result.success) {
      setItems((current) => current.map((item) => ({ ...item, isRead: 1 })));
      setUnreadCount(0);
    }
  };

  return (
    <div className="relative z-40">
      <button type="button" onClick={() => { setOpen((value) => !value); if (!open) void load(); }}
        aria-label={unreadCount ? 'Notifications, ' + unreadCount + ' unread' : 'Notifications'}
        aria-expanded={open}
        className="relative inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
        <Bell className="h-4 w-4" /> Notifications
        {unreadCount > 0 && <span className="min-w-5 rounded-full bg-orange-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && <section className="absolute right-0 mt-2 w-[min(92vw,26rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div><h2 className="font-bold text-slate-900">Notifications</h2><p className="text-xs text-slate-500">{unreadCount} unread</p></div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!unreadCount} onClick={() => void markAllRead()} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 disabled:opacity-40"><CheckCheck className="h-3.5 w-3.5" />Read all</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">Close</button>
          </div>
        </header>
        <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
          {loading && items.length === 0 ? <p className="p-5 text-sm text-slate-500">Loading notifications…</p>
            : items.length === 0 ? <p className="p-5 text-sm text-slate-500">You’re all caught up. New rescue, adoption, medical and stock alerts will appear here.</p>
            : items.map((item) => <button key={item.id} type="button" onClick={() => void markRead(item)} className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${Boolean(item.isRead) ? 'bg-white' : 'bg-orange-50/60'}`}>
              <span className="flex items-start justify-between gap-3"><span className="text-sm font-bold text-slate-900">{item.title}</span>{!Boolean(item.isRead) && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-600" />}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">{item.message}</span>
              <span className="mt-2 flex items-center justify-between text-[10px] text-slate-400"><span>{new Date(item.createdAt).toLocaleString()}</span>{item.link && <span className="inline-flex items-center gap-1 font-semibold text-orange-700">Open <ExternalLink className="h-3 w-3" /></span>}</span>
            </button>)}
        </div>
      </section>}
    </div>
  );
};
