import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import api from '@/services/api'
import { municipiosService } from '@/services/municipios.service'
import { useAuthStore } from '@/store/auth.store'
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, EyeOff, KeyRound, Loader2, Plus, Search, UserCheck, UserX, X } from 'lucide-react'
import type { FuncaoUsuario, Municipio } from '@/types'

interface ConfirmacaoState {
  title: string
  message: string
  confirmLabel: string
  variant?: 'primary' | 'danger'
  onConfirm: () => void
}

interface CredenciaisModal {
  nome: string
  email: string
  senha?: string
}

type SortField = 'nome' | 'status'
type SortDirection = 'asc' | 'desc'

const pageSizeOptions = [10, 25, 50, 100]

function compareText(a?: string, b?: string) {
  return (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' })
}

export default function FuncoesUsuarioPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.perfil === 'SUPER_ADMIN'

  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('ativo')
  const [selectedMunicipioId, setSelectedMunicipioId] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('nome')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoState | null>(null)
  const [showInativasModal, setShowInativasModal] = useState(false)
  const [credenciaisModal, setCredenciaisModal] = useState<CredenciaisModal | null>(null)
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ nome: '', municipio_id: '' })

  const { data: funcoes = [], isLoading } = useQuery<FuncaoUsuario[]>({
    queryKey: ['funcoes-usuario', selectedMunicipioId],
    queryFn: async () => {
      const query = isSuperAdmin && selectedMunicipioId ? `?municipio_id=${selectedMunicipioId}` : ''
      return (await api.get(`/funcoes-usuario${query}`)).data
    },
  })

  const { data: municipios = [] } = useQuery<Municipio[]>({
    queryKey: ['municipios-funcoes-usuario'],
    queryFn: municipiosService.listarAdmin,
    enabled: isSuperAdmin,
  })

  const criar = useMutation({
    mutationFn: (data: object) => api.post<FuncaoUsuario>('/funcoes-usuario', data),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['funcoes-usuario'] })
      setShowForm(false)
      setForm({ nome: '', municipio_id: '' })
      setError('')

      // Se criou subcomissão, exibir credenciais geradas
      if (resp.data.senha_gerada && resp.data.usuario_compartilhado) {
        setSenhaVisivel(false)
        setCredenciaisModal({
          nome: resp.data.nome,
          email: resp.data.usuario_compartilhado.email,
          senha: resp.data.senha_gerada,
        })
      }
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string') {
        setError(err.response.data.detail)
        return
      }
      setError('Não foi possível criar a função de usuário.')
    },
  })

  const alterarStatus = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      api.patch(`/funcoes-usuario/${id}/status?ativo=${ativo}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcoes-usuario'] })
    },
  })

  const getMunicipioNome = (municipioId: number) =>
    municipios.find((municipio) => municipio.id === municipioId)?.nome || `Município #${municipioId}`

  const funcoesAtivas = useMemo(() => funcoes.filter((funcao) => funcao.ativo), [funcoes])
  const funcoesInativas = useMemo(() => funcoes.filter((funcao) => !funcao.ativo), [funcoes])

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return funcoes.filter((funcao) => {
      if (filterStatus === 'ativo' && !funcao.ativo) return false
      if (filterStatus === 'inativo' && funcao.ativo) return false
      if (!normalized) return true
      return [funcao.nome, isSuperAdmin ? getMunicipioNome(funcao.municipio_id) : '']
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })
  }, [funcoes, search, filterStatus, isSuperAdmin, municipios])

  const sorted = useMemo(() => {
    const items = [...filtered]
    items.sort((a, b) => {
      let comparison = 0
      if (sortField === 'nome') comparison = compareText(a.nome, b.nome)
      if (sortField === 'status') comparison = Number(a.ativo) - Number(b.ativo)
      return sortDirection === 'asc' ? comparison : comparison * -1
    })
    return items
  }, [filtered, sortField, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, currentPage, pageSize])

  const ativos = funcoesAtivas.length
  const inativos = funcoesInativas.length

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedMunicipioId, pageSize])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDirection('asc')
  }

  const handleCreate = () => {
    if (!form.nome.trim()) {
      setError('Informe o nome da função de usuário.')
      return
    }
    if (isSuperAdmin && !form.municipio_id) {
      setError('Selecione o município da função.')
      return
    }
    setError('')
    criar.mutate({
      nome: form.nome.trim(),
      municipio_id: form.municipio_id ? Number(form.municipio_id) : undefined,
    })
  }

  const abrirConfirmacaoStatus = (funcao: FuncaoUsuario) => {
    const proximoStatus = !funcao.ativo
    setConfirmacao({
      title: proximoStatus ? 'Ativar função' : 'Desativar função',
      message: `Confirma ${proximoStatus ? 'a ativação' : 'a desativação'} da função ${funcao.nome}?`,
      confirmLabel: proximoStatus ? 'Confirmar ativação' : 'Confirmar desativação',
      variant: proximoStatus ? 'primary' : 'danger',
      onConfirm: () => alterarStatus.mutate({ id: funcao.id, ativo: proximoStatus }),
    })
  }


  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Etapa 1 · Funções</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Funções / Tipos de Usuário</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Cadastre as funções que existem no município (ex.: Chefia, Comissão Técnica). Funções do tipo
                <span className="mx-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">Subcomissão</span>
                geram automaticamente um login único compartilhado para todos os membros.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{funcoes.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Ativas</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{ativos}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowInativasModal(true)}
                className="rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Inativas</p>
                <p className="mt-2 text-2xl font-semibold text-slate-700">{inativos}</p>
                <p className="mt-1 text-xs text-slate-500">Clique para ver quais foram inativadas</p>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isSuperAdmin && (
              <select
                value={selectedMunicipioId}
                onChange={(e) => setSelectedMunicipioId(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todos os municípios</option>
                {municipios.map((municipio) => (
                  <option key={municipio.id} value={municipio.id}>{municipio.nome}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => { setError(''); setShowForm(true) }}
              className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={16} />
              Nova Função
            </button>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Buscar por nome da função ou município..."
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              {(['todos', 'ativo', 'inativo'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => { setFilterStatus(v); setCurrentPage(1) }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterStatus === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                  {v === 'todos' ? 'Todas' : v === 'ativo' ? 'Ativas' : 'Inativas'}
                </button>
              ))}
            </div>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>{option} por página</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-200">
                    {[
                      { label: 'Função', field: 'nome' as SortField, className: '' },
                      ...(isSuperAdmin ? [{ label: 'Município', field: 'nome' as SortField, className: 'hidden lg:table-cell' }] : []),
                      { label: 'Login compartilhado', field: 'nome' as SortField, className: 'hidden md:table-cell' },
                      { label: 'Status', field: 'status' as SortField, className: 'text-center' },
                    ].map((column) => (
                      <th key={column.label} className={`px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 ${column.className}`}>
                        <button
                          onClick={() => toggleSort(column.field)}
                          className={`inline-flex items-center gap-2 ${column.label === 'Status' ? 'mx-auto flex' : ''} transition hover:text-slate-700`}
                        >
                          {column.label}
                          <ArrowUpDown size={14} />
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((funcao, index) => (
                    <tr key={funcao.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/45'}>
                      <td className="px-4 py-4">
                        <div className="min-w-[180px] flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{funcao.nome}</p>
                          {funcao.perfil_base === 'SUBCOMISSAO' && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                              Subcomissão
                            </span>
                          )}
                        </div>
                      </td>
                      {isSuperAdmin && (
                        <td className="hidden px-4 py-4 text-sm text-slate-600 lg:table-cell">
                          {getMunicipioNome(funcao.municipio_id)}
                        </td>
                      )}
                      <td className="hidden px-4 py-4 md:table-cell">
                        {funcao.usuario_compartilhado ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-mono text-violet-700">
                            {funcao.usuario_compartilhado.email}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${funcao.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {funcao.ativo ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {funcao.usuario_compartilhado && (
                            <button
                              onClick={() => {
                                setSenhaVisivel(false)
                                setCredenciaisModal({
                                  nome: funcao.nome,
                                  email: funcao.usuario_compartilhado!.email,
                                })
                              }}
                              className="rounded-xl border border-violet-200 p-2 text-violet-400 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-600"
                              title="Ver login compartilhado"
                            >
                              <KeyRound size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => abrirConfirmacaoStatus(funcao)}
                            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                            title={funcao.ativo ? 'Desativar' : 'Ativar'}
                          >
                            {funcao.ativo ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={isSuperAdmin ? 5 : 4} className="px-4 py-16 text-center">
                        <p className="text-sm font-medium text-slate-500">Nenhuma função encontrada com os filtros atuais.</p>
                        <p className="mt-1 text-xs text-slate-400">Cadastre funções para personalizar a criação de usuários.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-5 py-3 text-sm text-slate-600">
              <span>{sorted.length} registro{sorted.length !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsLeft size={15} /></button>
                <button onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={15} /></button>
                <span className="px-3">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={15} /></button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsRight size={15} /></button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Modal: credenciais do login compartilhado */}
      {credenciaisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Login compartilhado</h3>
                <p className="mt-1 text-sm text-slate-500">{credenciaisModal.nome}</p>
              </div>
              <button
                onClick={() => setCredenciaisModal(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Login (e-mail)</p>
                <p className="text-sm font-mono font-medium text-slate-800 break-all">{credenciaisModal.email}</p>
              </div>

              {credenciaisModal.senha ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-500 mb-1">Senha gerada — anote agora!</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-mono font-medium text-violet-900">
                      {senhaVisivel ? credenciaisModal.senha : '••••••••••••'}
                    </p>
                    <button
                      onClick={() => setSenhaVisivel((v) => !v)}
                      className="rounded-lg p-1 text-violet-400 transition hover:bg-violet-100 hover:text-violet-600"
                    >
                      {senhaVisivel ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-violet-600">Esta senha não será exibida novamente. Salve-a agora.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Senha</p>
                  <p className="text-sm text-slate-500 italic">Definida no cadastro — use "Redefinir senha" se necessário.</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setCredenciaisModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: funções inativas */}
      {showInativasModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Funções inativas</h3>
                <p className="mt-1 text-sm text-slate-500">Lista de funções atualmente inativadas.</p>
              </div>
              <button onClick={() => setShowInativasModal(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {funcoesInativas.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Não há funções inativas no momento.
                </div>
              ) : (
                funcoesInativas.map((funcao) => (
                  <div key={funcao.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{funcao.nome}</p>
                    {isSuperAdmin && (
                      <p className="mt-1 text-xs text-slate-500">{getMunicipioNome(funcao.municipio_id)}</p>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowInativasModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: criar nova função */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Nova Função</h3>
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Dê um nome para a função, como "Chefia" ou "Comissão Técnica". Funções de <strong>subcomissão</strong> geram automaticamente um login único compartilhado — a senha será exibida uma única vez.
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Nome da função *</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: SubComissão Fundamental"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Município *</label>
                  <select
                    value={form.municipio_id}
                    onChange={(e) => setForm({ ...form, municipio_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Selecione o município</option>
                    {municipios.map((municipio) => (
                      <option key={municipio.id} value={municipio.id}>{municipio.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowForm(false); setError('') }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={criar.isPending || !form.nome}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {criar.isPending && <Loader2 size={14} className="animate-spin" />}
                Criar Função
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmação de status */}
      {confirmacao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-800">{confirmacao.title}</h3>
            <p className="text-sm text-gray-600">{confirmacao.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmacao(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">
                Cancelar
              </button>
              <button
                onClick={() => { confirmacao.onConfirm(); setConfirmacao(null) }}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${confirmacao.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {confirmacao.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
