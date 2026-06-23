import api from './api'
import type { NivelCargoItem } from '@/types'

export const niveisCargosService = {
  async listar(): Promise<NivelCargoItem[]> {
    const response = await api.get<NivelCargoItem[]>('/niveis-cargo')
    return response.data
  },

  async criar(data: { nome: string; label: string; descricao?: string; ordem?: number; ativo?: boolean }): Promise<NivelCargoItem> {
    const response = await api.post<NivelCargoItem>('/niveis-cargo', data)
    return response.data
  },

  async atualizar(id: number, data: { label?: string; descricao?: string; ordem?: number; ativo?: boolean }): Promise<NivelCargoItem> {
    const response = await api.put<NivelCargoItem>(`/niveis-cargo/${id}`, data)
    return response.data
  },

  async excluir(id: number): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/niveis-cargo/${id}`)
    return response.data
  },
}
