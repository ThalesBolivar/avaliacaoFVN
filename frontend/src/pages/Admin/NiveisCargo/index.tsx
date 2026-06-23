import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, GraduationCap, Loader2, Plus, Save, Search, Trash2, X, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { niveisCargosService } from '@/services/niveis-cargo.service'
import { useAuthStore } from '@/store/auth.store'
import type { NivelCargoItem } from '@/types'

interface FormState {
  id?: number
  nome: string
  label: string
  descricao: string
  ordem: string
  ativo: boolean
}

const EMPTY_FORM: FormState = { nome: '', label: '', descricao: '', ordem: '0', ativo: true }
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function getErro(error: unknown, fallback: string) {
  return (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback
}

export default function NiveisCargo() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.perfil === 'SUPER_ADMIN'

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState('')

  const { data: niveis = [], isLoading } = useQuery<NivelCargoItem[]>({
    queryKey: ['niveis-cargo'],
    queryFn: niveisCargosService.listar,
  })

  const ativos = niveis.filter(n => n.ativo).length

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase()
    return niveis.filter(n => {
      if (filterStatus === 'ativo' && !n.ativo) return false
      if (filterStatus === 'inativo' && n.ativo) return false
      if (term && !n.nome.toLowerCase().includes(term) && !n.label.toLowerCase().includes(term)) return false
      return true
    })
  }, [niveis, search, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginados = filtrados.slice((page - 1) * pageSize, page * pageSize)

  function mudarFiltro(v: typeof filterStatus) { setFilterStatus(v); setCurrentPage(1) }
  function mudarBusca(v: string) { setSearch(v); setCurrentPage(1) }

  function resetForm() { setForm(EMPTY_FORM); setError(''); setShowForm(false) }
  function abrirNovo() { setForm(EMPTY_FORM); setError(''); setShowForm(true) }
  function abrirEdicao(n: NivelCargoItem) {
    setForm({ id: n.id, nome: n.nome, label: n.label, descricao: n.descricao ?? '', ordem: String(n.ordem), ativo: n.ativo })
    setError(''); setShowForm(true)
  }

  const salvar = useMutation({
    mutationFn: () => {
      if (form.id) {
        return niveisCargosService.atualizar(form.id, {
          label: form.label.trim(), descricao: form.descricao.trim() || undefined,
          ordem: Number(form.ordem) || 0, ativo: form.ativo,
        })
      }
      return niveisCargosService.criar({
        nome: form.nome.trim(), label: form.label.trim(),
        descricao: form.descricao.trim() || undefined, ordem: Number(form.ordem) || 0, ativo: form.ativo,
      })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['niveis-cargo'] }); resetForm() },
    onError: (e) => setError(getErro(e, 'Erro ao salvar o nível.')),
  })

  const excluir = useMutation({
    mutationFn: (id: number) => niveisCargosService.excluir(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['niveis-cargo'] }),
    onError: (e) => alert(getErro(e, 'Erro ao excluir o nível.')),
  })

  function handleSubmit() {
    setError('')
    if (!form.id && !form.nome.trim()) { setError('Informe o nome (chave) do nível.'); return }
    if (!form.label.trim()) { setError('Informe o label de exibição do nível.'); return }
    salvar.mutate()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Níveis de Cargo</h1>
          <p className="text-gray-500 mt-1">Defina os níveis que classificam os cargos do sistema</p>
        </div>
        {isSuperAdmin && (
          <button onClick={abrirNovo} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> Novo Nível
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: niveis.length, color: 'text-blue-600' },
          { label: 'Ativos', value: ativos, color: 'text-green-600' },
          { label: 'Inativos', value: niveis.length - ativos, color: 'text-gray-400' },
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
            placeholder="Buscar por chave ou label..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['todos', 'ativo', 'inativo'] as const).map(v => (
            <button key={v} onClick={() => mudarFiltro(v)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterStatus === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              {v === 'todos' ? 'Todos' : v === 'ativo' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
          className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} por página</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
        ) : paginados.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
            <GraduationCap size={40} strokeWidth={1.2} />
            <p className="text-sm">{niveis.length === 0 ? 'Nenhum nível cadastrado.' : 'Nenhum nível encontrado para os filtros.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Chave</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Label</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Descrição</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                {isSuperAdmin && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginados.map(n => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-700">{n.nome}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{n.label}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{n.descricao || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${n.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {n.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEdicao(n)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={14} /></button>
                        <button onClick={() => { if (confirm(`Excluir o nível "${n.label}"?`)) excluir.mutate(n.id) }}
                          disabled={excluir.isPending} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

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

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">{form.id ? 'Editar Nível' : 'Novo Nível'}</h3>
              <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-3">
              {!form.id && (
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Chave interna * <span className="text-xs text-gray-400">(ex: SUPERIOR)</span></label>
                  <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                    placeholder="Ex: SUPERIOR"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-gray-600">Label de exibição *</label>
                <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                  placeholder="Ex: Ensino Superior"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                  rows={2} placeholder="Opcional"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Ordem de exibição</label>
                <input type="number" min={0} value={form.ordem} onChange={e => setForm({ ...form, ordem: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} className="rounded" />
                Nível ativo
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={resetForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSubmit} disabled={salvar.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
