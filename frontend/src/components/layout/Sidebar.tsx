import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import {
  BarChart2,
  Bell,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  UserCheck,
  Users,
  UsersRound,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  perfis: string[]
  children?: NavChild[]
}

interface NavChild {
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
    children: [
      {
        label: 'Lista de Servidores',
        href: '/admin/servidores',
        icon: <Users size={16} />,
        perfis: ['SUPER_ADMIN', 'ADMINISTRADOR'],
      },
      {
        label: 'Níveis de Cargo',
        href: '/admin/niveis-cargo',
        icon: <GraduationCap size={16} />,
        perfis: ['SUPER_ADMIN', 'ADMINISTRADOR'],
      },
      {
        label: 'Cargos',
        href: '/admin/cargos',
        icon: <Briefcase size={16} />,
        perfis: ['SUPER_ADMIN', 'ADMINISTRADOR'],
      },
      {
        label: 'Lotações',
        href: '/admin/lotacoes',
        icon: <Building2 size={16} />,
        perfis: ['SUPER_ADMIN', 'ADMINISTRADOR'],
      },
    ],
  },
  {
    label: 'Cadastro de Usuários',
    href: '/admin/cadastro-usuarios',
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
    label: 'Minha Subcomissão',
    href: '/avaliacoes/subcomissao',
    icon: <UsersRound size={18} />,
    perfis: ['SUBCOMISSAO'],
  },
  {
    label: 'Avaliações Pendentes',
    href: '/avaliacoes/pendentes',
    icon: <Bell size={18} />,
    perfis: ['CHEFIA', 'SUBCOMISSAO', 'SERVIDOR'],
  },
  {
    label: 'Avaliações Recebidas',
    href: '/avaliacoes/recebidas',
    icon: <Inbox size={18} />,
    perfis: ['CHEFIA', 'SUBCOMISSAO', 'SERVIDOR'],
  },
  {
    label: 'Avaliações Realizadas',
    href: '/avaliacoes/minhas',
    icon: <FileText size={18} />,
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

  // Grupos expandidos: inicia aberto o grupo cuja rota (ou de algum filho) está ativa.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const isChildActive = (item: NavItem) =>
    item.children?.some((c) => location.pathname.startsWith(c.href)) ?? false

  const toggle = (href: string) =>
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }))

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
            Sistema de
            <br />
            Avaliação
          </span>
        ) : (
          <span className="font-bold text-lg">SA</span>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {visibleItems.map((item) => {
          const children = item.children?.filter(
            (c) => user && c.perfis.includes(user.perfil)
          )

          // Item com submenu (ex.: Servidores -> Cargos)
          if (children && children.length > 0) {
            const childActive = isChildActive(item)
            const isOpen = expanded[item.href] ?? childActive

            return (
              <div key={item.href}>
                <button
                  type="button"
                  onClick={() => toggle(item.href)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    childActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  )}
                >
                  {item.icon}
                  {open && <span className="flex-1 truncate text-left">{item.label}</span>}
                  {open &&
                    (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                </button>

                {open && isOpen && (
                  <div className="mt-1 space-y-1 pl-4">
                    {children.map((child) => {
                      const active =
                        location.pathname === child.href ||
                        location.pathname.startsWith(child.href + '/')
                      return (
                        <Link
                          key={child.href}
                          to={child.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                            active
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                          )}
                        >
                          {child.icon}
                          <span className="flex-1 truncate">{child.label}</span>
                          {active && <ChevronRight size={14} />}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          // Item simples
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
