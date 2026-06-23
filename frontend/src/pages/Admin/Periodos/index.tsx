import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Periodo, Modelo, NivelCargoItem } from '@/types'
import { niveisCargosService } from '@/services/niveis-cargo.service'
import { Plus, Play, Square, Calendar, Loader2, Settings2, CheckCircle2 } from 'lucide-react'
import { formatDate, STATUS_LABELS } from '@/utils/formatters'

export default function Periodos() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showNiveis, setShowNiveis] = useState(false)
  const [form, setForm] = useState({ nome: '', data_inicio: '', data_fim: '' })
  const [nivelModelos, setNivelModelos] = useState<Record<number, string>>({})
  const [nivelSalvo, setNivelSalvo] = useState<Record<number, boolean>>({})

  const { data: periodos = [], isLoading } = useQuery<Periodo[]>({
    queryKey: ['periodos'],
    queryFn: async () => (await api.get('/periodos-avaliacao')).data,
  })

  const { data: modelos = [] } = useQuery<Modelo[]>({
    queryKey: ['questionarios'],
    queryFn: async () => (await api.get('/admin/questionarios')).data,
  })

  const publicados = modelos.filter((m: Modelo) => m.status === 'PUBLICADO')

  const { data: niveis = [] } = useQuery<NivelCargoItem[]>({
    queryKey: ['niveis-cargo'],
    queryFn: niveisCargosService.listar,
    enabled: showNiveis,
  })

  const criar = useMutation({
    mutationFn: (data: object) => api.post('/periodos-avaliacao', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['periodos'] }); setShowForm(false) },
    onError: () => alert('Erro ao criar período.'),
  })

  const ativar = useMutation({
    mutationFn: (id: number) => api.post(`/periodos-avaliacao/${id}/ativar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periodos'] }),
    onError: () => alert('Erro ao ativar período.'),
  })

  const encerrar = useMutation({
    mutationFn: (id: number) => api.post(`/periodos-avaliacao/${id}/encerrar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periodos'] }),
    onError: () => alert('Erro ao encerrar período.'),
  })

  const gerarVinculos = useMutation({
    mutationFn: (id: number) => api.post(`/periodos-avaliacao/${id}/vinculos`),
    onSuccess: (resp) => {
      const d = resp.data
      let msg = d?.message || 'Vínculos criados com sucesso!'
      if (d?.pulados > 0) msg += `\n\n⚠️ ${d.pulados} servidor(es) ignorado(s) — verifique se todos os cargos têm questionário vinculado.`
      alert(msg)
      queryClient.invalidateQueries({ queryKey: ['periodos'] })
    },
    onError: () => alert('Erro ao gerar vínculos.'),
  })

  const vincularNivel = useMutation({
    mutationFn: ({ nivel_id, modelo_avaliacao_id }: { nivel_id: number; modelo_avaliacao_id: number | null }) =>
      api.post('/cargos/vincular-por-nivel', { nivel_id, modelo_avaliacao_id }),
    onSuccess: (_, vars) => {
      setNivelSalvo((prev) => ({ ...prev, [vars.nivel_id]: true }))
      setTimeout(() => setNivelSalvo((prev) => ({ ...prev, [vars.nivel_id]: false })), 2000)
    },
    onError: () => alert('Erro ao vincular nível ao questionário.'),
  })

  const STATUS_COLORS: Record<string, string> = {
    PLANEJADO: 'bg-yellow-100 text-yellow-800',
    ATIVO: 'bg-green-100 text-green-800',
    ENCERRADO: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Períodos de Avaliação</h1>
          <p className="text-gray-500 mt-1">Gerencie os ciclos avaliativos do município</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNiveis(!showNiveis)}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Settings2 size={16} />
            Configurar Níveis
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus size={16} />
            Novo Período
          </button>
        </div>
      </div>

      {/* Configuração de Níveis */}
      {showNiveis && (
        <div className="bg-white rounded-xl border border-blue-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Vincular Questionário por Nível de Cargo</h3>
          <p className="text-sm text-gray-500 mb-4">
            Defina qual questionário será usado para cada nível. Ao gerar vínculos, o sistema atribuirá automaticamente o questionário correto a cada servidor.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {niveis.filter((n) => n.ativo).map((n) => (
              <div key={n.id} className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-2">{n.label}</p>
                <select
                  value={nivelModelos[n.id] ?? ''}
                  onChange={(e) => setNivelModelos((prev) => ({ ...prev, [n.id]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                >
                  <option value="">Nenhum</option>
                  {publicados.map((m: Modelo) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
                <button
                  onClick={() => vincularNivel.mutate({
                    nivel_id: n.id,
                    modelo_avaliacao_id: nivelModelos[n.id] ? Number(nivelModelos[n.id]) : null,
                  })}
                  disabled={vincularNivel.isPending}
                  className="w-full flex items-center justify-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {nivelSalvo[n.id]
                    ? <><CheckCircle2 size={13} /> Salvo!</>
                    : vincularNivel.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid gap-4">
          {periodos.map((p: Periodo) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <Calendar size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800">{p.nome}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(p.data_inicio)} até {formatDate(p.data_fim)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 flex-wrap">
                  {p.status === 'PLANEJADO' && (
                    <>
                      <button
                        onClick={() => gerarVinculos.mutate(p.id)}
                        disabled={gerarVinculos.isPending}
                        className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                      >
                        {gerarVinculos.isPending ? <Loader2 size={12} className="animate-spin inline" /> : 'Gerar Vínculos'}
                      </button>
                      <button
                        onClick={() => { if (confirm('Ativar este período? Os formulários serão gerados para todos os servidores.')) ativar.mutate(p.id) }}
                        disabled={ativar.isPending}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
                      >
                        <Play size={12} />
                        Ativar
                      </button>
                    </>
                  )}
                  {p.status === 'ATIVO' && (
                    <>
                      <button
                        onClick={() => gerarVinculos.mutate(p.id)}
                        disabled={gerarVinculos.isPending}
                        className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                      >
                        Atualizar Vínculos
                      </button>
                      <button
                        onClick={() => { if (confirm('Encerrar este período?')) encerrar.mutate(p.id) }}
                        disabled={encerrar.isPending}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                      >
                        <Square size={12} />
                        Encerrar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {periodos.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-400">Nenhum período criado</p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Novo Período</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nome *</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Avaliação 1º Semestre 2025"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Data Início *</label>
                  <input type="date" value={form.data_inicio}
                    onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Data Fim *</label>
                  <input type="date" value={form.data_fim}
                    onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                O questionário de cada servidor será definido automaticamente pelo nível do cargo dele.
                Configure os vínculos de nível em <strong>"Configurar Níveis"</strong> antes de gerar os vínculos do período.
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">
                Cancelar
              </button>
              <button
                onClick={() => criar.mutate({ nome: form.nome, data_inicio: form.data_inicio, data_fim: form.data_fim })}
                disabled={criar.isPending || !form.nome || !form.data_inicio || !form.data_fim}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {criar.isPending && <Loader2 size={14} className="animate-spin" />}
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
