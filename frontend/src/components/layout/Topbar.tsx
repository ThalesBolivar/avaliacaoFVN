import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, LogOut, User, CheckCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotificacoes } from '@/hooks/useNotificacoes'
import { useAuthStore } from '@/store/auth.store'
import { formatDateTime } from '@/utils/formatters'

interface TopbarProps {
  onMenuClick: () => void
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { user } = useAuthStore()
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotificacoes()
  const [showNotificacoes, setShowNotificacoes] = useState(false)

  const recentes = notificacoes.slice(0, 8)

  function abrirNotificacao(id: number, rota?: string) {
    marcarLida.mutate(id)
    setShowNotificacoes(false)
    if (rota) {
      navigate(rota)
    }
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Menu size={20} className="text-gray-600" />
      </button>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowNotificacoes((current) => !current)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Bell size={20} className="text-gray-600" />
            {naoLidas > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            )}
          </button>

          {showNotificacoes && (
            <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Notificações</p>
                  <p className="text-xs text-gray-500">{naoLidas} não lida(s)</p>
                </div>
                {naoLidas > 0 && (
                  <button
                    onClick={() => marcarTodasLidas.mutate()}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <CheckCheck size={14} />
                    Marcar todas
                  </button>
                )}
              </div>

              {recentes.length === 0 ? (
                <div className="px-4 py-8 text-sm text-center text-gray-400">
                  Nenhuma notificação recente
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {recentes.map((notificacao) => {
                    const rota = typeof notificacao.dados_extras?.rota === 'string'
                      ? notificacao.dados_extras.rota
                      : undefined

                    return (
                      <button
                        key={notificacao.id}
                        onClick={() => abrirNotificacao(notificacao.id, rota)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          notificacao.lida ? 'bg-white' : 'bg-blue-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800">{notificacao.titulo}</p>
                            <p className="text-sm text-gray-600 mt-1">{notificacao.mensagem}</p>
                            <p className="text-xs text-gray-400 mt-2">
                              {formatDateTime(notificacao.criado_em)}
                            </p>
                          </div>
                          {!notificacao.lida && (
                            <span className="mt-1 w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={16} className="text-blue-600" />
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">
            {user?.nome}
          </span>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-red-500"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
