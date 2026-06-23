import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionariosService } from '@/services/questionarios.service'
import type { Modelo } from '@/types'
import { Plus, Copy, Eye, Trash2, CheckCircle, Edit, Loader2, Archive, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { formatDateTime } from '@/utils/formatters'
import CategoriasManager from './CategoriasManager'

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'bg-yellow-100 text-yellow-800',
  PUBLICADO: 'bg-green-100 text-green-800',
  ARQUIVADO: 'bg-gray-100 text-gray-600',
}
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function Questionarios() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'RASCUNHO' | 'PUBLICADO' | 'ARQUIVADO'>('todos')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [confirmPublicar, setConfirmPublicar] = useState<Modelo | null>(null)

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ['questionarios'],
    queryFn: questionariosService.listarModelos,
  })

  const publicar = useMutation({
    mutationFn: (id: number) => questionariosService.publicarModelo(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questionarios'] }); setConfirmPublicar(null) },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Erro ao publicar o questionário.')
    },
  })

  const arquivar = useMutation({
    mutationFn: (id: number) => questionariosService.arquivarModelo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questionarios'] }),
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Erro ao arquivar o questionário.')
    },
  })

  const clonar = useMutation({
    mutationFn: (id: number) => questionariosService.clonarModelo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questionarios'] }),
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Erro ao clonar o questionário.')
    },
  })

  const deletar = useMutation({
    mutationFn: (id: number) => questionariosService.deletarModelo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questionarios'] }),
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Erro ao excluir o questionário.')
    },
  })

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase()
    return modelos.filter((m: Modelo) => {
      if (filterStatus !== 'todos' && m.status !== filterStatus) return false
      if (term && !m.nome.toLowerCase().includes(term)) return false
      return true
    })
  }, [modelos, search, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginados = filtrados.slice((page - 1) * pageSize, page * pageSize)

  const counts = {
    RASCUNHO: modelos.filter((m: Modelo) => m.status === 'RASCUNHO').length,
    PUBLICADO: modelos.filter((m: Modelo) => m.status === 'PUBLICADO').length,
    ARQUIVADO: modelos.filter((m: Modelo) => m.status === 'ARQUIVADO').length,
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-600" size={32} /></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Questionários</h1>
          <p className="text-gray-500 mt-1">Gerencie os modelos de avaliação do seu município</p>
        </div>
        <Link to="/admin/questionarios/novo"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Novo Questionário
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Rascunho', value: counts.RASCUNHO, color: 'text-yellow-600' },
          { label: 'Publicados', value: counts.PUBLICADO, color: 'text-green-600' },
          { label: 'Arquivados', value: counts.ARQUIVADO, color: 'text-gray-400' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <CategoriasManager />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Buscar por nome..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          {(['todos', 'RASCUNHO', 'PUBLICADO', 'ARQUIVADO'] as const).map(v => (
            <button key={v} onClick={() => { setFilterStatus(v); setCurrentPage(1) }}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterStatus === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              {v === 'todos' ? 'Todos' : v === 'RASCUNHO' ? 'Rascunho' : v === 'PUBLICADO' ? 'Publicados' : 'Arquivados'}
            </button>
          ))}
        </div>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
          className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} por página</option>)}
        </select>
      </div>

      {/* Lista */}
      {paginados.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          {modelos.length === 0 ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Plus size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-700">Nenhum questionário criado</h3>
              <p className="text-gray-500 mt-2 mb-6 text-sm">Crie o primeiro questionário de avaliação</p>
              <Link to="/admin/questionarios/novo" className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium">
                <Plus size={16} /> Criar Questionário
              </Link>
            </>
          ) : (
            <p className="text-gray-400">Nenhum questionário encontrado para os filtros</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {paginados.map((modelo: Modelo) => (
            <div key={modelo.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800">{modelo.nome}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[modelo.status]}`}>{modelo.status}</span>
                    <span className="text-xs text-gray-400">v{modelo.versao}</span>
                  </div>
                  {modelo.descricao && <p className="text-sm text-gray-500 mt-1 truncate">{modelo.descricao}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{modelo.total_perguntas} perguntas</span>
                    {modelo.pontuacao_maxima && <span>Pontuação máx: {modelo.pontuacao_maxima}</span>}
                    <span>Criado em {formatDateTime(modelo.criado_em)}</span>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap text-xs">
                    {modelo.para_autoavaliacao && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Autoavaliação</span>}
                    {(modelo.funcoes_vinculadas && modelo.funcoes_vinculadas.length > 0)
                      ? modelo.funcoes_vinculadas.map(fv => (
                          <span key={fv.id} className={fv.perfil_base === 'CHEFIA' ? 'bg-purple-50 text-purple-700 px-2 py-0.5 rounded' : 'bg-orange-50 text-orange-700 px-2 py-0.5 rounded'}>
                            {fv.nome}
                          </span>
                        ))
                      : (
                        <>
                          {modelo.para_superior_imediato && <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded">Superior</span>}
                          {modelo.para_subcomissao && <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded">Subcomissão</span>}
                        </>
                      )
                    }
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link to={`/admin/questionarios/${modelo.id}/preview`} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600" title="Preview"><Eye size={16} /></Link>
                  {modelo.status === 'RASCUNHO' && (
                    <>
                      <Link to={`/admin/questionarios/${modelo.id}/editar`} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600" title="Editar"><Edit size={16} /></Link>
                      <button onClick={() => setConfirmPublicar(modelo)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-600" title="Publicar"><CheckCircle size={16} /></button>
                      <button onClick={() => { if (confirm('Excluir este questionário?')) deletar.mutate(modelo.id) }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-500" title="Excluir"><Trash2 size={16} /></button>
                    </>
                  )}
                  {modelo.status === 'PUBLICADO' && (
                    <button onClick={() => { if (confirm(`Arquivar "${modelo.nome}"?\n\nIsso encerrará as avaliações e cancelará todos os formulários ainda pendentes.`)) arquivar.mutate(modelo.id) }}
                      disabled={arquivar.isPending} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-orange-600" title="Arquivar">
                      <Archive size={16} />
                    </button>
                  )}
                  <button onClick={() => clonar.mutate(modelo.id)} disabled={clonar.isPending} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600" title="Clonar">
                    {clonar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Paginação */}
          {filtrados.length > 0 && (
            <div className="flex items-center justify-between px-1 py-2 text-sm text-gray-600">
              <span>{filtrados.length} questionário{filtrados.length !== 1 ? 's' : ''}</span>
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
      )}

      {/* Modal publicar */}
      {confirmPublicar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800">Publicar Questionário</h3>
            <p className="text-gray-600 mt-2 text-sm">Tem certeza que deseja publicar <strong>{confirmPublicar.nome}</strong>?</p>
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 space-y-1">
              <p>✓ As avaliações serão <strong>geradas automaticamente</strong> para todos os servidores com cargo vinculado.</p>
              <p>✓ Após publicado, o questionário não poderá mais ser editado.</p>
              <p>✓ Para encerrar, use o botão <strong>Arquivar</strong>.</p>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setConfirmPublicar(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={() => publicar.mutate(confirmPublicar.id)} disabled={publicar.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
                {publicar.isPending && <Loader2 size={14} className="animate-spin" />}
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
