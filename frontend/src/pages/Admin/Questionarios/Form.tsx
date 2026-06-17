import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionariosService, type ModeloPayload, type PerguntaPayload } from '@/services/questionarios.service'
import type { Categoria, Modelo, Pergunta, TipoResposta } from '@/types'
import {
  ArrowLeft, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Loader2, Save,
} from 'lucide-react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableItem({ pergunta, onRemove, onUpdate, categorias }: {
  pergunta: Pergunta
  onRemove: (id: number) => void
  onUpdate: (id: number, field: string, value: unknown) => void
  categorias: Categoria[]
}) {
  const [expanded, setExpanded] = useState(true)
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: pergunta.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center gap-2 p-4">
        <span {...attributes} {...listeners} className="cursor-grab p-1 text-gray-400 hover:text-gray-600 touch-none">
          <GripVertical size={16} />
        </span>
        <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
          {pergunta.numero_pergunta}
        </span>
        <input
          value={pergunta.criterio}
          onChange={(e) => onUpdate(pergunta.id, 'criterio', e.target.value)}
          className="flex-1 text-sm font-medium text-gray-800 bg-transparent border-none outline-none min-w-0"
          placeholder="Critério (ex: Assiduidade)"
        />
        <button type="button" onClick={() => setExpanded(!expanded)} className="p-1 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button type="button" onClick={() => onRemove(pergunta.id)} className="p-1 text-gray-400 hover:text-red-500">
          <Trash2 size={16} />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <textarea
            value={pergunta.texto_pergunta}
            onChange={(e) => onUpdate(pergunta.id, 'texto_pergunta', e.target.value)}
            rows={2}
            placeholder="Texto da pergunta..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select
                value={pergunta.tipo_resposta}
                onChange={(e) => onUpdate(pergunta.id, 'tipo_resposta', e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
              >
                <option value="MULTIPLA_ESCOLHA">Múltipla Escolha</option>
                <option value="ESCALA_1_5">Escala 1-5</option>
                <option value="SIM_NAO">Sim/Não</option>
                <option value="TEXTO_LIVRE">Texto Livre</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Peso</label>
              <input
                type="number"
                min="0.5"
                max="5"
                step="0.5"
                value={pergunta.peso}
                onChange={(e) => onUpdate(pergunta.id, 'peso', parseFloat(e.target.value))}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
              <select
                value={pergunta.categoria_id || ''}
                onChange={(e) => onUpdate(pergunta.id, 'categoria_id', e.target.value ? Number(e.target.value) : null)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {pergunta.tipo_resposta === 'MULTIPLA_ESCOLHA' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Alternativas</p>
              {(['A', 'B', 'C', 'D'] as const).map((letra) => {
                const opcao = pergunta.opcoes.find((o) => o.letra_opcao === letra)
                return (
                  <div key={letra} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0">
                      {letra}
                    </span>
                    <input
                      value={opcao?.texto_opcao || ''}
                      onChange={(e) => onUpdate(pergunta.id, `opcao_${letra}_texto`, e.target.value)}
                      placeholder={`Texto da opção ${letra}`}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                    />
                    <input
                      type="number"
                      value={opcao?.pontuacao ?? ''}
                      onChange={(e) => onUpdate(
                        pergunta.id,
                        `opcao_${letra}_pontuacao`,
                        e.target.value === '' ? undefined : parseFloat(e.target.value)
                      )}
                      placeholder="Pts"
                      className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

let tempId = -1

function normalizePerguntas(perguntas: Pergunta[] = []): Pergunta[] {
  return [...perguntas]
    .sort((a, b) => a.numero_pergunta - b.numero_pergunta)
    .map((pergunta) => ({
      ...pergunta,
      peso: Number(pergunta.peso),
      opcoes: (pergunta.opcoes || []).map((opcao) => ({
        ...opcao,
        pontuacao: opcao.pontuacao == null ? undefined : Number(opcao.pontuacao),
      })),
    }))
}

function buildPerguntaPayload(pergunta: Pergunta): PerguntaPayload {
  const textoPergunta = pergunta.texto_pergunta.trim()
  const criterio = pergunta.criterio.trim() || textoPergunta.slice(0, 150)

  return {
    criterio,
    numero_pergunta: pergunta.numero_pergunta,
    texto_pergunta: textoPergunta,
    tipo_resposta: pergunta.tipo_resposta,
    peso: Number(pergunta.peso) || 1,
    obrigatoria: pergunta.obrigatoria,
    categoria_id: pergunta.categoria_id,
    apenas_autoavaliacao: pergunta.apenas_autoavaliacao,
    apenas_superior: pergunta.apenas_superior,
    apenas_subcomissao: pergunta.apenas_subcomissao,
    opcoes: pergunta.tipo_resposta === 'MULTIPLA_ESCOLHA'
      ? pergunta.opcoes
        .filter((opcao) => opcao.texto_opcao.trim())
        .map((opcao) => ({
          letra_opcao: opcao.letra_opcao,
          texto_opcao: opcao.texto_opcao.trim(),
          pontuacao: opcao.pontuacao,
        }))
      : [],
  }
}

function getPerguntasPreenchidas(perguntas: Pergunta[]): Pergunta[] {
  return perguntas
    .filter((pergunta) => pergunta.texto_pergunta.trim())
    .map((pergunta, index) => ({
      ...pergunta,
      numero_pergunta: index + 1,
    }))
}

function buildModeloPayload({
  nome,
  descricao,
  paraAuto,
  paraSuperior,
  paraSub,
  perguntas,
}: {
  nome: string
  descricao: string
  paraAuto: boolean
  paraSuperior: boolean
  paraSub: boolean
  perguntas: Pergunta[]
}): ModeloPayload {
  const perguntasPreenchidas = getPerguntasPreenchidas(perguntas)
  return {
    nome: nome.trim(),
    descricao: descricao.trim() || undefined,
    para_autoavaliacao: paraAuto,
    para_superior_imediato: paraSuperior,
    para_subcomissao: paraSub,
    perguntas: perguntasPreenchidas.map(buildPerguntaPayload),
  }
}

export default function QuestionarioForm({
  modelId,
  mode,
}: {
  modelId?: number
  mode: 'create' | 'edit'
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = mode === 'edit'

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [paraAuto, setParaAuto] = useState(true)
  const [paraSuperior, setParaSuperior] = useState(true)
  const [paraSub, setParaSub] = useState(true)
  const [perguntas, setPerguntas] = useState<Pergunta[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(isEdit)

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: questionariosService.listarCategorias,
  })

  const criarMutation = useMutation({
    mutationFn: (data: ModeloPayload) => questionariosService.criarModelo(data),
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!isEdit || !modelId) return

    let active = true
    setLoadingInitial(true)

    questionariosService.detalharModelo(modelId)
      .then((modelo) => {
        if (!active) return
        setNome(modelo.nome)
        setDescricao(modelo.descricao || '')
        setParaAuto(modelo.para_autoavaliacao)
        setParaSuperior(modelo.para_superior_imediato)
        setParaSub(modelo.para_subcomissao)
        setPerguntas(normalizePerguntas(modelo.perguntas))
      })
      .catch((error) => {
        console.error(error)
        alert('Erro ao carregar o questionário para edição.')
        navigate('/admin/questionarios', { replace: true })
      })
      .finally(() => {
        if (active) setLoadingInitial(false)
      })

    return () => {
      active = false
    }
  }, [isEdit, modelId, navigate])

  function addPergunta() {
    const novaPergunta: Pergunta = {
      id: tempId--,
      modelo_avaliacao_id: modelId || 0,
      criterio: '',
      numero_pergunta: perguntas.length + 1,
      texto_pergunta: '',
      tipo_resposta: 'MULTIPLA_ESCOLHA',
      peso: 1,
      obrigatoria: true,
      apenas_autoavaliacao: false,
      apenas_superior: false,
      apenas_subcomissao: false,
      ativa: true,
      opcoes: [],
    }
    setPerguntas((current) => [...current, novaPergunta])
  }

  function removePergunta(id: number) {
    setPerguntas((current) => current
      .filter((pergunta) => pergunta.id !== id)
      .map((pergunta, index) => ({ ...pergunta, numero_pergunta: index + 1 })))
  }

  function updatePergunta(id: number, field: string, value: unknown) {
    setPerguntas((current) => current.map((pergunta) => {
      if (pergunta.id !== id) return pergunta

      if (field.startsWith('opcao_')) {
        const [, letra, prop] = field.split('_')
        const optionField = prop === 'texto' ? 'texto_opcao' : 'pontuacao'
        const opcoes = [...pergunta.opcoes]
        const idx = opcoes.findIndex((opcao) => opcao.letra_opcao === letra)

        if (idx >= 0) {
          opcoes[idx] = { ...opcoes[idx], [optionField]: value }
        } else {
          opcoes.push({
            id: tempId--,
            letra_opcao: letra as 'A',
            texto_opcao: '',
            pontuacao: undefined,
            [optionField]: value,
          })
        }

        return { ...pergunta, opcoes }
      }

      if (field === 'tipo_resposta') {
        const nextType = value as TipoResposta
        return {
          ...pergunta,
          tipo_resposta: nextType,
          opcoes: nextType === 'MULTIPLA_ESCOLHA' ? pergunta.opcoes : [],
        }
      }

      return { ...pergunta, [field]: value }
    }))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = perguntas.findIndex((pergunta) => pergunta.id === active.id)
      const newIndex = perguntas.findIndex((pergunta) => pergunta.id === over.id)
      const reordered = arrayMove(perguntas, oldIndex, newIndex).map((pergunta, index) => ({
        ...pergunta,
        numero_pergunta: index + 1,
      }))
      setPerguntas(reordered)
    }
  }

  async function handleSave() {
    if (!nome.trim()) {
      alert('Informe o nome do questionário.')
      return
    }

    if (getPerguntasPreenchidas(perguntas).length === 0) {
      alert('Adicione ao menos uma pergunta com texto para salvar o questionário.')
      return
    }

    setSaving(true)
    try {
      const payload = buildModeloPayload({
        nome,
        descricao,
        paraAuto,
        paraSuperior,
        paraSub,
        perguntas,
      })

      if (isEdit && modelId) {
        await questionariosService.atualizarModelo(modelId, payload)
      } else {
        await criarMutation.mutateAsync(payload)
      }

      await queryClient.invalidateQueries({ queryKey: ['questionarios'] })
      navigate('/admin/questionarios')
    } catch (error) {
      console.error(error)
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || (error instanceof Error ? error.message : 'Erro ao salvar o questionário'))
    } finally {
      setSaving(false)
    }
  }

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEdit ? 'Editar Questionário' : 'Novo Questionário'}
          </h1>
          <p className="text-gray-500 text-sm">Configure o modelo de avaliação</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Questionário *</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Avaliação de Desempenho 2025"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            placeholder="Descrição opcional..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Aplicar para:</p>
          <div className="flex gap-4 flex-wrap">
            {[
              { label: 'Autoavaliação', val: paraAuto, set: setParaAuto },
              { label: 'Superior Imediato', val: paraSuperior, set: setParaSuperior },
              { label: 'Subcomissão', val: paraSub, set: setParaSub },
            ].map(({ label, val, set }) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => set(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Perguntas ({perguntas.length})
          </h2>
          <button
            onClick={addPergunta}
            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Adicionar Pergunta
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={perguntas.map((pergunta) => pergunta.id)} strategy={verticalListSortingStrategy}>
            {perguntas.map((pergunta) => (
              <SortableItem
                key={pergunta.id}
                pergunta={pergunta}
                onRemove={removePergunta}
                onUpdate={updatePergunta}
                categorias={categorias}
              />
            ))}
          </SortableContext>
        </DndContext>

        {perguntas.length === 0 && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
            <p>Clique em "Adicionar Pergunta" para começar</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pb-8">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Salvando...' : 'Salvar Questionário'}
        </button>
      </div>
    </div>
  )
}
