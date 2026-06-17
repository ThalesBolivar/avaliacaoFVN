import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save, Send } from 'lucide-react'
import { avaliacoesService } from '@/services/avaliacoes.service'
import type { FormularioDetalhado, PerguntaFormulario } from '@/types'
import { TIPO_AVALIACAO_LABELS } from '@/utils/formatters'

type RespostaForm = {
  opcao_selecionada?: string
  resposta_numerica?: number
  resposta_texto?: string
}

export default function PreencherAvaliacao() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const formularioId = Number(id)
  const [observacoes, setObservacoes] = useState('')
  const [sugestoes, setSugestoes] = useState('')
  const [usoAlcoolDrogas, setUsoAlcoolDrogas] = useState<boolean | undefined>(undefined)
  const [respostas, setRespostas] = useState<Record<number, RespostaForm>>({})

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
    setUsoAlcoolDrogas(data.uso_alcool_drogas)

    const respostasIniciais: Record<number, RespostaForm> = {}
    data.respostas.forEach((resposta) => {
      respostasIniciais[resposta.pergunta_avaliacao_id] = {
        opcao_selecionada: resposta.opcao_selecionada,
        resposta_numerica: resposta.resposta_numerica,
        resposta_texto: resposta.resposta_texto,
      }
    })
    setRespostas(respostasIniciais)
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
        uso_alcool_drogas: usoAlcoolDrogas,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['avaliacoes-pendentes'] })
      await queryClient.invalidateQueries({ queryKey: ['minhas-avaliacoes'] })
      alert('Rascunho salvo com sucesso.')
    },
  })

  const finalizar = useMutation({
    mutationFn: () =>
      avaliacoesService.finalizar(formularioId, {
        respostas: payloadRespostas,
        observacoes,
        sugestoes_melhoria: sugestoes,
        uso_alcool_drogas: usoAlcoolDrogas,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['avaliacoes-pendentes'] })
      await queryClient.invalidateQueries({ queryKey: ['minhas-avaliacoes'] })
      navigate('/avaliacoes/minhas')
    },
  })

  function atualizarResposta(perguntaId: number, next: RespostaForm) {
    setRespostas((current) => ({
      ...current,
      [perguntaId]: {
        ...current[perguntaId],
        ...next,
      },
    }))
  }

  function validarObrigatorias() {
    if (!data) return false

    for (const pergunta of data.perguntas) {
      if (!pergunta.obrigatoria) continue
      const resposta = respostas[pergunta.id]
      if (!resposta) return false

      if (pergunta.tipo_resposta === 'TEXTO_LIVRE' && !resposta.resposta_texto?.trim()) {
        return false
      }
      if (pergunta.tipo_resposta === 'MULTIPLA_ESCOLHA' && !resposta.opcao_selecionada) {
        return false
      }
      if ((pergunta.tipo_resposta === 'ESCALA_1_5' || pergunta.tipo_resposta === 'SIM_NAO') && resposta.resposta_numerica == null) {
        return false
      }
    }

    return true
  }

  function renderPergunta(pergunta: PerguntaFormulario) {
    const resposta = respostas[pergunta.id] || {}

    if (pergunta.tipo_resposta === 'MULTIPLA_ESCOLHA') {
      return (
        <div className="space-y-2">
          {pergunta.opcoes.map((opcao) => (
            <label key={opcao.letra_opcao} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
              <input
                type="radio"
                name={`pergunta-${pergunta.id}`}
                checked={resposta.opcao_selecionada === opcao.letra_opcao}
                onChange={() =>
                  atualizarResposta(pergunta.id, {
                    opcao_selecionada: opcao.letra_opcao,
                    resposta_numerica: undefined,
                    resposta_texto: undefined,
                  })
                }
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
            <label key={valor} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
              <input
                type="radio"
                name={`pergunta-${pergunta.id}`}
                checked={resposta.resposta_numerica === valor}
                onChange={() =>
                  atualizarResposta(pergunta.id, {
                    resposta_numerica: valor,
                    opcao_selecionada: undefined,
                    resposta_texto: undefined,
                  })
                }
              />
              <span className="text-sm text-gray-700">{valor}</span>
            </label>
          ))}
        </div>
      )
    }

    if (pergunta.tipo_resposta === 'SIM_NAO') {
      return (
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'Sim', value: 1 },
            { label: 'Não', value: 0 },
          ].map((item) => (
            <label key={item.label} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
              <input
                type="radio"
                name={`pergunta-${pergunta.id}`}
                checked={resposta.resposta_numerica === item.value}
                onChange={() =>
                  atualizarResposta(pergunta.id, {
                    resposta_numerica: item.value,
                    opcao_selecionada: undefined,
                    resposta_texto: undefined,
                  })
                }
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
        onChange={(e) =>
          atualizarResposta(pergunta.id, {
            resposta_texto: e.target.value,
            opcao_selecionada: undefined,
            resposta_numerica: undefined,
          })
        }
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
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div className="bg-white rounded-xl border border-red-200 p-6 text-red-600">
          Não foi possível carregar esta avaliação.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{data.nome_servidor || `Servidor #${data.servidor_avaliado_id}`}</h1>
          <p className="text-gray-500 text-sm">{TIPO_AVALIACAO_LABELS[data.tipo_avaliacao]}</p>
        </div>
      </div>

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
              <div className="text-right text-xs text-gray-500">
                <p>Peso {pergunta.peso}</p>
                {pergunta.obrigatoria && <p>Obrigatória</p>}
              </div>
            </div>
            {renderPergunta(pergunta)}
          </div>
        ))}
      </div>

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

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Uso de álcool/drogas</p>
          <div className="flex gap-3">
            {[
              { label: 'Não informado', value: undefined },
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ].map((item) => (
              <label key={item.label} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={usoAlcoolDrogas === item.value}
                  onChange={() => setUsoAlcoolDrogas(item.value)}
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-8">
        <button
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {salvar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar rascunho
        </button>
        <button
          onClick={() => {
            if (!validarObrigatorias()) {
              alert('Preencha todas as perguntas obrigatórias antes de finalizar.')
              return
            }
            if (confirm('Deseja finalizar esta avaliação?')) {
              finalizar.mutate()
            }
          }}
          disabled={finalizar.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
        >
          {finalizar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Finalizar avaliação
        </button>
      </div>
    </div>
  )
}
