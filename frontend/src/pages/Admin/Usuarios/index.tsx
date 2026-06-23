import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import api from '@/services/api'
import { municipiosService } from '@/services/municipios.service'
import { servidoresService } from '@/services/servidores.service'
import { useAuthStore } from '@/store/auth.store'
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, EyeOff, Loader2, Pencil, Plus, Search, UserCheck, UserX, X } from 'lucide-react'
import { PERFIL_LABELS } from '@/utils/formatters'
import type { FuncaoUsuario, Municipio, Servidor } from '@/types'

interface Usuario {
  id: number
  nome: string
  email: string
  municipio_id: number
  servidor_id?: number | null
  funcao_usuario_id?: number | null
  funcao_usuario_nome?: string | null
  perfil: string
  ativo: boolean
  criado_em: string
}

interface ConfirmacaoState {
  title: string
  message: string
  confirmLabel: string
  variant?: 'primary' | 'danger'
  onConfirm: () => void
}

interface ToastState {
  message: string
}

type SortField = 'nome' | 'email' | 'funcao' | 'status'
type SortDirection = 'asc' | 'desc'

const pageSizeOptions = [10, 25, 50, 100]

function compareText(a?: string, b?: string) {
  return (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' })
}

export default function Usuarios() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.perfil === 'SUPER_ADMIN'
  const [showForm, setShowForm] = useState(false)
  const [selectedMunicipioId, setSelectedMunicipioId] = useState<string>('')
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoState | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [showInativosModal, setShowInativosModal] = useState(false)
  const [editUsuario, setEditUsuario] = useState<{ id: number; nome: string } | null>(null)
  const [editForm, setEditForm] = useState({ email: '', senha: '' })
  const [editError, setEditError] = useState('')
  const [editSenhaVisivel, setEditSenhaVisivel] = useState(false)
  const [credenciaisUsuario, setCredenciaisUsuario] = useState<{ nome: string; email: string; servidor_id?: number | null } | null>(null)
  const [credenciaisServidor, setCredenciaisServidor] = useState<Servidor | null>(null)
  const [credenciaisLoading, setCredenciaisLoading] = useState(false)
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('ativo')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('nome')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    municipio_id: '',
    servidor_id: '',
    funcao_usuario_id: '',
  })
  const [error, setError] = useState('')

  const municipioFormularioId = isSuperAdmin ? Number(form.municipio_id || 0) : user?.municipio_id

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ['usuarios', selectedMunicipioId],
    queryFn: async () => {
      const query = isSuperAdmin && selectedMunicipioId ? `?municipio_id=${selectedMunicipioId}` : ''
      const response = await api.get<Usuario[]>(`/usuarios${query}`)
      return response.data.filter((usuario) => usuario.perfil !== 'SERVIDOR')
    },
  })

  const { data: municipios = [] } = useQuery<Municipio[]>({
    queryKey: ['municipios-admin-select'],
    queryFn: municipiosService.listarAdmin,
    enabled: isSuperAdmin,
  })

  const { data: funcoesUsuario = [] } = useQuery<FuncaoUsuario[]>({
    queryKey: ['funcoes-usuario-usuarios', municipioFormularioId],
    queryFn: async () => {
      const query = municipioFormularioId ? `?ativo=true&municipio_id=${municipioFormularioId}` : '?ativo=true'
      return (await api.get(`/funcoes-usuario${query}`)).data
    },
    enabled: Boolean(municipioFormularioId),
  })

  const abrirCredenciais = async (u: Usuario) => {
    setSenhaVisivel(false)
    setCredenciaisServidor(null)
    setCredenciaisUsuario(u)
    if (u.servidor_id) {
      setCredenciaisLoading(true)
      try {
        const srv = await servidoresService.detalhar(u.servidor_id)
        setCredenciaisServidor(srv)
      } catch {
        // exibe sem matrícula
      } finally {
        setCredenciaisLoading(false)
      }
    }
  }

  const criar = useMutation({
    mutationFn: (data: object) => api.post('/usuarios', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setShowForm(false)
      setForm({
        nome: '',
        email: '',
        senha: '',
        municipio_id: '',
        servidor_id: '',
        funcao_usuario_id: '',
      })
      setError('')
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail

        if (Array.isArray(detail) && detail[0]?.msg) {
          setError(detail[0].msg)
          return
        }

        if (typeof detail === 'string') {
          setError(detail)
          return
        }
      }

      setError('Não foi possível criar o usuário.')
    },
  })

  const alterarStatus = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      api.patch(`/usuarios/${id}/status?ativo=${ativo}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setToast({
        message: variables.ativo ? 'Usuário ativado com sucesso.' : 'Usuário desativado com sucesso.',
      })
    },
  })

  const editar = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => api.put(`/usuarios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setEditUsuario(null)
      setEditForm({ email: '', senha: '' })
      setEditError('')
      setEditSenhaVisivel(false)
      setToast({ message: 'Usuário atualizado com sucesso.' })
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string') {
        setEditError(err.response.data.detail)
        return
      }
      setEditError('Não foi possível atualizar o usuário.')
    },
  })

  const handleEditar = () => {
    if (!editUsuario) return
    if (!editForm.email && !editForm.senha) {
      setEditError('Informe ao menos o e-mail ou a nova senha.')
      return
    }
    if (editForm.senha && editForm.senha.length < 8) {
      setEditError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    setEditError('')
    const payload: Record<string, string> = {}
    if (editForm.email) payload.email = editForm.email
    if (editForm.senha) payload.senha = editForm.senha
    editar.mutate({ id: editUsuario.id, data: payload })
  }

  const emailValido = /\S+@\S+\.\S+/.test(form.email)

  const getMunicipioNome = (municipioId: number) =>
    municipios.find((municipio) => municipio.id === municipioId)?.nome || `Município #${municipioId}`

  const usuariosAtivos = useMemo(() => usuarios.filter((u) => u.ativo), [usuarios])
  const usuariosInativos = useMemo(() => usuarios.filter((u) => !u.ativo), [usuarios])

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase()

    return usuarios.filter((u) => {
      if (filterStatus === 'ativo' && !u.ativo) return false
      if (filterStatus === 'inativo' && u.ativo) return false
      if (!normalized) return true
      return [
        u.nome,
        u.email,
        u.funcao_usuario_nome || '',
        PERFIL_LABELS[u.perfil] || u.perfil,
        isSuperAdmin ? getMunicipioNome(u.municipio_id) : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })
  }, [usuarios, search, filterStatus, isSuperAdmin, municipios])

  const sorted = useMemo(() => {
    const items = [...filtered]
    items.sort((a, b) => {
      let comparison = 0
      if (sortField === 'nome') comparison = compareText(a.nome, b.nome)
      if (sortField === 'email') comparison = compareText(a.email, b.email)
      if (sortField === 'funcao') comparison = compareText(a.funcao_usuario_nome || PERFIL_LABELS[a.perfil] || a.perfil, b.funcao_usuario_nome || PERFIL_LABELS[b.perfil] || b.perfil)
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

  const ativos = usuariosAtivos.length
  const inativos = usuariosInativos.length

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
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

  const handleCreateUser = () => {
    if (!form.nome.trim()) {
      setError('Informe o nome do usuário.')
      return
    }

    if (!emailValido) {
      setError('Informe um e-mail válido.')
      return
    }

    if (form.senha.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (isSuperAdmin && !form.municipio_id) {
      setError('Selecione o município do usuário.')
      return
    }

    if (!form.funcao_usuario_id) {
      setError('Selecione a função do usuário.')
      return
    }

    setError('')
    criar.mutate({
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      senha: form.senha,
      municipio_id: form.municipio_id ? Number(form.municipio_id) : undefined,
      servidor_id: form.servidor_id ? Number(form.servidor_id) : undefined,
      funcao_usuario_id: Number(form.funcao_usuario_id),
    })
  }

  const abrirConfirmacaoStatus = (usuario: Usuario) => {
    const proximoStatus = !usuario.ativo
    setConfirmacao({
      title: proximoStatus ? 'Ativar usuário' : 'Desativar usuário',
      message: `Confirma ${proximoStatus ? 'a ativação' : 'a desativação'} do usuário ${usuario.nome}?`,
      confirmLabel: proximoStatus ? 'Confirmar ativação' : 'Confirmar desativação',
      variant: proximoStatus ? 'primary' : 'danger',
      onConfirm: () => alterarStatus.mutate({ id: usuario.id, ativo: proximoStatus }),
    })
  }


  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Etapa 2 · Usuários</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Usuários do Sistema</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Cadastre os usuários que terão login e senha. Cada usuário recebe uma das funções criadas na etapa anterior.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{usuarios.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Ativos</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{ativos}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowInativosModal(true)}
                className="rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Inativos</p>
                <p className="mt-2 text-2xl font-semibold text-slate-700">{inativos}</p>
                <p className="mt-1 text-xs text-slate-500">Clique para ver quem foi inativado</p>
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
                  <option key={municipio.id} value={municipio.id}>
                    {municipio.nome}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => {
                setError('')
                setShowForm(true)
              }}
              className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={16} />
              Novo Usuário
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
                placeholder="Buscar por nome, e-mail, função, perfil ou município..."
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
                  {v === 'todos' ? 'Todos' : v === 'ativo' ? 'Ativos' : 'Inativos'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>{option} por página</option>
                ))}
              </select>
              {municipioFormularioId && funcoesUsuario.length === 0 && (
                <p className="w-full text-xs text-amber-700">
                  Nenhuma função cadastrada para este município. Cadastre primeiro na etapa "Funções".
                </p>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-200">
                    {[
                      { label: 'Nome', field: 'nome' as SortField, className: '' },
                      { label: 'E-mail', field: 'email' as SortField, className: 'hidden sm:table-cell' },
                      ...(isSuperAdmin ? [{ label: 'Município', field: 'nome' as SortField, className: 'hidden lg:table-cell' }] : []),
                      { label: 'Função', field: 'funcao' as SortField, className: '' },
                      { label: 'Status', field: 'status' as SortField, className: 'text-center' },
                    ].map((column) => (
                      <th
                        key={column.label}
                        className={`px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 ${column.className}`}
                      >
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
                  {paginated.map((u, index) => (
                    <tr key={u.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/45'}>
                      <td className="px-4 py-4">
                        <div className="min-w-[220px]">
                          <p className="text-sm font-semibold text-slate-800">{u.nome}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 hidden sm:table-cell">{u.email}</td>
                      {isSuperAdmin && (
                        <td className="px-4 py-4 text-sm text-slate-600 hidden lg:table-cell">
                          {getMunicipioNome(u.municipio_id)}
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <span className="inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                          {u.funcao_usuario_nome || PERFIL_LABELS[u.perfil] || u.perfil}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => abrirCredenciais(u)}
                            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                            title="Ver login e senha"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEditUsuario({ id: u.id, nome: u.nome })
                              setEditForm({ email: '', senha: '' })
                              setEditError('')
                            }}
                            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600"
                            title="Editar e-mail / senha"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => abrirConfirmacaoStatus(u)}
                            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                            title={u.ativo ? 'Desativar' : 'Ativar'}
                          >
                            {u.ativo ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-16 text-center">
                        <p className="text-sm font-medium text-slate-500">Nenhum usuário encontrado com os filtros atuais.</p>
                        <p className="mt-1 text-xs text-slate-400">Ajuste a busca, município ou quantidade por página.</p>
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

      {toast && (
        <div className="fixed right-6 top-24 z-[70]">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg min-w-[280px]">
            <p className="text-sm font-medium text-emerald-800">{toast.message}</p>
          </div>
        </div>
      )}

      {showInativosModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Usuários inativos</h3>
                <p className="mt-1 text-sm text-slate-500">Lista de usuários atualmente inativados.</p>
              </div>
              <button
                onClick={() => setShowInativosModal(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {usuariosInativos.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Não há usuários inativos no momento.
                </div>
              ) : (
                usuariosInativos.map((usuario) => (
                  <div key={usuario.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{usuario.nome}</p>
                    <p className="mt-1 text-xs text-slate-500">{usuario.email}</p>
                    {isSuperAdmin && (
                      <p className="mt-1 text-xs text-slate-500">{getMunicipioNome(usuario.municipio_id)}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInativosModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {credenciaisUsuario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Credenciais de acesso</h3>
                <p className="mt-1 text-sm text-slate-500">{credenciaisUsuario.nome}</p>
              </div>
              <button
                onClick={() => { setCredenciaisUsuario(null); setCredenciaisServidor(null) }}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Login</p>
                <p className="text-sm font-mono font-medium text-slate-800 break-all">{credenciaisUsuario.email}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Senha</p>
                {credenciaisLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    Carregando...
                  </div>
                ) : credenciaisServidor ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-mono font-medium text-slate-800">
                      {senhaVisivel ? credenciaisServidor.matricula : '••••••••'}
                    </p>
                    <button
                      onClick={() => setSenhaVisivel((v) => !v)}
                      className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                      title={senhaVisivel ? 'Ocultar' : 'Mostrar'}
                    >
                      {senhaVisivel ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">
                    {credenciaisUsuario.servidor_id
                      ? 'Não foi possível carregar a matrícula.'
                      : 'Senha definida no cadastro — não é possível exibir.'}
                  </p>
                )}
                {credenciaisServidor && (
                  <p className="mt-1 text-xs text-slate-400">A senha padrão é a matrícula do servidor.</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => { setCredenciaisUsuario(null); setCredenciaisServidor(null) }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: editar e-mail / senha */}
      {editUsuario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Editar acesso</h3>
                <p className="mt-1 text-sm text-slate-500">{editUsuario.nome}</p>
              </div>
              <button
                onClick={() => setEditUsuario(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="novo@email.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nova senha <span className="text-slate-400 font-normal">(deixe em branco para não alterar)</span></label>
                <div className="relative">
                  <input
                    type={editSenhaVisivel ? 'text' : 'password'}
                    value={editForm.senha}
                    onChange={(e) => setEditForm({ ...editForm, senha: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setEditSenhaVisivel((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    tabIndex={-1}
                  >
                    {editSenhaVisivel ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</div>
              )}
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => { setEditUsuario(null); setEditSenhaVisivel(false) }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditar}
                disabled={editar.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-60 transition hover:bg-blue-700"
              >
                {editar.isPending && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Novo Usuário</h3>
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Cada usuário deve receber uma das funções cadastradas na etapa anterior (ex.: Chefia, Comissão Técnica). O acesso é definido automaticamente pela função escolhida.
              </div>
              {[
                { field: 'nome', label: 'Nome *', type: 'text', placeholder: 'Nome completo' },
                { field: 'email', label: 'E-mail *', type: 'email', placeholder: 'email@exemplo.com' },
                { field: 'senha', label: 'Senha *', type: 'password', placeholder: 'Mínimo 8 caracteres' },
              ].map(({ field, label, type, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[field as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Município *</label>
                  <select
                    value={form.municipio_id}
                    onChange={(e) => setForm({ ...form, municipio_id: e.target.value, funcao_usuario_id: '', servidor_id: '' })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Selecione o município</option>
                    {municipios.map((municipio) => (
                      <option key={municipio.id} value={municipio.id}>
                        {municipio.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Função de usuário *</label>
                <select
                  value={form.funcao_usuario_id}
                  onChange={(e) => setForm({ ...form, funcao_usuario_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  disabled={!municipioFormularioId}
                >
                  <option value="">{municipioFormularioId ? 'Selecione a função' : 'Selecione primeiro o município'}</option>
                  {funcoesUsuario
                    .filter((f) => f.perfil_base !== 'SUBCOMISSAO')
                    .map((funcao) => (
                      <option key={funcao.id} value={funcao.id}>
                        {funcao.nome}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Funções de subcomissão possuem login único gerado automaticamente — gerencie-as na Etapa 1.
                </p>
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => {
                  setShowForm(false)
                  setError('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                disabled={criar.isPending || !form.nome || !form.email || !form.senha}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {criar.isPending && <Loader2 size={14} className="animate-spin" />}
                Criar Usuário
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmacao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">{confirmacao.title}</h3>
            <p className="text-sm text-gray-600">{confirmacao.message}</p>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setConfirmacao(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  confirmacao.onConfirm()
                  setConfirmacao(null)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                  confirmacao.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
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
