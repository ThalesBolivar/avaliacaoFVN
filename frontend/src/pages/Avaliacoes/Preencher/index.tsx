import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle, Loader2, Save, Send, X } from 'lucide-react'
import { avaliacoesService } from '@/services/avaliacoes.service'
import type { FormularioDetalhado, PerguntaFormulario } from '@/types'
import { TIPO_AVALIACAO_LABELS } from '@/utils/formatters'

type RespostaForm = {
  opcao_selecionada?: string
  resposta_numerica?: number
  resposta_texto?: string
}

type Toast = { tipo: 'sucesso' | 'erro' | 'aviso'; mensagem: string }

export default function PreencherAvaliacao() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const formularioId = Number(id)

  const [observacoes, setObservacoes] = useState('')
  const [sugestoes, setSugestoes] = useState('')
  const [respostas, setRespostas] = useState<Record<number, RespostaForm>>({})
  const [toast, setToast] = useState<Toast | null>(null)
  const [confirmarFinalizar, setConfirmarFinalizar] = useState(false)

  function showToast(t: Toast) {
    setToast(t)
    setTimeout(() => setToast(null), 4000)
  }

  const { data, isLoading, isError } = useQuery<FormularioDetalhado>({
    queryKey: ['avaliacao', formularioId],
    queryFn: async () => {
      await avaliacoesService.iniciar(formularioId)
      return avaliacoesService.carregar(formularioId)
    },
    enabled: Number.isFinite(formularioId),
  })

  useEffect(() => {
    if (!data) return
    setObservacoes(data.observacoes || '')
    setSugestoes(data.sugestoes_melhoria || '')
    const iniciais: Record<number, RespostaForm> = {}
    data.respostas.forEach((r) => {
      iniciais[r.pergunta_avaliacao_id] = {
        opcao_selecionada: r.opcao_selecionada,
        resposta_numerica: r.resposta_numerica,
        resposta_texto: r.resposta_texto,
      }
    })
    setRespostas(iniciais)
  }, [data])

  const payloadRespostas = useMemo(
    () =>
      Object.entries(respostas).map(([perguntaId, resposta]) => ({
        pergunta_avaliacao_id: Number(perguntaId),
        ...resposta,
      })),
    [respostas]
  )

  const salvar = useMutation({
    mutationFn: () =>
      avaliacoesService.salvar(formularioId, {
        respostas: payloadRespostas,
        observacoes,
        sugestoes_melhoria: sugestoes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['avaliacoes-pendentes'] })
      showToast({ tipo: 'sucesso', mensagem: 'Rascunho salvo com sucesso.' })
    },
    onError: () => showToast({ tipo: 'erro', mensagem: 'Não foi possível salvar. Tente novamente.' }),
  })

  const finalizar = useMutation({
    mutationFn: () =>
      avaliacoesService.finalizar(formularioId, {
        respostas: payloadRespostas,
        observacoes,
        sugestoes_melhoria: sugestoes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['avaliacoes-pendentes'] })
      await queryClient.invalidateQueries({ queryKey: ['minhas-avaliacoes'] })
      navigate('/avaliacoes/minhas')
    },
    onError: () => {
      setConfirmarFinalizar(false)
      showToast({ tipo: 'erro', mensagem: 'Não foi possível finalizar. Tente novamente.' })
    },
  })

  function perguntasFaltando(): string[] {
    if (!data) return []
    return data.perguntas
      .filter((p) => {
        if (!p.obrigatoria) return false
        const r = respostas[p.id]
        if (!r) return true
        if (p.tipo_resposta === 'TEXTO_LIVRE') return !r.resposta_texto?.trim()
        if (p.tipo_resposta === 'MULTIPLA_ESCOLHA') return !r.opcao_selecionada
        return r.resposta_numerica == null
      })
      .map((p) => `${p.numero_pergunta}. ${p.criterio}`)
  }

  function tentarFinalizar() {
    const faltando = perguntasFaltando()
    if (faltando.length > 0) {
      showToast({
        tipo: 'aviso',
        mensagem: `Preencha ${faltando.length === 1 ? 'a pergunta obrigatória' : `as ${faltando.length} perguntas obrigatórias`} antes de finalizar.`,
      })
      return
    }
    setConfirmarFinalizar(true)
  }

  function atualizarResposta(perguntaId: number, next: RespostaForm) {
    setRespostas((cur) => ({ ...cur, [perguntaId]: { ...cur[perguntaId], ...next } }))
  }

  function renderPergunta(pergunta: PerguntaFormulario) {
    const resposta = respostas[pergunta.id] || {}

    if (pergunta.tipo_resposta === 'MULTIPLA_ESCOLHA') {
      return (
        <div className="space-y-2">
          {pergunta.opcoes.map((opcao) => (
            <label key={opcao.letra_opcao} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition">
              <input
                type="radio"
                name={`pergunta-${pergunta.id}`}
                checked={resposta.opcao_selecionada === opcao.letra_opcao}
                onChange={() => atualizarResposta(pergunta.id, { opcao_selecionada: opcao.letra_opcao, resposta_numerica: undefined, resposta_texto: undefined })}
              />
              <span className="text-sm text-gray-700">{opcao.texto_opcao}</span>
            </label>
          ))}
        </div>
      )
    }

    if (pergunta.tipo_resposta === 'ESCALA_1_5') {
      return (
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((valor) => (
            <label key={valor} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition">
              <input
                type="radio"
                name={`pergunta-${pergunta.id}`}
                checked={resposta.resposta_numerica === valor}
                onChange={() => atualizarResposta(pergunta.id, { resposta_numerica: valor, opcao_selecionada: undefined, resposta_texto: undefined })}
              />
              <span className="text-sm text-gray-700 font-medium">{valor}</span>
            </label>
          ))}
        </div>
      )
    }

    if (pergunta.tipo_resposta === 'SIM_NAO') {
      return (
        <div className="flex gap-2">
          {[{ label: 'Sim', value: 1 }, { label: 'Não', value: 0 }].map((item) => (
            <label key={item.label} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition">
              <input
                type="radio"
                name={`pergunta-${pergunta.id}`}
                checked={resposta.resposta_numerica === item.value}
                onChange={() => atualizarResposta(pergunta.id, { resposta_numerica: item.value, opcao_selecionada: undefined, resposta_texto: undefined })}
              />
              <span className="text-sm text-gray-700">{item.label}</span>
            </label>
          ))}
        </div>
      )
    }

    return (
      <textarea
        value={resposta.resposta_texto || ''}
        onChange={(e) => atualizarResposta(pergunta.id, { resposta_texto: e.target.value, opcao_selecionada: undefined, resposta_numerica: undefined })}
        rows={4}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Digite sua resposta"
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-4 p-6">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="bg-white rounded-xl border border-red-200 p-6 text-red-600">
          Não foi possível carregar esta avaliação.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-start gap-3 rounded-xl shadow-lg px-4 py-3 max-w-sm transition-all ${
          toast.tipo === 'sucesso' ? 'bg-green-50 border border-green-200 text-green-800' :
          toast.tipo === 'aviso'  ? 'bg-amber-50 border border-amber-200 text-amber-800' :
                                    'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {toast.tipo === 'sucesso' && <CheckCircle size={18} className="mt-0.5 shrink-0 text-green-600" />}
          {toast.tipo === 'aviso'  && <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />}
          {toast.tipo === 'erro'   && <X size={18} className="mt-0.5 shrink-0 text-red-600" />}
          <p className="text-sm font-medium">{toast.mensagem}</p>
          <button onClick={() => setToast(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Modal confirmar finalizar */}
      {confirmarFinalizar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Send size={18} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Finalizar avaliação?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Após finalizar, a avaliação não poderá ser editada. Tem certeza que deseja continuar?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmarFinalizar(false)}
                disabled={finalizar.isPending}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => finalizar.mutate()}
                disabled={finalizar.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-60 transition"
              >
                {finalizar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{data.nome_servidor || `Servidor #${data.servidor_avaliado_id}`}</h1>
          <p className="text-gray-500 text-sm">{TIPO_AVALIACAO_LABELS[data.tipo_avaliacao]}</p>
        </div>
      </div>

      {/* Perguntas */}
      <div className="space-y-4">
        {data.perguntas.map((pergunta) => (
          <div key={pergunta.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {pergunta.numero_pergunta}
                  </span>
                  <h2 className="font-semibold text-gray-800">{pergunta.criterio}</h2>
                </div>
                <p className="text-gray-700">{pergunta.texto_pergunta}</p>
              </div>
              {pergunta.obrigatoria && (
                <span className="shrink-0 text-xs text-red-500 font-medium mt-1">Obrigatória</span>
              )}
            </div>
            {renderPergunta(pergunta)}
          </div>
        ))}
      </div>

      {/* Campos extras */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Observações gerais"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sugestões de melhoria</label>
          <textarea
            value={sugestoes}
            onChange={(e) => setSugestoes(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Sugestões de melhoria"
          />
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-3 pb-8">
        <button
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition"
        >
          {salvar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar rascunho
        </button>
        <button
          onClick={tentarFinalizar}
          disabled={finalizar.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition"
        >
          {finalizar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Finalizar avaliação
        </button>
      </div>
    </div>
  )
}
