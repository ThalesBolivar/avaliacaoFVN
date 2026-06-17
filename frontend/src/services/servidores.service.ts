import api from './api'
import type { Servidor } from '@/types'

export const servidoresService = {
  async listar(ativo = true): Promise<Servidor[]> {
    const response = await api.get<Servidor[]>(`/servidores?ativo=${ativo}`)
    return response.data
  },

  async criar(data: Partial<Servidor>): Promise<Servidor> {
    const response = await api.post<Servidor>('/servidores', data)
    return response.data
  },

  async atualizar(id: number, data: Partial<Servidor>): Promise<Servidor> {
    const response = await api.put<Servidor>(`/servidores/${id}`, data)
    return response.data
  },

  async alterarStatus(id: number, ativo: boolean): Promise<void> {
    await api.patch(`/servidores/${id}/status?ativo=${ativo}`)
  },

  async importar(arquivo: File): Promise<{ lote_id: number; total: number; validos: number; invalidos: number }> {
    const form = new FormData()
    form.append('arquivo', arquivo)
    const response = await api.post('/servidores/importar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}
