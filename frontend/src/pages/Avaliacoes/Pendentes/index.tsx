import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { avaliacoesService } from '@/services/avaliacoes.service'
import type { FormularioResumo } from '@/types'
import { ClipboardList, Clock, ArrowRight, Loader2, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { TIPO_AVALIACAO_LABELS } from '@/utils/formatters'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function AvaliacoesPendentes() {
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ['avaliacoes-pendentes'],
    queryFn: avaliacoesService.pendentes,
  })

  const filtradas = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return avaliacoes
    return avaliacoes.filter((a: FormularioResumo) =>
      (a.nome_servidor || `Servidor #${a.servidor_avaliado_id}`).toLowerCase().includes(term) ||
      (TIPO_AVALIACAO_LABELS[a.tipo_avaliacao] || '').toLowerCase().includes(term)
    )
  }, [avaliacoes, search])

  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginadas = filtradas.slice((page - 1) * pageSize, page * pageSize)

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Avaliações Pendentes</h1>
        <p className="text-gray-500 mt-1">{avaliacoes.length} avaliações aguardando seu preenchimento</p>
      </div>

      {avaliacoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 rounded-full mb-4">
            <ClipboardList size={28} className="text-green-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-700">Tudo em dia!</h3>
          <p className="text-gray-500 mt-2 text-sm">Não há avaliações pendentes no momento.</p>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Buscar por servidor ou tipo..."
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} por página</option>)}
            </select>
          </div>

          <div className="grid gap-4">
            {paginadas.map((a: FormularioResumo) => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                    <ClipboardList size={20} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{a.nome_servidor || `Servidor #${a.servidor_avaliado_id}`}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{TIPO_AVALIACAO_LABELS[a.tipo_avaliacao]}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={12} className="text-yellow-500" />
                      <span className="text-xs text-yellow-600">{a.status === 'PENDENTE' ? 'Não iniciada' : 'Em andamento'}</span>
                    </div>
                  </div>
                </div>
                <Link to={`/avaliacoes/${a.id}/preencher`} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0">
                  {a.status === 'PENDENTE' ? 'Iniciar' : 'Continuar'}
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}

            {paginadas.length === 0 && (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
                Nenhuma avaliação encontrada para a busca
              </div>
            )}

            {filtradas.length > 0 && (
              <div className="flex items-center justify-between px-1 py-2 text-sm text-gray-600">
                <span>{filtradas.length} pendente{filtradas.length !== 1 ? 's' : ''}</span>
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
