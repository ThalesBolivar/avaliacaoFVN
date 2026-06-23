import api from './api'
import type { FormularioResumo, FormularioDetalhado } from '@/types'

interface RespostaInput {
  pergunta_avaliacao_id: number
  opcao_selecionada?: string
  resposta_numerica?: number
  resposta_texto?: string
}

interface SalvarRequest {
  respostas: RespostaInput[]
  observacoes?: string
  sugestoes_melhoria?: string
  uso_alcool_drogas?: boolean
}

export const avaliacoesService = {
  async minhas(): Promise<FormularioResumo[]> {
    const response = await api.get<FormularioResumo[]>('/avaliacoes/minhas')
    return response.data
  },

  async recebidas(): Promise<FormularioResumo[]> {
    const response = await api.get<FormularioResumo[]>('/avaliacoes/recebidas')
    return response.data
  },

  async pendentes(): Promise<FormularioResumo[]> {
    const response = await api.get<FormularioResumo[]>('/avaliacoes/pendentes')
    return response.data
  },

  async carregar(id: number): Promise<FormularioDetalhado> {
    const response = await api.get<FormularioDetalhado>(`/avaliacoes/${id}`)
    return response.data
  },

  async iniciar(id: number): Promise<FormularioResumo> {
    const response = await api.post<FormularioResumo>(`/avaliacoes/${id}/iniciar`)
    return response.data
  },

  async salvar(id: number, data: SalvarRequest): Promise<FormularioResumo> {
    const response = await api.post<FormularioResumo>(`/avaliacoes/${id}/salvar`, data)
    return response.data
  },

  async finalizar(id: number, data: SalvarRequest): Promise<FormularioDetalhado> {
    const response = await api.post<FormularioDetalhado>(`/avaliacoes/${id}/finalizar`, data)
    return response.data
  },

  async excluir(id: number): Promise<void> {
    await api.delete(`/avaliacoes/${id}`)
  },

  async baixarPdf(id: number): Promise<{ blob: Blob; filename: string }> {
    const response = await api.get(`/documentos/avaliacao/${id}/pdf`, { responseType: 'blob' })
    const disposition = String(response.headers['content-disposition'] || '')
    const match = disposition.match(/filename="([^"]+)"/)
    return {
      blob: response.data,
      filename: match?.[1] || `avaliacao_${id}.pdf`,
    }
  },
}
