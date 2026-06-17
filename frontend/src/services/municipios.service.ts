import axios from 'axios'
import api from '@/services/api'
import type { Municipio } from '@/types'

export const municipiosService = {
  async listar(): Promise<Municipio[]> {
    const response = await axios.get<Municipio[]>('/api/v1/municipios')
    return Array.isArray(response.data) ? response.data : []
  },

  async listarAdmin(): Promise<Municipio[]> {
    const response = await api.get<Municipio[]>('/municipios/admin/lista')
    return Array.isArray(response.data) ? response.data : []
  },

  async criar(data: Partial<Municipio>): Promise<Municipio> {
    const response = await api.post<Municipio>('/municipios', data)
    return response.data
  },

  async atualizar(id: number, data: Partial<Municipio>): Promise<Municipio> {
    const response = await api.put<Municipio>(`/municipios/${id}`, data)
    return response.data
  },
}
