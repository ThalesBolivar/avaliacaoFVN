import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import api from '@/services/api'
import { servidoresService } from '@/services/servidores.service'
import { useAuthStore } from '@/store/auth.store'
import type { FuncaoUsuario, Servidor } from '@/types'
import { Link2, Loader2, Search, X, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

interface VinculoServidor {
  id: number
  funcao_usuario_id: number
  nome: string
  criado_em: string
}

interface ServidorComFuncoes extends Servidor {
  funcoes?: VinculoServidor[]
}

export default function ServidorFuncoes() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [showModal, setShowModal] = useState(false)
  const [busca, setBusca] = useState('')
  const [servidorSelecionado, setServidorSelecionado] = useState<Servidor | null>(null)
  const [funcaoId, setFuncaoId] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [buscaLista, setBuscaLista] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const { data: servidores = [], isLoading } = useQuery<Servidor[]>({
    queryKey: ['servidores-funcoes-lista'],
    queryFn: () => servidoresService.listar(true),
  })

  const { data: funcoes = [] } = useQuery<FuncaoUsuario[]>({
    queryKey: ['funcoes-usuario-vinculos', user?.municipio_id],
    queryFn: async () => {
      const mid = user?.municipio_id
      return (await api.get(`/funcoes-usuario?ativo=true${mid ? `&municipio_id=${mid}` : ''}`)).data
    },
  })

  // Busca as funções de cada servidor (lazy, só quando necessário via map)
  const { data: todosVinculos = {} } = useQuery<Record<number, VinculoServidor[]>>({
    queryKey: ['todos-vinculos-servidor'],
    queryFn: async () => {
      const result: Record<number, VinculoServidor[]> = {}
      // Busca servidores que têm vínculos via endpoint listagem
      const resp = await api.get<{ servidor_id: number; funcao_usuario_id: number; nome: string; criado_em: string; id: number }[]>(
        '/servidores/funcoes/todos'
      )
      for (const v of resp.data) {
        if (!result[v.servidor_id]) result[v.servidor_id] = []
        result[v.servidor_id].push(v)
      }
      return result
    },
  })

  const servidoresFiltradosModal = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return servidores
    return servidores.filter(
      (s) => s.nome.toLowerCase().includes(q) || s.matricula.toLowerCase().includes(q),
    )
  }, [servidores, busca])

  const servidoresComVinculo = useMemo(() => {
    return servidores.filter((s) => todosVinculos[s.id]?.length > 0)
  }, [servidores, todosVinculos])

  const servidoresFiltradosLista = useMemo(() => {
    const q = buscaLista.trim().toLowerCase()
    if (!q) return servidoresComVinculo
    return servidoresComVinculo.filter(
      (s) =>
        s.nome.toLowerCase().includes(q) ||
        s.matricula.toLowerCase().includes(q) ||
        todosVinculos[s.id]?.some((v) => v.nome.toLowerCase().includes(q)),
    )
  }, [servidoresComVinculo, buscaLista, todosVinculos])

  const totalPages = Math.max(1, Math.ceil(servidoresFiltradosLista.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const servidoresPaginados = servidoresFiltradosLista.slice((page - 1) * pageSize, page * pageSize)

  const vincular = useMutation({
    mutationFn: ({ servidorId, fId }: { servidorId: number; fId: number }) =>
      servidoresService.vincularFuncao(servidorId, fId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos-vinculos-servidor'] })
      setSucesso('Vínculo criado com sucesso!')
      setFuncaoId('')
      setErro('')
      setTimeout(() => setSucesso(''), 2500)
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        if (typeof detail === 'string') { setErro(detail); return }
      }
      setErro('Não foi possível criar o vínculo.')
    },
  })

  const desvincular = useMutation({
    mutationFn: ({ servidorId, vinculoId }: { servidorId: number; vinculoId: number }) =>
      servidoresService.desvincularFuncao(servidorId, vinculoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos-vinculos-servidor'] })
    },
  })

  const handleVincular = () => {
    if (!servidorSelecionado) { setErro('Selecione um servidor.'); return }
    if (!funcaoId) { setErro('Selecione uma função.'); return }
    setErro('')
    vincular.mutate({ servidorId: servidorSelecionado.id, fId: Number(funcaoId) })
  }

  const abrirModal = () => {
    setBusca('')
    setServidorSelecionado(null)
    setFuncaoId('')
    setErro('')
    setSucesso('')
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Etapa 3 · Vínculos</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Servidor × Função</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Indique quais servidores compõem cada função (Chefia, Comissão Fundamental, etc.).
              O servidor continua sendo SERVIDOR — a função é um papel adicional dentro da avaliação.
            </p>
          </div>
          <button
            onClick={abrirModal}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Link2 size={16} />
            Vincular Servidor à Função
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={buscaLista}
                onChange={(e) => { setBuscaLista(e.target.value); setCurrentPage(1) }}
                placeholder="Buscar por nome, matrícula ou função..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-600 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} por página</option>)}
            </select>
            <span className="text-sm text-slate-500">
              {servidoresFiltradosLista.length} servidor{servidoresFiltradosLista.length !== 1 ? 'es' : ''} vinculado{servidoresFiltradosLista.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : servidoresFiltradosLista.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-medium text-slate-500">Nenhum vínculo cadastrado ainda.</p>
            <p className="mt-1 text-xs text-slate-400">Clique em "Vincular Servidor à Função" para começar.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {servidoresPaginados.map((s) => (
              <div key={s.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                  <p className="text-xs text-slate-400">
                    Mat. {s.matricula}{s.cargo ? ` · ${s.cargo}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(todosVinculos[s.id] || []).map((v) => (
                    <span
                      key={v.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                      {v.nome}
                      <button
                        onClick={() => desvincular.mutate({ servidorId: s.id, vinculoId: v.id })}
                        className="ml-0.5 rounded-full p-0.5 text-blue-400 transition hover:bg-blue-200 hover:text-blue-700"
                        title="Remover vínculo"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {servidoresFiltradosLista.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
            <span>{servidoresFiltradosLista.length} servidor{servidoresFiltradosLista.length !== 1 ? 'es' : ''}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={page === 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsLeft size={15} /></button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={15} /></button>
              <span className="px-3">Página {page} de {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={15} /></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={page === totalPages} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsRight size={15} /></button>
            </div>
          </div>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Vincular Servidor à Função</h3>
                <p className="mt-1 text-sm text-slate-500">Um servidor pode participar de várias funções.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Servidor</label>
                {servidorSelecionado ? (
                  <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-blue-800">{servidorSelecionado.nome}</p>
                      <p className="text-xs text-blue-600">Mat. {servidorSelecionado.matricula}</p>
                    </div>
                    <button
                      onClick={() => { setServidorSelecionado(null); setBusca('') }}
                      className="rounded-lg p-1 text-blue-400 hover:text-blue-700"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por nome ou matrícula..."
                        className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                    {busca && (
                      <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                        {servidoresFiltradosModal.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-slate-400">Nenhum servidor encontrado.</p>
                        ) : (
                          servidoresFiltradosModal.slice(0, 20).map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => { setServidorSelecionado(s); setBusca('') }}
                              className="w-full px-3 py-2 text-left text-sm transition hover:bg-blue-50"
                            >
                              <span className="font-medium text-slate-800">{s.nome}</span>
                              <span className="ml-2 text-xs text-slate-400">Mat. {s.matricula}</span>
                              {s.cargo && <span className="ml-1 text-xs text-slate-400">· {s.cargo}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Função *</label>
                <select
                  value={funcaoId}
                  onChange={(e) => setFuncaoId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione a função</option>
                  {funcoes.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>

              {erro && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</div>
              )}
              {sucesso && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{sucesso}</div>
              )}
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                onClick={handleVincular}
                disabled={vincular.isPending || !servidorSelecionado || !funcaoId}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-60 transition hover:bg-blue-700"
              >
                {vincular.isPending && <Loader2 size={14} className="animate-spin" />}
                <Link2 size={14} />
                Vincular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
