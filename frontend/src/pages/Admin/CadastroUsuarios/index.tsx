import { useSearchParams } from 'react-router-dom'
import { Link2, ListChecks, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'
import FuncoesUsuarioPage from '@/pages/Admin/FuncoesUsuario'
import UsuariosPage from '@/pages/Admin/Usuarios'
import ServidorFuncoesPage from '@/pages/Admin/ServidorFuncoes'

type Etapa = 'funcoes' | 'usuarios' | 'vinculos'

const ETAPAS: { id: Etapa; numero: number; titulo: string; descricao: string; icon: React.ReactNode }[] = [
  {
    id: 'funcoes',
    numero: 1,
    titulo: 'Funções',
    descricao: 'Cadastre os tipos de função (Chefia, Comissão Técnica...)',
    icon: <ListChecks size={18} />,
  },
  {
    id: 'usuarios',
    numero: 2,
    titulo: 'Usuários',
    descricao: 'Crie usuários com login e senha para chefia e comissões',
    icon: <UserCog size={18} />,
  },
  {
    id: 'vinculos',
    numero: 3,
    titulo: 'Vínculos',
    descricao: 'Indique quais servidores compõem cada função',
    icon: <Link2 size={18} />,
  },
]

export default function CadastroUsuarios() {
  const [searchParams, setSearchParams] = useSearchParams()
  const etapaParam = searchParams.get('etapa') as Etapa | null
  const etapaAtiva: Etapa =
    etapaParam === 'usuarios' ? 'usuarios' : etapaParam === 'vinculos' ? 'vinculos' : 'funcoes'

  const selecionarEtapa = (etapa: Etapa) => {
    setSearchParams(etapa === 'funcoes' ? {} : { etapa }, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Administração</p>
        <h1 className="mt-2 text-3xl font-semibold">Cadastro de Usuários</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Siga as etapas: cadastre as funções, crie os usuários e por último vincule os servidores às suas funções na avaliação.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ETAPAS.map((etapa) => {
            const ativa = etapa.id === etapaAtiva
            return (
              <button
                key={etapa.id}
                onClick={() => selecionarEtapa(etapa.id)}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border p-4 text-left transition',
                  ativa
                    ? 'border-white/80 bg-white/15 shadow-sm'
                    : 'border-white/15 bg-white/5 hover:border-white/40 hover:bg-white/10'
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    ativa ? 'bg-white text-blue-700' : 'bg-white/15 text-white'
                  )}
                >
                  {etapa.numero}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {etapa.icon}
                    {etapa.titulo}
                  </span>
                  <span className="mt-1 block text-xs text-slate-200">{etapa.descricao}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {etapaAtiva === 'funcoes' && <FuncoesUsuarioPage />}
      {etapaAtiva === 'usuarios' && <UsuariosPage />}
      {etapaAtiva === 'vinculos' && <ServidorFuncoesPage />}
    </div>
  )
}
