import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PawPrint,
  Siren,
  Stethoscope,
  HeartHandshake,
  IndianRupee,
  Package,
  Users,
  Globe,
  ShieldCheck,
  FileSearch,
  UserPlus,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import type { AuthUser } from './lib/api';
import { NotificationCenter } from './components/NotificationCenter';

interface LayoutProps {
  user: AuthUser;
  children: React.ReactNode;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard:read', phase: 'Active' },
  { to: '/users', label: 'Users & RBAC', icon: ShieldCheck, perm: 'users:manage', phase: 'Active' },
  { to: '/join-requests', label: 'Join Requests', icon: UserPlus, perm: 'users:manage', phase: 'Active' },
  { to: '/audit-logs', label: 'Audit Trail', icon: FileSearch, perm: 'audit:read', phase: 'Active' },
  { to: '/modules/animals', label: 'Animals', icon: PawPrint, perm: 'animals:read', phase: 'Active' },
  { to: '/modules/rescue', label: 'Rescue Cases', icon: Siren, perm: 'rescue:read', phase: 'Phase 4' },
  { to: '/modules/medical', label: 'Veterinary', icon: Stethoscope, perm: 'medical:read', phase: 'Phase 4' },
  { to: '/modules/adoptions', label: 'Adoptions', icon: HeartHandshake, perm: 'adoption:read', phase: 'Phase 4' },
  { to: '/modules/finance', label: 'Donations & Ledger', icon: IndianRupee, perm: 'finance:read', phase: 'Active' },
  { to: '/modules/inventory', label: 'Inventory', icon: Package, perm: 'inventory:read', phase: 'Phase 5' },
  { to: '/modules/volunteers', label: 'Volunteers', icon: Users, perm: 'volunteers:read', phase: 'Phase 5' },
  { to: '/modules/cms', label: 'Website CMS', icon: Globe, perm: 'cms:read', phase: 'Active' },
];

export const Layout: React.FC<LayoutProps> = ({ user, children, onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleNav = NAV_ITEMS.filter((item) => user.permissions.includes(item.perm));
  const canRunNotifications = user.roleCode === 'super_admin' &&
    ['hopezpaws@gmail.com', 'infosecayush@gmail.com'].includes(user.email.toLowerCase().trim());

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#fdfbf7]">
      <header className="lg:hidden bg-slate-900 text-white px-4 h-16 flex items-center justify-between sticky top-0 z-40 shadow">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Paws Hopes Society" className="h-9 w-9 rounded-full border border-brandOrange" />
          <div>
            <p className="font-bold text-sm leading-tight">Paw&apos;s Hopez ERP</p>
            <p className="text-[11px] text-orange-300">{user?.roleName || 'Connecting...'}</p>
          </div>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Toggle Menu">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      <aside className={`${mobileOpen ? 'fixed inset-0 top-16 z-30 block' : 'hidden'} lg:block lg:w-64 lg:shrink-0 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800`}>
        <div className="hidden lg:flex items-center gap-3 px-5 h-20 border-b border-slate-800">
          <img src="/logo.png" alt="Paws Hopes Society" className="h-11 w-11 rounded-full border-2 border-brandOrange" />
          <div>
            <span className="font-bold text-white block leading-tight">Paw&apos;s Hopez</span>
            <span className="text-xs text-brandOrange font-medium">NGO Admin ERP</span>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-brandOrange text-white shadow' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                <span className="flex items-center gap-3"><Icon className="w-4 h-4" />{item.label}</span>
                {item.phase !== 'Active' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{item.phase}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60 text-xs">
          <p className="font-semibold text-white truncate">{user?.fullName || 'Unauthenticated'}</p>
          <p className="text-slate-400 truncate">{user?.email || 'Configure Cloudflare Access'}</p>
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-brandGreen/20 text-green-300 font-medium">{user?.roleName || 'No Active Session'}</span>
          <button type="button" onClick={onLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            aria-label="Log out of Paw's Hopez ERP">
            <LogOut className="h-4 w-4" />
            Log out
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Automatic sign-out after 15 minutes of inactivity. Maximum app session: 8 hours.</p>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto"><div className="mb-4 flex justify-end"><NotificationCenter canRun={canRunNotifications} /></div>{children}</main>
    </div>
  );
};
