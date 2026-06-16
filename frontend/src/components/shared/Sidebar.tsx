import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Building2, FileText, MessageSquare,
  BarChart3, Bell, Users, LogOut,
} from 'lucide-react';
import { useLogout, useAuth } from '../../hooks/useAuth';
import { useUnreadAlertCount } from '../../hooks/useAlerts';
import clsx from 'clsx';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/companies', icon: Building2, label: 'Companies' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/chat', icon: MessageSquare, label: 'AI Assistant' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
];

const adminNav = [
  { to: '/team', icon: Users, label: 'Team' },
];

export default function Sidebar() {
  const { user, organization } = useAuth();
  const logout = useLogout();
  const { data: unreadCount } = useUnreadAlertCount();
  const canSeeAdmin = user?.role === 'owner' || user?.role === 'admin';

  return (
    <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">FI</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">FinIntel</p>
            <p className="text-gray-500 text-xs truncate">{organization?.name}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors relative',
                isActive
                  ? 'bg-blue-600/15 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              )
            }
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
            {to === '/alerts' && !!unreadCount && unreadCount > 0 && (
              <span className="ml-auto bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}

        {canSeeAdmin && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-gray-600 text-xs uppercase tracking-wider px-3">Admin</p>
            </div>
            {adminNav.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive ? 'bg-blue-600/15 text-blue-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  )
                }
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-medium">
              {user?.full_name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-gray-200 text-xs font-medium truncate">{user?.full_name}</p>
            <p className="text-gray-500 text-xs capitalize">{user?.role}</p>
          </div>
          <button onClick={() => logout.mutate()} className="text-gray-600 hover:text-gray-300 transition-colors p-1 rounded" title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
