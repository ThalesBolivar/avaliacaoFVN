import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Building2, Loader2, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import type { Lotacao, LotacaoPayload } from '@/types'
import { lotacoesService } from '@/services/lotacoes.service'
import { useAuthStore } from '@/store/auth.store'

const EMPTY: LotacaoPayload = { nome: '', descricao: '', ordem: 0, ativo: true }
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function Lotacoes() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Lotacao | null>(null)
  const [form, setForm] = useState<LotacaoPayload>(EMPTY)
  const [erro, setErro] = useState('')

  const { data: lotacoes = [], isLoading } = useQuery<Lotacao[]>({
    queryKey: ['lotacoes'],
    queryFn: () => lotacoesService.listar(),
  })

  const criar = useMutation({
    mutationFn: (data: LotacaoPayload) => lotacoesService.criar(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lotacoes'] }); fechar() },
    onError: (e: any) => setErro(e?.response?.data?.detail || 'Erro ao salvar'),
  })

  const atualizar = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LotacaoPayload> }) =>
      lotacoesService.atualizar(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lotacoes'] }); fechar() },
    onError: (e: any) => setErro(e?.response?.data?.detail || 'Erro ao salvar'),
  })

  const excluir = useMutation({
    mutationFn: (id: number) => lotacoesService.excluir(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lotacoes'] }),
    onError: (e: any) => alert(e?.response?.data?.detail || 'Erro ao excluir'),
  })

  function abrirNovo() {
    setEditing(null); setForm(EMPTY); setErro(''); setShowModal(true)
  }

  function abrirEdicao(l: Lotacao) {
    setEditing(l)
    setForm({ nome: l.nome, descricao: l.descricao ?? '', ordem: l.ordem, ativo: l.ativo })
    setErro(''); setShowModal(true)
  }

  function fechar() { setShowModal(false); setEditing(null); setErro('') }

  function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    const payload: LotacaoPayload = { ...form, nome: form.nome.trim() }
    if (editing) atualizar.mutate({ id: editing.id, data: payload })
    else criar.mutate(payload)
  }

  const filtradas = useMemo(() => {
    const term = search.trim().toLowerCase()
    return lotacoes.filter(l => {
      if (filterStatus === 'ativo' && !l.ativo) return false
      if (filterStatus === 'inativo' && l.ativo) return false
      if (term && !l.nome.toLowerCase().includes(term) && !(l.descricao || '').toLowerCase().includes(term)) return false
      return true
    })
  }, [lotacoes, search, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginadas = filtradas.slice((page - 1) * pageSize, page * pageSize)

  function mudarFiltro(v: typeof filterStatus) { setFilterStatus(v); setCurrentPage(1) }
  function mudarBusca(v: string) { setSearch(v); setCurrentPage(1) }

  const total = lotacoes.length
  const ativos = lotacoes.filter(l => l.ativo).length
  const canEdit = user?.perfil === 'SUPER_ADMIN' || user?.perfil === 'ADMINISTRADOR'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Lotações</h1>
          <p className="text-gray-500 mt-1">Gerencie as lotações (setores/departamentos) do município</p>
        </div>
        {canEdit && (
          <button onClick={abrirNovo} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> Nova Lotação
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: total, color: 'text-blue-600' },
          { label: 'Ativas', value: ativos, color: 'text-green-600' },
          { label: 'Inativas', value: total - ativos, color: 'text-gray-400' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => mudarBusca(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['todos', 'ativo', 'inativo'] as const).map(v => (
            <button
              key={v}
              onClick={() => mudarFiltro(v)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterStatus === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >
              {v === 'todos' ? 'Todos' : v === 'ativo' ? 'Ativas' : 'Inativas'}
            </button>
          ))}
        </div>
        <select
          value={pageSize}
          onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
          className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} por página</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : paginadas.length === 0 ? (
          <div className="text-center p-12 text-gray-400">Nenhuma lotação encontrada</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Descrição</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                {canEdit && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginadas.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-gray-400 shrink-0" />
                      {l.nome}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{l.descricao || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${l.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {l.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => abrirEdicao(l)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Excluir lotação "${l.nome}"?`)) excluir.mutate(l.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginação */}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {editing ? 'Editar Lotação' : 'Nova Lotação'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nome *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Secretaria de Saúde"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Descrição</label>
                <textarea
                  value={form.descricao ?? ''}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  rows={2}
                  placeholder="Descrição opcional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo ?? true}
                  onChange={e => setForm({ ...form, ativo: e.target.checked })}
                  className="rounded"
                />
                Ativa
              </label>
            </div>
            {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={fechar} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">Cancelar</button>
              <button
                onClick={salvar}
                disabled={criar.isPending || atualizar.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {(criar.isPending || atualizar.isPending) && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
