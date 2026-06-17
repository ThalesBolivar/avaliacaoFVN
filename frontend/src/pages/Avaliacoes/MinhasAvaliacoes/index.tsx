import { useQuery } from '@tanstack/react-query'
import { avaliacoesService } from '@/services/avaliacoes.service'
import type { FormularioResumo } from '@/types'
import { FileText, Download, Loader2 } from 'lucide-react'
import { formatDateTime, TIPO_AVALIACAO_LABELS, STATUS_LABELS } from '@/utils/formatters'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function MinhasAvaliacoes() {
  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ['minhas-avaliacoes'],
    queryFn: avaliacoesService.minhas,
  })

  async function handleDownload(id: number) {
    const { blob, filename } = await avaliacoesService.baixarPdf(id)
    downloadBlob(blob, filename)
  }

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
        <h1 className="text-2xl font-bold text-gray-800">Minhas Avaliações</h1>
        <p className="text-gray-500 mt-1">Histórico de todas as suas avaliações</p>
      </div>

      {avaliacoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <FileText size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700">Nenhuma avaliação encontrada</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Servidor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Tipo</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Pontuação</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Finalizado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {avaliacoes.map((a: FormularioResumo) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {a.nome_servidor || `Servidor #${a.servidor_avaliado_id}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{TIPO_AVALIACAO_LABELS[a.tipo_avaliacao]}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.status === 'FINALIZADA' ? 'bg-green-100 text-green-700' :
                      a.status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                    {a.pontuacao_total != null ? a.pontuacao_total.toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                    {a.finalizado_em ? formatDateTime(a.finalizado_em) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {a.status === 'FINALIZADA' && (
                        <button
                          onClick={() => handleDownload(a.id)}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                          title="Baixar PDF"
                        >
                          <Download size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
