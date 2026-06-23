import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import api from '@/services/api'
import type {
  DashboardAdmin,
  DashboardServidor,
  DashboardFuncoesProgresso,
  FuncaoProgresso,
  MembroSubcomissao,
  StatusGeralFuncao,
} from '@/types'
import {
  Users,
  ClipboardList,
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  X,
  Building2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────

function statusLabel(s: StatusGeralFuncao) {
  if (s === 'CONCLUIDO') return 'Concluído'
  if (s === 'EM_ANDAMENTO') return 'Em Andamento'
  return 'Pendente'
}

function statusColor(s: StatusGeralFuncao) {
  if (s === 'CONCLUIDO') return 'bg-green-100 text-green-700'
  if (s === 'EM_ANDAMENTO') return 'bg-blue-100 text-blue-700'
  return 'bg-yellow-100 text-yellow-700'
}

function progressColor(pct: number) {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 40) return 'bg-blue-500'
  return 'bg-yellow-500'
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full transition-all ${progressColor(pct)}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

function FuncaoCard({
  funcao,
  onVerMembros,
}: {
  funcao: FuncaoProgresso
  onVerMembros: (f: FuncaoProgresso) => void
}) {
  const pct = funcao.percentual_conclusao

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-800">{funcao.nome}</h3>
          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${statusColor(funcao.status_geral)}`}>
            {statusLabel(funcao.status_geral)}
          </span>
        </div>
        {funcao.membros.length > 0 && (
          <button
            onClick={() => onVerMembros(funcao)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg px-2 py-1 transition-colors shrink-0"
            title="Ver composição"
          >
            <Eye size={14} />
            Ver membros
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-lg font-bold text-gray-800">{funcao.total_servidores}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2">
          <p className="text-xs text-green-600">Realizadas</p>
          <p className="text-lg font-bold text-green-700">{funcao.realizadas}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2">
          <p className="text-xs text-yellow-600">Pendentes</p>
          <p className="text-lg font-bold text-yellow-700">{funcao.pendentes}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Conclusão</span>
          <span className="font-semibold text-gray-700">{pct}%</span>
        </div>
        <ProgressBar pct={pct} />
      </div>
    </div>
  )
}

function MembrosModal({
  funcao,
  onClose,
}: {
  funcao: FuncaoProgresso
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">{funcao.nome}</h2>
            <p className="text-sm text-gray-500">
              {funcao.membros.length} membro{funcao.membros.length !== 1 ? 's' : ''} vinculado
              {funcao.membros.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-3">
          {funcao.membros.map((m: MembroSubcomissao) => (
            <div key={m.servidor_id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-blue-700 font-bold text-sm">
                  {m.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{m.nome}</p>
                {m.cargo && <p className="text-xs text-gray-500">{m.cargo}</p>}
                {m.lotacao && <p className="text-xs text-gray-400">{m.lotacao}</p>}
                <p className="text-xs text-blue-600 mt-0.5">Matrícula: {m.matricula}</p>
              </div>
            </div>
          ))}

          {funcao.membros.length === 0 && (
            <p className="text-center text-gray-400 py-8">Nenhum membro vinculado</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Dashboard Admin ───────────────────────────────────────────

function DashboardAdmin({
  adminData,
  isSuperAdmin,
}: {
  adminData: DashboardAdmin
  isSuperAdmin: boolean
}) {
  const [modalFuncao, setModalFuncao] = useState<FuncaoProgresso | null>(null)

  const { data: funcoesData, isLoading: loadingFuncoes } = useQuery<DashboardFuncoesProgresso>({
    queryKey: ['dashboard-funcoes-progresso'],
    queryFn: async () => {
      const res = await api.get<DashboardFuncoesProgresso>('/dashboard/admin/funcoes-progresso')
      return res.data
    },
    refetchInterval: 60000,
  })

  const funcoesFiltradas = funcoesData?.funcoes ?? []

  // Cálculos globais
  const totalServidores = adminData.total_servidores
  const totalRealizadas = adminData.avaliacoes.finalizadas
  const totalPendentes = adminData.avaliacoes.pendentes + adminData.avaliacoes.em_andamento
  const pctGeral = adminData.percentual_concluido

  // Dados dos gráficos
  const barData = funcoesFiltradas.map((f) => ({
    name: f.nome.replace('Subcomissão ', 'Sub. '),
    Realizadas: f.realizadas,
    Pendentes: f.pendentes,
    'Em Andamento': f.em_andamento,
  }))

  const pieData = [
    { name: 'Realizadas', value: totalRealizadas, color: '#10b981' },
    { name: 'Pendentes', value: totalPendentes, color: '#f59e0b' },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        {isSuperAdmin && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-indigo-600" />
            <p className="font-semibold text-indigo-800 text-sm">Visão Global da Plataforma</p>
          </div>
        )}

        {/* Cards de resumo */}
        <div className={`grid grid-cols-2 ${isSuperAdmin ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-4`}>
          {isSuperAdmin && (
            <StatCard
              title="Municípios"
              value={adminData.total_municipios || 0}
              icon={<Building2 size={20} className="text-indigo-600" />}
              color="bg-indigo-50"
            />
          )}
          <StatCard
            title="Total de Servidores"
            value={totalServidores}
            icon={<Users size={20} className="text-blue-600" />}
            color="bg-blue-50"
          />
          <StatCard
            title="Avaliações Realizadas"
            value={totalRealizadas}
            icon={<CheckCircle size={20} className="text-green-600" />}
            color="bg-green-50"
          />
          <StatCard
            title="Avaliações Pendentes"
            value={totalPendentes}
            icon={<Clock size={20} className="text-yellow-600" />}
            color="bg-yellow-50"
          />
          <StatCard
            title="Conclusão Geral"
            value={`${pctGeral}%`}
            icon={<TrendingUp size={20} className="text-purple-600" />}
            color="bg-purple-50"
          />
        </div>
      </div>

      {/* Cards por Função/Comissão */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Progresso por Função / Cargo
          {funcoesData?.periodo_nome && (
            <span className="text-gray-400 font-normal text-sm ml-2">
              — {funcoesData.periodo_nome}
            </span>
          )}
        </h2>

        {loadingFuncoes ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : funcoesFiltradas.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">
              {funcoesData?.periodo_id ? 'Nenhuma avaliação encontrada para os filtros selecionados.' : 'Nenhum período ativo encontrado.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {funcoesFiltradas.map((f) => (
              <FuncaoCard key={f.id} funcao={f} onVerMembros={setModalFuncao} />
            ))}
          </div>
        )}
      </div>

      {/* Gráficos */}
      {funcoesFiltradas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Gráfico de barras */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">
              Realizadas × Pendentes por Função
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Realizadas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Em Andamento" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pendentes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de pizza */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">Conclusão Geral</h2>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                Sem dados
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de membros */}
      {modalFuncao && (
        <MembrosModal funcao={modalFuncao} onClose={() => setModalFuncao(null)} />
      )}
    </div>
  )
}

// ── Dashboard Servidor ────────────────────────────────────────

function DashboardServidor({ data }: { data: DashboardServidor }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        title="Total de Avaliações"
        value={data.total_avaliacoes || 0}
        icon={<ClipboardList size={20} className="text-blue-600" />}
        color="bg-blue-50"
      />
      <StatCard
        title="Pendentes"
        value={data.pendentes || 0}
        icon={<AlertCircle size={20} className="text-yellow-600" />}
        color="bg-yellow-50"
      />
      <StatCard
        title="Finalizadas"
        value={data.finalizadas || 0}
        icon={<CheckCircle size={20} className="text-green-600" />}
        color="bg-green-50"
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore()
  const isAdmin = user?.perfil === 'SUPER_ADMIN' || user?.perfil === 'ADMINISTRADOR'
  const isSuperAdmin = user?.perfil === 'SUPER_ADMIN'

  const { data } = useQuery<DashboardAdmin | DashboardServidor>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const endpoint = isAdmin ? '/dashboard/admin' : '/dashboard/servidor'
      const response = await api.get<DashboardAdmin | DashboardServidor>(endpoint)
      return response.data
    },
    refetchInterval: 60000,
  })

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Bem-vindo, {user?.nome}</p>
      </div>

      {isAdmin ? (
        <DashboardAdmin
          adminData={data as DashboardAdmin}
          isSuperAdmin={isSuperAdmin}
        />
      ) : (
        <DashboardServidor data={data as DashboardServidor} />
      )}
    </div>
  )
}
