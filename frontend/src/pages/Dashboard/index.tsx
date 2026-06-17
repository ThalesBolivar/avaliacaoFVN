import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import api from '@/services/api'
import type { DashboardAdmin, DashboardServidor } from '@/types'
import { Users, ClipboardList, Calendar, TrendingUp, CheckCircle, AlertCircle, Building2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function StatCard({ title, value, icon, color }: { title: string; value: number | string; icon: React.ReactNode; color: string }) {
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

  const adminData = isAdmin ? data as DashboardAdmin : null
  const servidorData = !isAdmin ? data as DashboardServidor : null

  const chartData = adminData ? [
    { name: 'Pendentes', value: adminData.avaliacoes.pendentes, color: '#f59e0b' },
    { name: 'Em Andamento', value: adminData.avaliacoes.em_andamento, color: '#3b82f6' },
    { name: 'Finalizadas', value: adminData.avaliacoes.finalizadas, color: '#10b981' },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Bem-vindo, {user?.nome}</p>
      </div>

      {adminData && (
        <>
          {isSuperAdmin && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={18} className="text-indigo-600" />
                <p className="font-semibold text-indigo-800">Visão Global da Plataforma</p>
              </div>
              <p className="text-indigo-700 text-sm">
                Os indicadores abaixo consolidam todos os municípios cadastrados.
              </p>
            </div>
          )}

          <div className={`grid grid-cols-1 sm:grid-cols-2 ${isSuperAdmin ? 'xl:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
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
              value={adminData.total_servidores}
              icon={<Users size={20} className="text-blue-600" />}
              color="bg-blue-50"
            />
            <StatCard
              title="Questionários Publicados"
              value={adminData.modelos_publicados}
              icon={<ClipboardList size={20} className="text-purple-600" />}
              color="bg-purple-50"
            />
            <StatCard
              title={isSuperAdmin ? 'Períodos Ativos' : 'Total de Períodos'}
              value={isSuperAdmin ? adminData.total_periodos_ativos || 0 : adminData.total_periodos}
              icon={<Calendar size={20} className="text-orange-600" />}
              color="bg-orange-50"
            />
            <StatCard
              title="Conclusão"
              value={`${adminData.percentual_concluido}%`}
              icon={<TrendingUp size={20} className="text-green-600" />}
              color="bg-green-50"
            />
          </div>

          {adminData.periodo_ativo && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={18} className="text-blue-600" />
                <p className="font-semibold text-blue-800">
                  {isSuperAdmin ? 'Um Período Ativo Encontrado' : 'Período Ativo'}
                </p>
              </div>
              <p className="text-blue-700 text-lg font-bold">{adminData.periodo_ativo?.nome}</p>
              <p className="text-blue-600 text-sm">
                {adminData.periodo_ativo?.data_inicio} até {adminData.periodo_ativo?.data_fim}
              </p>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Avaliações por Status</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {servidorData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total de Avaliações"
            value={servidorData.total_avaliacoes || 0}
            icon={<ClipboardList size={20} className="text-blue-600" />}
            color="bg-blue-50"
          />
          <StatCard
            title="Pendentes"
            value={servidorData.pendentes || 0}
            icon={<AlertCircle size={20} className="text-yellow-600" />}
            color="bg-yellow-50"
          />
          <StatCard
            title="Finalizadas"
            value={servidorData.finalizadas || 0}
            icon={<CheckCircle size={20} className="text-green-600" />}
            color="bg-green-50"
          />
        </div>
      )}
    </div>
  )
}
