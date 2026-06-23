import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowUpDown, Building2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, Loader2, Plus, Scale, Search, Upload, UserCheck, UserX, X } from 'lucide-react'
import { servidoresService, type ImportacaoResultado } from '@/services/servidores.service'
import { chamadosService, type ChamadoTipo } from '@/services/chamados.service'
import { municipiosService } from '@/services/municipios.service'
import { cargosService } from '@/services/cargos.service'
import { lotacoesService } from '@/services/lotacoes.service'
import { useAuthStore } from '@/store/auth.store'
import type { Cargo, Lotacao, Municipio, Servidor, ServidorFicha } from '@/types'

interface ConfirmacaoState {
  title: string
  message: string
  confirmLabel: string
  variant?: 'primary' | 'danger'
  onConfirm: () => void
}

interface ToastState {
  message: string
  tone?: 'success' | 'info'
}

type SortField = 'nome' | 'matricula' | 'cargo' | 'lotacao' | 'status'
type SortDirection = 'asc' | 'desc'

const pageSizeOptions = [10, 25, 50, 100]

const defaultForm = {
  nome: '',
  matricula: '',
  grau_instrucao: '',
  cargo: '',
  cargo_id: '',
  data_admissao: '',
  lotacao_id: '',
  email: '',
  chefia_servidor_id: '',
  municipio_id: '',
}

function compareText(a?: string, b?: string) {
  return (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' })
}

function formatDate(value?: string) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export default function Servidores() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.perfil === 'SUPER_ADMIN'

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showVinculoModal, setShowVinculoModal] = useState(false)
  const [selectedMunicipioId, setSelectedMunicipioId] = useState('')
  const [servidorSelecionado, setServidorSelecionado] = useState<Servidor | null>(null)
  const [municipioVinculoId, setMunicipioVinculoId] = useState('')
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoState | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [error, setError] = useState('')
  const [erroVinculo, setErroVinculo] = useState('')
  const [servidorCadastrado, setServidorCadastrado] = useState<{ nome: string; matricula: string } | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [fichaServidor, setFichaServidor] = useState<ServidorFicha | null>(null)
  const [detalheServidor, setDetalheServidor] = useState<Servidor | null>(null)
  const [loadingFicha, setLoadingFicha] = useState(false)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<ImportacaoResultado | null>(null)
  const [correcoes, setCorrecoes] = useState<Record<number, { cargo_id?: number; lotacao_id?: number }>>({})
  const [chamadosAbertos, setChamadosAbertos] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [sortField, setSortField] = useState<SortField>('nome')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const municipioCadastroId = isSuperAdmin ? Number(form.municipio_id || 0) : user?.municipio_id

  const { data: municipios = [] } = useQuery<Municipio[]>({
    queryKey: ['municipios-admin-servidores'],
    queryFn: municipiosService.listarAdmin,
    enabled: isSuperAdmin,
  })

  const { data: servidores = [], isLoading } = useQuery<Servidor[]>({
    queryKey: ['servidores', selectedMunicipioId],
    queryFn: () => servidoresService.listar(undefined, isSuperAdmin && selectedMunicipioId ? Number(selectedMunicipioId) : undefined),
  })

  const { data: chefiasDisponiveis = [] } = useQuery<Servidor[]>({
    queryKey: ['servidores-chefia', municipioCadastroId],
    queryFn: () => servidoresService.listar(true, municipioCadastroId),
    enabled: showForm && Boolean(municipioCadastroId),
  })

  const { data: cargosDisponiveis = [] } = useQuery<Cargo[]>({
    queryKey: ['cargos', municipioCadastroId],
    queryFn: () => cargosService.listar(isSuperAdmin ? municipioCadastroId : undefined),
    enabled: (showForm || Boolean(uploadResult)) && Boolean(municipioCadastroId),
  })

  const { data: lotacoesDisponiveis = [] } = useQuery<Lotacao[]>({
    queryKey: ['lotacoes', municipioCadastroId],
    queryFn: () => lotacoesService.listar(isSuperAdmin ? municipioCadastroId : undefined),
    enabled: (showForm || Boolean(uploadResult)) && Boolean(municipioCadastroId),
  })

  const criar = useMutation({
    mutationFn: servidoresService.criar,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['servidores'] })
      setShowForm(false)
      setForm(defaultForm)
      setServidorCadastrado({ nome: data.nome, matricula: data.matricula })
      setError('')
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string') {
        setError(err.response.data.detail)
        return
      }
      setError('Não foi possível cadastrar o servidor.')
    },
  })

  const vincularMunicipio = useMutation({
    mutationFn: ({ id, municipio_id }: { id: number; municipio_id: number }) =>
      servidoresService.vincularMunicipio(id, { municipio_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servidores'] })
      setShowVinculoModal(false)
      setServidorSelecionado(null)
      setMunicipioVinculoId('')
      setErroVinculo('')
      setToast({ message: 'Município do servidor atualizado com sucesso.' })
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string') {
        setErroVinculo(err.response.data.detail)
        return
      }
      setErroVinculo('Não foi possível vincular o servidor ao município.')
    },
  })

  const alterarStatus = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) => servidoresService.alterarStatus(id, ativo),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['servidores'] })
      setToast({
        message: variables.ativo ? 'Servidor ativado com sucesso.' : 'Servidor desativado com sucesso.',
      })
    },
  })

  const importar = useMutation({
    mutationFn: (file: File) => servidoresService.importar(file),
    onSuccess: (data) => {
      setUploadResult(data)
      setUploadFile(null)
      setCorrecoes({})
      setChamadosAbertos(new Set())
      queryClient.invalidateQueries({ queryKey: ['servidores'] })
    },
  })

  const reprocessar = useMutation({
    mutationFn: ({ loteId, lista }: { loteId: number; lista: { linha_id: number; cargo_id?: number; lotacao_id?: number }[] }) =>
      servidoresService.reprocessarImportacao(loteId, lista),
    onSuccess: (data) => {
      setUploadResult(data)
      setCorrecoes({})
      queryClient.invalidateQueries({ queryKey: ['servidores'] })
      setToast({ message: `Reprocessado: ${data.validos} importado(s), ${data.invalidos} com erro.` })
    },
  })

  const abrirChamado = useMutation({
    mutationFn: (payload: { tipo: ChamadoTipo; valor_solicitado: string; descricao?: string; lote_importacao_id?: number }) =>
      chamadosService.criar(payload),
    onSuccess: (_data, variables) => {
      setChamadosAbertos((prev) => new Set(prev).add(`${variables.tipo}:${variables.valor_solicitado.toLowerCase()}`))
      setToast({ message: 'Solicitação de cadastro enviada à equipe.' })
    },
  })

  // Detecta erros de cargo/lotação inexistente (corrigíveis via dropdown).
  const tipoErroBanco = (mensagem: string): 'CARGO' | 'LOTACAO' | null => {
    if (/cargo .*inexistente no banco/i.test(mensagem)) return 'CARGO'
    if (/lota..o .*inexistente no banco/i.test(mensagem)) return 'LOTACAO'
    return null
  }

  const valorSolicitadoDoErro = (mensagem: string): string => {
    const m = mensagem.match(/'([^']+)'/)
    return m ? m[1] : ''
  }

  const correcoesArray = Object.entries(correcoes)
    .map(([linha_id, v]) => ({ linha_id: Number(linha_id), ...v }))
    .filter((c) => c.cargo_id || c.lotacao_id)

  const getMunicipioNome = (municipioId: number) =>
    municipios.find((municipio) => municipio.id === municipioId)?.nome || `Município #${municipioId}`

  const getChefiaNome = (chefiaServidorId?: number) => {
    if (!chefiaServidorId) return '—'
    return servidores.find((servidor) => servidor.id === chefiaServidorId)?.nome || `Servidor #${chefiaServidorId}`
  }

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase()

    return servidores.filter((s) => {
      if (filterStatus === 'ativo' && !s.ativo) return false
      if (filterStatus === 'inativo' && s.ativo) return false
      if (!normalized) return true
      return [
        s.nome,
        s.matricula,
        s.cargo || '',
        s.lotacao?.nome || '',
        isSuperAdmin ? getMunicipioNome(s.municipio_id) : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })
  }, [servidores, search, filterStatus, isSuperAdmin, municipios])

  const sorted = useMemo(() => {
    const items = [...filtered]
    items.sort((a, b) => {
      let comparison = 0

      if (sortField === 'nome') comparison = compareText(a.nome, b.nome)
      if (sortField === 'matricula') comparison = compareText(a.matricula, b.matricula)
      if (sortField === 'cargo') comparison = compareText(a.cargo, b.cargo)
      if (sortField === 'lotacao') comparison = compareText(a.lotacao?.nome, b.lotacao?.nome)
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

  const ativos = useMemo(() => servidores.filter((s) => s.ativo).length, [servidores])
  const inativos = Math.max(servidores.length - ativos, 0)

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedMunicipioId, pageSize])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDirection('asc')
  }

  const abrirFicha = async (servidor: Servidor) => {
    setLoadingFicha(true)
    try {
      const ficha = await servidoresService.ficha(servidor.id)
      setFichaServidor(ficha)
    } finally {
      setLoadingFicha(false)
    }
  }

  const abrirDetalheServidor = async (servidor: Servidor) => {
    setLoadingDetalhe(true)
    try {
      const detalhe = await servidoresService.detalhar(servidor.id)
      setDetalheServidor(detalhe)
    } finally {
      setLoadingDetalhe(false)
    }
  }

  const abrirConfirmacaoStatus = (servidor: Servidor) => {
    const proximoStatus = !servidor.ativo
    setConfirmacao({
      title: proximoStatus ? 'Ativar servidor' : 'Desativar servidor',
      message: `Confirma ${proximoStatus ? 'a ativação' : 'a desativação'} do servidor ${servidor.nome}?`,
      confirmLabel: proximoStatus ? 'Confirmar ativação' : 'Confirmar desativação',
      variant: proximoStatus ? 'primary' : 'danger',
      onConfirm: () => alterarStatus.mutate({ id: servidor.id, ativo: proximoStatus }),
    })
  }

  const abrirConfirmacaoVinculo = () => {
    if (!servidorSelecionado || !municipioVinculoId) {
      setErroVinculo('Selecione o município para vincular.')
      return
    }

    const municipioNome = getMunicipioNome(Number(municipioVinculoId))
    setConfirmacao({
      title: 'Confirmar vínculo do servidor',
      message: `Confirma vincular ${servidorSelecionado.nome} ao município ${municipioNome}?`,
      confirmLabel: 'Confirmar vínculo',
      variant: 'primary',
      onConfirm: () =>
        vincularMunicipio.mutate({
          id: servidorSelecionado.id,
          municipio_id: Number(municipioVinculoId),
        }),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Servidores</h1>
          <p className="text-gray-500 mt-1">Gerencie os servidores do município</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <select
              value={selectedMunicipioId}
              onChange={(e) => setSelectedMunicipioId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os municípios</option>
              {municipios.map((municipio) => (
                <option key={municipio.id} value={municipio.id}>{municipio.nome}</option>
              ))}
            </select>
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50">
            <Upload size={16} />
            Importar planilha
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            onClick={() => { setShowForm(true); setError('') }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus size={16} /> Novo Servidor
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: servidores.length, color: 'text-blue-600' },
          { label: 'Ativos', value: ativos, color: 'text-green-600' },
          { label: 'Inativos', value: inativos, color: 'text-gray-400' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {uploadFile && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900">Arquivo selecionado: {uploadFile.name}</p>
              <p className="mt-1 text-xs text-blue-700">Clique em importar para processar e mapear os campos automaticamente.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setUploadFile(null)} className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-white">
                Cancelar
              </button>
              <button
                onClick={() => importar.mutate(uploadFile)}
                disabled={importar.isPending}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {importar.isPending && <Loader2 size={14} className="animate-spin" />}
                Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-widest ${uploadResult.invalidos > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  Importação de planilha
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {uploadResult.invalidos > 0 ? 'Importação concluída com pendências' : 'Importação concluída com sucesso'}
                </h3>
              </div>
              <button
                onClick={() => setUploadResult(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3 px-6 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{uploadResult.total}</p>
                <p className="text-xs text-slate-500">Total de linhas</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{uploadResult.validos}</p>
                <p className="text-xs text-emerald-700">Importados</p>
              </div>
              <div className={`rounded-xl border px-4 py-3 text-center ${uploadResult.invalidos > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50/70'}`}>
                <p className={`text-2xl font-bold ${uploadResult.invalidos > 0 ? 'text-red-600' : 'text-slate-400'}`}>{uploadResult.invalidos}</p>
                <p className={`text-xs ${uploadResult.invalidos > 0 ? 'text-red-700' : 'text-slate-500'}`}>Com erro</p>
              </div>
            </div>

            {/* Lista de erros */}
            {uploadResult.erros.length > 0 && (
              <div className="max-h-[45vh] space-y-3 overflow-y-auto border-t border-slate-200 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Linhas que precisam de correção
                </p>
                {uploadResult.erros.map((erro, i) => {
                  const tipo = tipoErroBanco(erro.mensagem)
                  const valorPedido = valorSolicitadoDoErro(erro.mensagem)
                  const chamadoKey = `${tipo}:${valorPedido.toLowerCase()}`
                  const jaSolicitado = chamadosAbertos.has(chamadoKey)
                  const correcaoLinha = correcoes[erro.linha_id] || {}
                  return (
                    <div key={`${erro.linha_id}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-xs text-slate-600">Linha {erro.linha}</span>
                        <span className="font-medium text-slate-700">{erro.nome || '—'}</span>
                        {erro.matricula && <span className="text-xs text-slate-500">· Matrícula {erro.matricula}</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium text-red-600">{erro.mensagem}</p>

                      {tipo ? (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <div className="min-w-[220px] flex-1">
                            <label className="mb-1 block text-xs font-medium text-slate-500">
                              {tipo === 'CARGO' ? 'Vincular a um cargo cadastrado' : 'Vincular a uma lotação cadastrada'}
                            </label>
                            <select
                              value={(tipo === 'CARGO' ? correcaoLinha.cargo_id : correcaoLinha.lotacao_id) ?? ''}
                              onChange={(e) => {
                                const valor = e.target.value ? Number(e.target.value) : undefined
                                setCorrecoes((prev) => ({
                                  ...prev,
                                  [erro.linha_id]: tipo === 'CARGO' ? { cargo_id: valor } : { lotacao_id: valor },
                                }))
                              }}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Selecione...</option>
                              {tipo === 'CARGO'
                                ? cargosDisponiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)
                                : lotacoesDisponiveis.filter((l) => l.ativo).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                            </select>
                          </div>
                          <button
                            onClick={() => abrirChamado.mutate({
                              tipo,
                              valor_solicitado: valorPedido,
                              descricao: `Solicitado durante importação (linha ${erro.linha})`,
                              lote_importacao_id: uploadResult.lote_id,
                            })}
                            disabled={jaSolicitado || abrirChamado.isPending || !valorPedido}
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                            title={`Solicitar à equipe o cadastro de "${valorPedido}"`}
                          >
                            {jaSolicitado ? 'Solicitação enviada ✓' : `Solicitar cadastro de "${valorPedido}"`}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">Corrija este campo direto na planilha e importe novamente.</p>
                      )}
                    </div>
                  )
                })}
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Não encontrou o cargo ou a lotação que precisa? Clique em <strong>"Solicitar cadastro"</strong> para que nossa
                  equipe cadastre. A solicitação fica registrada como um chamado para análise.
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              {uploadResult.erros.length > 0 && (
                <button
                  onClick={() => reprocessar.mutate({ loteId: uploadResult.lote_id, lista: correcoesArray })}
                  disabled={correcoesArray.length === 0 || reprocessar.isPending}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {reprocessar.isPending && <Loader2 size={14} className="animate-spin" />}
                  Reimportar corrigidos ({correcoesArray.length})
                </button>
              )}
              <button
                onClick={() => setUploadResult(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {servidorCadastrado && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
          <p className="font-semibold text-emerald-800">Servidor {servidorCadastrado.nome} cadastrado com sucesso.</p>
          <p className="mt-1 text-sm text-emerald-700">
            O login e a senha inicial são o número de matrícula cadastrado: {servidorCadastrado.matricula}.
          </p>
          <button onClick={() => setServidorCadastrado(null)} className="mt-2 text-xs font-medium text-emerald-700 underline">
            Fechar
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed right-6 top-24 z-[70]">
          <div className="min-w-[300px] rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-xl">
            <p className="text-sm font-semibold text-emerald-700">{toast.message}</p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Buscar por nome, matrícula, cargo ou lotação..."
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
          <div className="flex h-72 items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={34} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-200">
                    {[
                      { label: 'Nome', field: 'nome' as SortField, className: '' },
                      { label: 'Matrícula', field: 'matricula' as SortField, className: '' },
                      ...(isSuperAdmin ? [{ label: 'Município', field: 'nome' as SortField, className: 'hidden xl:table-cell' }] : []),
                      { label: 'Cargo', field: 'cargo' as SortField, className: 'hidden md:table-cell' },
                      { label: 'Lotação', field: 'lotacao' as SortField, className: 'hidden xl:table-cell' },
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
                  {paginated.map((s, index) => (
                    <tr key={s.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/45'}>
                      <td className="px-4 py-4">
                        <div className="min-w-[220px]">
                          <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-600">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">{s.matricula}</span>
                      </td>
                      {isSuperAdmin && (
                        <td className="hidden px-4 py-4 text-sm text-slate-600 xl:table-cell">{getMunicipioNome(s.municipio_id)}</td>
                      )}
                      <td className="hidden px-4 py-4 text-sm text-slate-600 md:table-cell">{s.cargo || '—'}</td>
                      <td className="hidden px-4 py-4 text-sm text-slate-600 xl:table-cell">{s.lotacao?.nome || '—'}</td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            s.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {s.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {isSuperAdmin && (
                            <button
                              onClick={() => {
                                setServidorSelecionado(s)
                                setMunicipioVinculoId(String(s.municipio_id))
                                setErroVinculo('')
                                setShowVinculoModal(true)
                              }}
                              className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                              title="Vincular município"
                            >
                              <Building2 size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => abrirDetalheServidor(s)}
                            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                            title="Ver dados do servidor"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => abrirFicha(s)}
                            disabled={!s.cargo_id}
                            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-30"
                            title={s.cargo_id ? 'Ver pesos do cargo' : 'Servidor sem cargo vinculado'}
                          >
                            <Scale size={16} />
                          </button>
                          <button
                            onClick={() => abrirConfirmacaoStatus(s)}
                            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                            title={s.ativo ? 'Desativar' : 'Ativar'}
                          >
                            {s.ativo ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-16 text-center">
                        <p className="text-sm font-medium text-slate-500">Nenhum servidor encontrado com os filtros atuais.</p>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Novo Servidor</h3>
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Ao cadastrar um servidor, o sistema cria automaticamente o usuário dele com login e senha inicial iguais à matrícula.
              </div>
              {isSuperAdmin && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                  Como super admin, você já define o município do servidor durante o cadastro.
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-gray-600">Nome *</label>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Nome completo"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Matrícula *</label>
                  <input
                    value={form.matricula}
                    onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                    placeholder="000000"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Grau instrução</label>
                  <input
                    value={form.grau_instrucao}
                    onChange={(e) => setForm({ ...form, grau_instrucao: e.target.value })}
                    placeholder="Fundamental, Médio, Superior..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Data admissão</label>
                  <input
                    type="date"
                    value={form.data_admissao}
                    onChange={(e) => setForm({ ...form, data_admissao: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Cargo</label>
                  <select
                    value={form.cargo_id}
                    onChange={(e) => setForm({ ...form, cargo_id: e.target.value })}
                    disabled={!municipioCadastroId}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">
                      {municipioCadastroId ? 'Selecione o cargo' : 'Selecione o município primeiro'}
                    </option>
                    {cargosDisponiveis.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({c.nivel?.label ?? c.nivel_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Lotação</label>
                  <select
                    value={form.lotacao_id}
                    onChange={(e) => setForm({ ...form, lotacao_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione a lotação</option>
                    {lotacoesDisponiveis.filter(l => l.ativo).map(l => (
                      <option key={l.id} value={String(l.id)}>{l.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">E-mail</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="servidor@municipio.gov.br"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {isSuperAdmin && (
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Município vinculado *</label>
                    <select
                      value={form.municipio_id}
                      onChange={(e) => setForm({ ...form, municipio_id: e.target.value, chefia_servidor_id: '' })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
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
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-gray-600">Chefia imediata</label>
                  <select
                    value={form.chefia_servidor_id}
                    onChange={(e) => setForm({ ...form, chefia_servidor_id: e.target.value })}
                    disabled={!municipioCadastroId}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">Selecione a chefia</option>
                    {chefiasDisponiveis.map((chefia) => (
                      <option key={chefia.id} value={chefia.id}>
                        {chefia.nome} - {chefia.matricula}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowForm(false)
                  setError('')
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={() =>
                  criar.mutate({
                    nome: form.nome,
                    matricula: form.matricula,
                    grau_instrucao: form.grau_instrucao || undefined,
                    cargo_id: form.cargo_id ? Number(form.cargo_id) : undefined,
                    data_admissao: form.data_admissao || undefined,
                    lotacao_id: form.lotacao_id ? Number(form.lotacao_id) : undefined,
                    email: form.email.trim().toLowerCase() || undefined,
                    chefia_servidor_id: form.chefia_servidor_id ? Number(form.chefia_servidor_id) : undefined,
                    municipio_id: form.municipio_id ? Number(form.municipio_id) : undefined,
                  })
                }
                disabled={criar.isPending || !form.nome || !form.matricula || (isSuperAdmin && !form.municipio_id)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {criar.isPending && <Loader2 size={14} className="animate-spin" />}
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showVinculoModal && servidorSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Vincular servidor ao município</h3>
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {servidorSelecionado.nome} - {servidorSelecionado.matricula}
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Município *</label>
                <select
                  value={municipioVinculoId}
                  onChange={(e) => setMunicipioVinculoId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Selecione o município</option>
                  {municipios.map((municipio) => (
                    <option key={municipio.id} value={municipio.id}>
                      {municipio.nome}
                    </option>
                  ))}
                </select>
              </div>
              {erroVinculo && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {erroVinculo}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowVinculoModal(false)
                  setServidorSelecionado(null)
                  setMunicipioVinculoId('')
                  setErroVinculo('')
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={abrirConfirmacaoVinculo}
                disabled={vincularMunicipio.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {vincularMunicipio.isPending && <Loader2 size={14} className="animate-spin" />}
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingFicha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Loader2 className="animate-spin text-white" size={40} />
        </div>
      )}

      {loadingDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Loader2 className="animate-spin text-white" size={40} />
        </div>
      )}

      {detalheServidor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Dados do Servidor</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{detalheServidor.nome}</h3>
                <p className="mt-0.5 text-sm text-slate-500">Campos cadastrados no banco</p>
              </div>
              <button
                onClick={() => setDetalheServidor(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              {[
                { label: 'Matrícula', value: detalheServidor.matricula },
                { label: 'Cargo', value: detalheServidor.cargo || '—' },
                { label: 'Grau de instrução', value: detalheServidor.grau_instrucao || '—' },
                { label: 'Data de admissão', value: formatDate(detalheServidor.data_admissao) },
                { label: 'Chefia (id)', value: detalheServidor.chefia_servidor_id ? String(detalheServidor.chefia_servidor_id) : '—' },
                { label: 'Chefia / avaliador', value: getChefiaNome(detalheServidor.chefia_servidor_id) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setDetalheServidor(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {fichaServidor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Ficha de Pesos</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{fichaServidor.nome}</h3>
                <p className="mt-0.5 text-sm text-slate-500">Matrícula: {fichaServidor.matricula}</p>
              </div>
              <button
                onClick={() => setFichaServidor(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {fichaServidor.cargo_catalogo ? (
                <>
                  {/* Info do cargo */}
                  <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-violet-500">Cargo</p>
                        <p className="mt-0.5 text-sm font-semibold text-violet-900">{fichaServidor.cargo_catalogo.nome}</p>
                      </div>
                      <div className="h-8 w-px bg-violet-200" />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-violet-500">Nível</p>
                        <p className="mt-0.5 text-sm font-semibold text-violet-900">
                          {fichaServidor.cargo_catalogo.nivel?.label ?? fichaServidor.cargo_catalogo.nivel_id}
                        </p>
                      </div>
                      <div className="h-8 w-px bg-violet-200" />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-violet-500">Pontuação máx.</p>
                        <p className="mt-0.5 text-sm font-semibold text-violet-900">{fichaServidor.cargo_catalogo.pontuacao_maxima} pts</p>
                      </div>
                      {fichaServidor.cargo_catalogo.pontos_min_estagio && (
                        <>
                          <div className="h-8 w-px bg-violet-200" />
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-violet-500">Mín. estágio</p>
                            <p className="mt-0.5 text-sm font-semibold text-violet-900">{fichaServidor.cargo_catalogo.pontos_min_estagio} pts</p>
                          </div>
                        </>
                      )}
                      {fichaServidor.cargo_catalogo.pontos_min_progressao && (
                        <>
                          <div className="h-8 w-px bg-violet-200" />
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-violet-500">Mín. progressão</p>
                            <p className="mt-0.5 text-sm font-semibold text-violet-900">{fichaServidor.cargo_catalogo.pontos_min_progressao} pts</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tabela de pesos */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Pesos por questão — soma:{' '}
                      <span className="text-slate-800">
                        {fichaServidor.cargo_catalogo.pesos.reduce((acc, p) => acc + p.peso, 0).toFixed(2)}
                      </span>
                    </p>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="min-w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Questão</th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Peso</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Questão</th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Peso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Array.from({ length: Math.ceil(fichaServidor.cargo_catalogo.pesos.length / 2) }).map((_, i) => {
                            const a = fichaServidor.cargo_catalogo!.pesos[i * 2]
                            const b = fichaServidor.cargo_catalogo!.pesos[i * 2 + 1]
                            return (
                              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                <td className="px-4 py-2 text-sm text-slate-600">Questão {a.numero_pergunta}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className="inline-block min-w-[2rem] rounded-lg bg-violet-100 px-2 py-0.5 text-sm font-semibold text-violet-800">
                                    {a.peso}
                                  </span>
                                </td>
                                {b ? (
                                  <>
                                    <td className="px-4 py-2 text-sm text-slate-600">Questão {b.numero_pergunta}</td>
                                    <td className="px-4 py-2 text-center">
                                      <span className="inline-block min-w-[2rem] rounded-lg bg-violet-100 px-2 py-0.5 text-sm font-semibold text-violet-800">
                                        {b.peso}
                                      </span>
                                    </td>
                                  </>
                                ) : (
                                  <><td /><td /></>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Este servidor não possui cargo vinculado no catálogo.
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setFichaServidor(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmacao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-800">{confirmacao.title}</h3>
            <p className="text-sm text-gray-600">{confirmacao.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmacao(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  confirmacao.onConfirm()
                  setConfirmacao(null)
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
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
