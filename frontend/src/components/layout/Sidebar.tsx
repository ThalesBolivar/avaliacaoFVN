import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import {
  LayoutDashboard, Users, UserCheck, ClipboardList, Calendar,
  FileText, BarChart2, Bell, Building2, ChevronRight,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  perfis: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard size={18} />,
    perfis: ['SUPER_ADMIN', 'ADMINISTRADOR', 'CHEFIA', 'SUBCOMISSAO', 'SERVIDOR'],
  },
  {
    label: 'Municípios',
    href: '/admin/municipios',
    icon: <Building2 size={18} />,
    perfis: ['SUPER_ADMIN'],
  },
  {
    label: 'Servidores',
    href: '/admin/servidores',
    icon: <Users size={18} />,
    perfis: ['SUPER_ADMIN', 'ADMINISTRADOR'],
  },
  {
    label: 'Usuários',
    href: '/admin/usuarios',
    icon: <UserCheck size={18} />,
    perfis: ['SUPER_ADMIN', 'ADMINISTRADOR'],
  },
  {
    label: 'Questionários',
    href: '/admin/questionarios',
    icon: <ClipboardList size={18} />,
    perfis: ['SUPER_ADMIN', 'ADMINISTRADOR'],
  },
  {
    label: 'Períodos',
    href: '/admin/periodos',
    icon: <Calendar size={18} />,
    perfis: ['SUPER_ADMIN', 'ADMINISTRADOR'],
  },
  {
    label: 'Minhas Avaliações',
    href: '/avaliacoes/minhas',
    icon: <FileText size={18} />,
    perfis: ['SUPER_ADMIN', 'ADMINISTRADOR', 'CHEFIA', 'SUBCOMISSAO', 'SERVIDOR'],
  },
  {
    label: 'Avaliações Pendentes',
    href: '/avaliacoes/pendentes',
    icon: <Bell size={18} />,
    perfis: ['CHEFIA', 'SUBCOMISSAO', 'SERVIDOR'],
  },
  {
    label: 'Logs de Auditoria',
    href: '/admin/logs',
    icon: <BarChart2 size={18} />,
    perfis: ['SUPER_ADMIN', 'ADMINISTRADOR'],
  },
]

interface SidebarProps {
  open: boolean
}

export default function Sidebar({ open }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuthStore()

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.perfis.includes(user.perfil)
  )

  return (
    <aside
      className={cn(
        'bg-slate-900 text-white flex flex-col transition-all duration-300',
        open ? 'w-60' : 'w-16'
      )}
    >
      <div className="flex items-center h-16 px-4 border-b border-slate-700">
        {open ? (
          <span className="font-bold text-sm leading-tight">
            Sistema de<br />Avaliação
          </span>
        ) : (
          <span className="font-bold text-lg">SA</span>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = location.pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              )}
            >
              {item.icon}
              {open && <span className="flex-1 truncate">{item.label}</span>}
              {open && active && <ChevronRight size={14} />}
            </Link>
          )
        })}
      </nav>

      {open && user && (
        <div className="border-t border-slate-700 p-4">
          <p className="text-xs text-slate-400 truncate">{user.nome}</p>
          <p className="text-xs text-slate-500 mt-0.5">{user.perfil.replace('_', ' ')}</p>
        </div>
      )}
    </aside>
  )
}
