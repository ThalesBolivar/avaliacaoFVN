import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { avaliacoesService } from '@/services/avaliacoes.service'
import type { FormularioResumo } from '@/types'
import { Inbox, Loader2, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { formatDateTime, TIPO_AVALIACAO_LABELS, STATUS_LABELS } from '@/utils/formatters'

const TIPO_COLOR: Record<string, string> = {
  AUTOAVALIACAO: 'bg-blue-50 text-blue-700',
  SUPERIOR_IMEDIATO: 'bg-purple-50 text-purple-700',
  SUBCOMISSAO: 'bg-orange-50 text-orange-700',
}
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function AvaliacoesRecebidas() {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'finalizada' | 'pendente'>('todos')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ['avaliacoes-recebidas'],
    queryFn: avaliacoesService.recebidas,
  })

  const pendentes = useMemo(() => avaliacoes.filter(a => a.status !== 'FINALIZADA'), [avaliacoes])

  const filtradas = useMemo(() => {
    const term = search.trim().toLowerCase()
    return avaliacoes.filter((a: FormularioResumo) => {
      if (filterStatus === 'finalizada' && a.status !== 'FINALIZADA') return false
      if (filterStatus === 'pendente' && a.status === 'FINALIZADA') return false
      if (term && !(TIPO_AVALIACAO_LABELS[a.tipo_avaliacao] || a.tipo_avaliacao).toLowerCase().includes(term)) return false
      return true
    })
  }, [avaliacoes, search, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginadas = filtradas.slice((page - 1) * pageSize, page * pageSize)

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Avaliações Recebidas</h1>
        <p className="text-gray-500 mt-1">Todas as avaliações realizadas sobre você — autoavaliação, chefia e subcomissão</p>
      </div>

      {avaliacoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Inbox size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700">Nenhuma avaliação recebida ainda</h3>
          <p className="text-gray-500 mt-2 text-sm">As avaliações aparecerão aqui quando um período estiver ativo e os formulários forem preenchidos.</p>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-800 text-sm font-medium">{pendentes.length} avaliação(ões) ainda não foram concluídas pelos avaliadores.</p>
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Buscar por tipo..."
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              {(['todos', 'finalizada', 'pendente'] as const).map(v => (
                <button key={v} onClick={() => { setFilterStatus(v); setCurrentPage(1) }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterStatus === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {v === 'todos' ? 'Todas' : v === 'finalizada' ? 'Finalizadas' : 'Pendentes'}
                </button>
              ))}
            </div>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} por página</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Tipo</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Pontuação</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Finalizado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginadas.map((a: FormularioResumo) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${TIPO_COLOR[a.tipo_avaliacao] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TIPO_AVALIACAO_LABELS[a.tipo_avaliacao] ?? a.tipo_avaliacao}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        a.status === 'FINALIZADA' ? 'bg-green-100 text-green-700' :
                        a.status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{STATUS_LABELS[a.status]}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{a.pontuacao_total != null ? a.pontuacao_total.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">{a.finalizado_em ? formatDateTime(a.finalizado_em) : '—'}</td>
                  </tr>
                ))}
                {paginadas.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhuma avaliação encontrada para os filtros</td></tr>
                )}
              </tbody>
            </table>

            {filtradas.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
                <span>{filtradas.length} registro{filtradas.length !== 1 ? 's' : ''}</span>
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
        </>
      )}
    </div>
  )
}
