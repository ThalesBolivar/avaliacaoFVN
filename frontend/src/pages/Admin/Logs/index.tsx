import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import { municipiosService } from '@/services/municipios.service'
import { useAuthStore } from '@/store/auth.store'
import type { Municipio } from '@/types'
import { formatDateTime } from '@/utils/formatters'
import { Loader2, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

interface Log {
  id: number
  municipio_id: number
  nome_usuario?: string
  perfil_usuario?: string
  acao: string
  entidade: string
  entidade_id?: string
  descricao?: string
  endereco_ip?: string
  criado_em: string
}

const ACAO_CORES: Record<string, string> = {
  LOGIN_REALIZADO: 'bg-green-100 text-green-800',
  LOGIN_INVALIDO: 'bg-red-100 text-red-800',
  LOGOUT_REALIZADO: 'bg-gray-100 text-gray-600',
  USUARIO_CRIADO: 'bg-blue-100 text-blue-800',
  QUESTIONARIO_PUBLICADO: 'bg-purple-100 text-purple-800',
  AVALIACAO_FINALIZADA: 'bg-green-100 text-green-800',
  PERIODO_ATIVADO: 'bg-orange-100 text-orange-800',
  PERIODO_ENCERRADO: 'bg-gray-100 text-gray-700',
}
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function Logs() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.perfil === 'SUPER_ADMIN'

  const [selectedMunicipioId, setSelectedMunicipioId] = useState('')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const { data: municipios = [] } = useQuery<Municipio[]>({
    queryKey: ['municipios-admin-logs'],
    queryFn: municipiosService.listarAdmin,
    enabled: isSuperAdmin,
  })

  const { data: logs = [], isLoading } = useQuery<Log[]>({
    queryKey: ['logs', selectedMunicipioId],
    queryFn: async () => {
      const query = isSuperAdmin && selectedMunicipioId ? `?municipio_id=${selectedMunicipioId}` : ''
      return (await api.get(`/logs${query}`)).data
    },
  })

  const getMunicipioNome = (municipioId: number) =>
    municipios.find(m => m.id === municipioId)?.nome || `Município #${municipioId}`

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return logs
    return logs.filter(l =>
      [l.nome_usuario, l.acao, l.entidade, l.descricao, l.endereco_ip]
        .join(' ').toLowerCase().includes(term)
    )
  }, [logs, search])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginados = filtrados.slice((page - 1) * pageSize, page * pageSize)

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Logs de Auditoria</h1>
        <p className="text-gray-500 mt-1">Histórico de todas as ações no sistema</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Buscar por usuário, ação, entidade ou IP..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {isSuperAdmin && (
          <select value={selectedMunicipioId} onChange={e => { setSelectedMunicipioId(e.target.value); setCurrentPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos os municípios</option>
            {municipios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        )}
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
          className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} por página</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Data/Hora</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Usuário</th>
              {isSuperAdmin && <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Município</th>}
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Ação</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Entidade</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Descrição</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden xl:table-cell">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginados.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.criado_em)}</td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{log.nome_usuario || '—'}</p>
                    {log.perfil_usuario && <p className="text-xs text-gray-400">{log.perfil_usuario.replace('_', ' ')}</p>}
                  </div>
                </td>
                {isSuperAdmin && <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{getMunicipioNome(log.municipio_id)}</td>}
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACAO_CORES[log.acao] || 'bg-gray-100 text-gray-600'}`}>
                    {log.acao.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{log.entidade}{log.entidade_id ? ` #${log.entidade_id}` : ''}</td>
                <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell max-w-xs truncate">{log.descricao || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-400 font-mono hidden xl:table-cell">{log.endereco_ip || '—'}</td>
              </tr>
            ))}
            {paginados.length === 0 && (
              <tr><td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum log encontrado</td></tr>
            )}
          </tbody>
        </table>

        {filtrados.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>{filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={page === 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronsLeft size={15} /></button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronLeft size={15} /></button>
              <span className="px-3">Página {page} de {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronRight size={15} /></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={page === totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronsRight size={15} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
