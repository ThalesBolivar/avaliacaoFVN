import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit, Loader2, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { cargosService } from '@/services/cargos.service'
import { municipiosService } from '@/services/municipios.service'
import { questionariosService } from '@/services/questionarios.service'
import { niveisCargosService } from '@/services/niveis-cargo.service'
import { useAuthStore } from '@/store/auth.store'
import type { Cargo, Municipio, Modelo, NivelCargoItem, PesoQuestao } from '@/types'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

interface FormState {
  id?: number
  municipio_id: string
  nome: string
  nivel_id: string
  modelo_avaliacao_id: string
  pontuacao_maxima: string
  pontos_min_estagio: string
  pontos_min_progressao: string
  ativo: boolean
}

const EMPTY_FORM: FormState = {
  municipio_id: '',
  nome: '',
  nivel_id: '',
  modelo_avaliacao_id: '',
  pontuacao_maxima: '100',
  pontos_min_estagio: '',
  pontos_min_progressao: '',
  ativo: true,
}

function getErro(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback
  )
}

export default function Cargos() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.perfil === 'SUPER_ADMIN'

  const [search, setSearch] = useState('')
  const [selectedMunicipioId, setSelectedMunicipioId] = useState('')
  const [filterNivel, setFilterNivel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [incluirPesos, setIncluirPesos] = useState(false)
  const [pesos, setPesos] = useState<PesoQuestao[]>([])
  const [error, setError] = useState('')

  // município efetivo do formulário (super admin escolhe; demais usam o próprio)
  const municipioFormId = isSuperAdmin ? Number(form.municipio_id || 0) : user?.municipio_id

  const { data: municipios = [] } = useQuery<Municipio[]>({
    queryKey: ['municipios-admin-cargos'],
    queryFn: municipiosService.listarAdmin,
    enabled: isSuperAdmin,
  })

  const { data: niveis = [] } = useQuery<NivelCargoItem[]>({
    queryKey: ['niveis-cargo'],
    queryFn: niveisCargosService.listar,
  })

  const { data: cargos = [], isLoading } = useQuery<Cargo[]>({
    queryKey: ['cargos-admin', selectedMunicipioId],
    // ativo=null -> traz ativos e inativos para a tela de gestão
    queryFn: () =>
      cargosService.listar(
        isSuperAdmin && selectedMunicipioId ? Number(selectedMunicipioId) : undefined,
        null,
      ),
  })

  const { data: modelos = [] } = useQuery<Modelo[]>({
    queryKey: ['modelos-cargos'],
    queryFn: questionariosService.listarModelos,
    enabled: showForm,
  })

  const ativos = cargos.filter((c) => c.ativo).length
  const inativos = cargos.length - ativos

  const filtrados = useMemo(() => {
    const termo = search.trim().toLowerCase()
    return cargos
      .filter((c) => {
        if (termo && !c.nome.toLowerCase().includes(termo) && !c.nivel.label.toLowerCase().includes(termo)) return false
        if (filterNivel && String(c.nivel_id) !== filterNivel) return false
        if (filterStatus === 'ativo' && !c.ativo) return false
        if (filterStatus === 'inativo' && c.ativo) return false
        return true
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }, [cargos, search, filterNivel, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize))
  const paginados = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtrados.slice(start, start + pageSize)
  }, [filtrados, currentPage, pageSize])

  const startItem = filtrados.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, filtrados.length)

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedMunicipioId, filterNivel, filterStatus, pageSize])

  function resetForm() {
    setForm(EMPTY_FORM)
    setPesos([])
    setIncluirPesos(false)
    setError('')
    setShowForm(false)
  }

  function abrirNovo() {
    setForm(EMPTY_FORM)
    setPesos([])
    setIncluirPesos(false)
    setError('')
    setShowForm(true)
  }

  async function abrirEdicao(cargo: Cargo) {
    setError('')
    setForm({
      id: cargo.id,
      municipio_id: String(cargo.municipio_id),
      nome: cargo.nome,
      nivel_id: String(cargo.nivel_id),
      modelo_avaliacao_id: cargo.modelo_avaliacao_id ? String(cargo.modelo_avaliacao_id) : '',
      pontuacao_maxima: String(cargo.pontuacao_maxima ?? ''),
      pontos_min_estagio: cargo.pontos_min_estagio != null ? String(cargo.pontos_min_estagio) : '',
      pontos_min_progressao: cargo.pontos_min_progressao != null ? String(cargo.pontos_min_progressao) : '',
      ativo: cargo.ativo,
    })
    setIncluirPesos(false)
    setShowForm(true)
    try {
      const detalhe = await cargosService.detalhar(cargo.id)
      setPesos(detalhe.pesos ?? [])
    } catch {
      setPesos([])
    }
  }

  const salvar = useMutation({
    mutationFn: () => {
      const payload = {
        ...(isSuperAdmin && !form.id ? { municipio_id: Number(form.municipio_id) } : {}),
        nome: form.nome.trim(),
        nivel_id: Number(form.nivel_id),
        modelo_avaliacao_id: form.modelo_avaliacao_id ? Number(form.modelo_avaliacao_id) : null,
        pontuacao_maxima: Number(form.pontuacao_maxima) || 0,
        pontos_min_estagio: form.pontos_min_estagio === '' ? null : Number(form.pontos_min_estagio),
        pontos_min_progressao: form.pontos_min_progressao === '' ? null : Number(form.pontos_min_progressao),
        ativo: form.ativo,
        ...(incluirPesos ? { pesos } : {}),
      }
      return form.id
        ? cargosService.atualizar(form.id, payload)
        : cargosService.criar(payload as Parameters<typeof cargosService.criar>[0])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos-admin'] })
      queryClient.invalidateQueries({ queryKey: ['cargos'] })
      resetForm()
    },
    onError: (e) => setError(getErro(e, 'Erro ao salvar o cargo.')),
  })

  const excluir = useMutation({
    mutationFn: (id: number) => cargosService.excluir(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['cargos-admin'] })
      queryClient.invalidateQueries({ queryKey: ['cargos'] })
      if (res.desativado) alert(res.message)
    },
    onError: (e) => alert(getErro(e, 'Erro ao excluir o cargo.')),
  })

  function handleSubmit() {
    setError('')
    if (isSuperAdmin && !form.id && !form.municipio_id) {
      setError('Selecione o município do cargo.')
      return
    }
    if (!form.nome.trim()) {
      setError('Informe o nome do cargo.')
      return
    }
    if (!form.nivel_id) {
      setError('Selecione o nível do cargo.')
      return
    }
    salvar.mutate()
  }

  const somaPesos = pesos.reduce((acc, p) => acc + (Number(p.peso) || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cargos</h1>
          <p className="text-gray-500 mt-1">Catálogo de cargos do município — cada cargo define o nível e o modelo de avaliação</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <select
              value={selectedMunicipioId}
              onChange={(e) => setSelectedMunicipioId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os municípios</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          )}
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus size={16} /> Novo Cargo
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: cargos.length, color: 'text-blue-600' },
          { label: 'Ativos', value: ativos, color: 'text-green-600' },
          { label: 'Inativos', value: inativos, color: 'text-gray-400' },
        ].map((c) => (
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
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Buscar por nome ou nível..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterNivel}
          onChange={(e) => { setFilterNivel(e.target.value); setCurrentPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os níveis</option>
          {niveis.filter((n) => n.ativo).map((n) => (
            <option key={n.id} value={n.id}>{n.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          {([['', 'Todos'], ['ativo', 'Ativos'], ['inativo', 'Inativos']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setFilterStatus(v); setCurrentPage(1) }}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterStatus === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
          className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt} por página</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-blue-600" size={24} />
          </div>
        ) : filtrados.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            {cargos.length === 0
              ? 'Nenhum cargo cadastrado. Clique em "Novo Cargo" para começar.'
              : 'Nenhum cargo encontrado para os filtros selecionados.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-medium">Cargo</th>
                    <th className="px-4 py-3 font-medium">Nível</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Pontuação máx.</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Modelo</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginados.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-800">{c.nome}</td>
                      <td className="px-4 py-3 text-slate-600">{c.nivel.label}</td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{c.pontuacao_maxima} pts</td>
                      <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">
                        {c.modelo_avaliacao_id
                          ? modelos.find((m) => m.id === c.modelo_avaliacao_id)?.nome || `#${c.modelo_avaliacao_id}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            c.ativo
                              ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                              : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500'
                          }
                        >
                          {c.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => abrirEdicao(c)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Excluir o cargo "${c.nome}"?\n(Se houver servidores vinculados, ele será apenas desativado.)`))
                                excluir.mutate(c.id)
                            }}
                            disabled={excluir.isPending}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-slate-500">
                Exibindo <span className="font-semibold text-slate-800">{startItem}–{endItem}</span> de{' '}
                <span className="font-semibold text-slate-800">{filtrados.length}</span> cargos ·{' '}
                Página <span className="font-semibold text-slate-800">{currentPage}</span> de{' '}
                <span className="font-semibold text-slate-800">{totalPages}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-40">
                  <ChevronsLeft size={16} />
                </button>
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
                  {currentPage}
                </div>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-40">
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Modal de formulário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">{form.id ? 'Editar Cargo' : 'Novo Cargo'}</h3>
              <button type="button" onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <div className="space-y-3">
              {isSuperAdmin && !form.id && (
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Município *</label>
                  <select
                    value={form.municipio_id}
                    onChange={(e) => setForm({ ...form, municipio_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o município</option>
                    {municipios.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-gray-600">Nome do cargo *</label>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Biólogo"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Nível *</label>
                  <select
                    value={form.nivel_id}
                    onChange={(e) => setForm({ ...form, nivel_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o nível</option>
                    {niveis.filter((n) => n.ativo).map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Modelo de avaliação</label>
                  <select
                    value={form.modelo_avaliacao_id}
                    onChange={(e) => setForm({ ...form, modelo_avaliacao_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Nenhum / definir depois</option>
                    {modelos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Pontuação máxima</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.pontuacao_maxima}
                    onChange={(e) => setForm({ ...form, pontuacao_maxima: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Mínimo p/ estágio probatório</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.pontos_min_estagio}
                    onChange={(e) => setForm({ ...form, pontos_min_estagio: e.target.value })}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Mínimo p/ progressão</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.pontos_min_progressao}
                    onChange={(e) => setForm({ ...form, pontos_min_progressao: e.target.value })}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    id="cargo-ativo"
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="cargo-ativo" className="text-sm text-gray-600">
                    Cargo ativo (disponível para vincular a servidores)
                  </label>
                </div>
              </div>

              {/* Pesos por questão */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={incluirPesos}
                    onChange={(e) => setIncluirPesos(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Configurar pesos por questão</span>
                  <span className="text-xs text-gray-400">
                    (peso de cada pergunta usado para ponderar a avaliação)
                  </span>
                </label>

                {incluirPesos && (
                  <div className="mt-3 space-y-2">
                    {!form.id && pesos.length === 0 && (
                      <p className="text-xs text-amber-600">
                        Dica: defina aqui o peso de cada pergunta. Sem pesos, a avaliação usa o peso padrão da pergunta.
                      </p>
                    )}
                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                      {pesos.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-24 text-xs text-gray-500">Pergunta</span>
                          <input
                            type="number"
                            min={1}
                            value={p.numero_pergunta}
                            onChange={(e) => {
                              const v = Number(e.target.value)
                              setPesos((prev) => prev.map((x, i) => (i === idx ? { ...x, numero_pergunta: v } : x)))
                            }}
                            className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="w-12 text-xs text-gray-500">Peso</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={p.peso}
                            onChange={(e) => {
                              const v = Number(e.target.value)
                              setPesos((prev) => prev.map((x, i) => (i === idx ? { ...x, peso: v } : x)))
                            }}
                            className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setPesos((prev) => prev.filter((_, i) => i !== idx))}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-500"
                            title="Remover"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setPesos((prev) => [
                            ...prev,
                            { numero_pergunta: prev.length + 1, peso: 1 },
                          ])
                        }
                        className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        <Plus size={14} /> Adicionar questão
                      </button>
                      <span className="text-xs text-gray-500">
                        {pesos.length} questões · soma dos pesos: <strong>{somaPesos.toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={salvar.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
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
