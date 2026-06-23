import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { questionariosService, type QuestionarioPreview } from '@/services/questionarios.service'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function PreviewQuestionario() {
  const navigate = useNavigate()
  const { id } = useParams()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['questionario-preview', id],
    queryFn: (): Promise<QuestionarioPreview> => questionariosService.previewModelo(Number(id)),
    enabled: Boolean(id),
  })

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
          Não foi possível carregar o preview do questionário.
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
          <h1 className="text-2xl font-bold text-gray-800">{data.nome}</h1>
          <p className="text-gray-500 text-sm">
            {data.total_perguntas} pergunta(s) • {data.status}
          </p>
        </div>
      </div>

      {data.descricao && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-700">{data.descricao}</p>
        </div>
      )}

      <div className="space-y-4">
        {data.perguntas.map((pergunta) => (
          <div key={pergunta.numero} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {pergunta.numero}
                  </span>
                  <h2 className="font-semibold text-gray-800">{pergunta.texto}</h2>
                </div>
              </div>
              <div className="text-right shrink-0 space-y-2">
                {pergunta.categoria && (
                  <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 shadow-sm">
                    {pergunta.categoria}
                  </div>
                )}
                <div className="text-xs text-gray-500">
                <p>Peso {pergunta.peso}</p>
                </div>
              </div>
            </div>

            {pergunta.opcoes.length > 0 && (
              <div className="space-y-2">
                {pergunta.opcoes.map((opcao) => (
                  <div key={opcao.letra} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded bg-white text-gray-700 font-bold flex items-center justify-center">
                        {opcao.letra}
                      </span>
                      <span className="text-gray-700">{opcao.texto}</span>
                    </div>
                    <span className="text-gray-500">
                      {opcao.pontuacao == null ? '-' : `${opcao.pontuacao} pts`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
