import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Periodo, Modelo } from '@/types'
import { Plus, Play, Square, Calendar, Loader2 } from 'lucide-react'
import { formatDate, STATUS_LABELS } from '@/utils/formatters'

export default function Periodos() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', data_inicio: '', data_fim: '', modelo_avaliacao_id: '' })

  const { data: periodos = [], isLoading } = useQuery<Periodo[]>({
    queryKey: ['periodos'],
    queryFn: async () => (await api.get('/periodos-avaliacao')).data,
  })

  const { data: modelos = [] } = useQuery<Modelo[]>({
    queryKey: ['questionarios'],
    queryFn: async () => (await api.get('/admin/questionarios')).data,
  })

  const criar = useMutation({
    mutationFn: (data: object) => api.post('/periodos-avaliacao', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['periodos'] }); setShowForm(false) },
  })

  const ativar = useMutation({
    mutationFn: (id: number) => api.post(`/periodos-avaliacao/${id}/ativar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periodos'] }),
  })

  const encerrar = useMutation({
    mutationFn: (id: number) => api.post(`/periodos-avaliacao/${id}/encerrar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periodos'] }),
  })

  const gerarVinculos = useMutation({
    mutationFn: (id: number) => api.post(`/periodos-avaliacao/${id}/vinculos`),
    onSuccess: (response) => {
      const message = response.data?.message || 'Vínculos atualizados com sucesso!'
      alert(message)
      queryClient.invalidateQueries({ queryKey: ['periodos'] })
    },
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
          <p className="text-gray-500 mt-1">Gerencie os ciclos avaliativos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} />
          Novo Período
        </button>
      </div>

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

                <div className="flex gap-2 shrink-0">
                  {p.status === 'PLANEJADO' && (
                    <>
                      <button
                        onClick={() => gerarVinculos.mutate(p.id)}
                        disabled={gerarVinculos.isPending}
                        className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                      >
                        Gerar Vínculos
                      </button>
                      <button
                        onClick={() => ativar.mutate(p.id)}
                        disabled={ativar.isPending}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
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
                        className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                      >
                        Atualizar Vínculos
                      </button>
                      <button
                        onClick={() => { if (confirm('Encerrar este período?')) encerrar.mutate(p.id) }}
                        disabled={encerrar.isPending}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
                  <input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Data Fim *</label>
                  <input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Questionário</label>
                <select
                  value={form.modelo_avaliacao_id}
                  onChange={(e) => setForm({ ...form, modelo_avaliacao_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Selecione (opcional)</option>
                  {modelos.filter((m: Modelo) => m.status === 'PUBLICADO').map((m: Modelo) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">Cancelar</button>
              <button
                onClick={() => criar.mutate({
                  nome: form.nome,
                  data_inicio: form.data_inicio,
                  data_fim: form.data_fim,
                  modelo_avaliacao_id: form.modelo_avaliacao_id ? Number(form.modelo_avaliacao_id) : undefined,
                })}
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
