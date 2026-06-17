import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionariosService } from '@/services/questionarios.service'
import type { Modelo } from '@/types'
import { Plus, Copy, Eye, Trash2, CheckCircle, Archive, Edit, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/utils/formatters'

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'bg-yellow-100 text-yellow-800',
  PUBLICADO: 'bg-green-100 text-green-800',
  ARQUIVADO: 'bg-gray-100 text-gray-600',
}

export default function Questionarios() {
  const queryClient = useQueryClient()
  const [confirmPublicar, setConfirmPublicar] = useState<Modelo | null>(null)

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ['questionarios'],
    queryFn: questionariosService.listarModelos,
  })

  const publicar = useMutation({
    mutationFn: (id: number) => questionariosService.publicarModelo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionarios'] })
      setConfirmPublicar(null)
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Erro ao publicar o questionário.')
    },
  })

  const clonar = useMutation({
    mutationFn: (id: number) => questionariosService.clonarModelo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questionarios'] }),
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Erro ao clonar o questionário.')
    },
  })

  const deletar = useMutation({
    mutationFn: (id: number) => questionariosService.deletarModelo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questionarios'] }),
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Erro ao excluir o questionário.')
    },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Questionários</h1>
          <p className="text-gray-500 mt-1">Gerencie os modelos de avaliação do seu município</p>
        </div>
        <Link
          to="/admin/questionarios/novo"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Novo Questionário
        </Link>
      </div>

      {modelos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Plus size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700">Nenhum questionário criado</h3>
          <p className="text-gray-500 mt-2 mb-6 text-sm">
            Crie o primeiro questionário de avaliação para o seu município
          </p>
          <Link
            to="/admin/questionarios/novo"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium"
          >
            <Plus size={16} />
            Criar Questionário
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {modelos.map((modelo) => (
            <div key={modelo.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800">{modelo.nome}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[modelo.status]}`}>
                      {modelo.status}
                    </span>
                    <span className="text-xs text-gray-400">v{modelo.versao}</span>
                  </div>
                  {modelo.descricao && (
                    <p className="text-sm text-gray-500 mt-1 truncate">{modelo.descricao}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{modelo.total_perguntas} perguntas</span>
                    {modelo.pontuacao_maxima && <span>Pontuação máx: {modelo.pontuacao_maxima}</span>}
                    <span>Criado em {formatDateTime(modelo.criado_em)}</span>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap text-xs">
                    {modelo.para_autoavaliacao && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Autoavaliação</span>}
                    {modelo.para_superior_imediato && <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded">Superior</span>}
                    {modelo.para_subcomissao && <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded">Subcomissão</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    to={`/admin/questionarios/${modelo.id}/preview`}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                    title="Preview"
                  >
                    <Eye size={16} />
                  </Link>

                  {modelo.status === 'RASCUNHO' && (
                    <>
                      <Link
                        to={`/admin/questionarios/${modelo.id}/editar`}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </Link>
                      <button
                        onClick={() => setConfirmPublicar(modelo)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-600 transition-colors"
                        title="Publicar"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={() => { if (confirm('Excluir este questionário?')) deletar.mutate(modelo.id) }}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-500 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => clonar.mutate(modelo.id)}
                    disabled={clonar.isPending}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                    title="Clonar"
                  >
                    {clonar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmPublicar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800">Publicar Questionário</h3>
            <p className="text-gray-600 mt-2 text-sm">
              Tem certeza que deseja publicar <strong>{confirmPublicar.nome}</strong>?
              Após publicado, ele não poderá mais ser editado.
            </p>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setConfirmPublicar(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => publicar.mutate(confirmPublicar.id)}
                disabled={publicar.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
              >
                {publicar.isPending && <Loader2 size={14} className="animate-spin" />}
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
