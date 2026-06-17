import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { avaliacoesService } from '@/services/avaliacoes.service'
import type { FormularioResumo } from '@/types'
import { ClipboardList, Clock, ArrowRight, Loader2 } from 'lucide-react'
import { TIPO_AVALIACAO_LABELS } from '@/utils/formatters'

export default function AvaliacoesPendentes() {
  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ['avaliacoes-pendentes'],
    queryFn: avaliacoesService.pendentes,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Avaliações Pendentes</h1>
        <p className="text-gray-500 mt-1">{avaliacoes.length} avaliações aguardando seu preenchimento</p>
      </div>

      {avaliacoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 rounded-full mb-4">
            <ClipboardList size={28} className="text-green-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-700">Tudo em dia!</h3>
          <p className="text-gray-500 mt-2 text-sm">Não há avaliações pendentes no momento.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {avaliacoes.map((a: FormularioResumo) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                  <ClipboardList size={20} className="text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {a.nome_servidor || `Servidor #${a.servidor_avaliado_id}`}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{TIPO_AVALIACAO_LABELS[a.tipo_avaliacao]}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={12} className="text-yellow-500" />
                    <span className="text-xs text-yellow-600">
                      {a.status === 'PENDENTE' ? 'Não iniciada' : 'Em andamento'}
                    </span>
                  </div>
                </div>
              </div>
              <Link
                to={`/avaliacoes/${a.id}/preencher`}
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
              >
                {a.status === 'PENDENTE' ? 'Iniciar' : 'Continuar'}
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
