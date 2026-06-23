import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import api from '@/services/api'

interface Membro {
  id: number
  nome: string
  matricula: string
  cargo: string
}

interface SubcomissaoInfo {
  funcao_nome: string
  membros: Membro[]
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function MinhaSubcomissao() {
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const { data, isLoading } = useQuery<SubcomissaoInfo>({
    queryKey: ['minha-subcomissao'],
    queryFn: () => api.get('/avaliacoes/minha-subcomissao').then(r => r.data),
  })

  const membros = data?.membros ?? []

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return membros
    return membros.filter(m =>
      m.nome.toLowerCase().includes(term) ||
      m.matricula.toLowerCase().includes(term) ||
      (m.cargo || '').toLowerCase().includes(term)
    )
  }, [membros, search])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginados = filtrados.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Minha Subcomissão</h1>
        {data?.funcao_nome && <p className="mt-1 text-sm text-slate-500">{data.funcao_nome}</p>}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>
      ) : membros.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
          <Users size={32} className="opacity-30" />
          <p className="text-sm">Nenhum membro vinculado a esta subcomissão.</p>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Buscar por nome, matrícula ou cargo..."
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} por página</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Nome</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Matrícula</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Cargo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginados.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{m.nome}</td>
                    <td className="px-5 py-3 text-slate-500 font-mono">{m.matricula}</td>
                    <td className="px-5 py-3 text-slate-500">{m.cargo}</td>
                  </tr>
                ))}
                {paginados.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400">Nenhum membro encontrado para a busca</td></tr>
                )}
              </tbody>
            </table>

            {filtrados.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
                <span>{filtrados.length} membro{filtrados.length !== 1 ? 's' : ''}</span>
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
