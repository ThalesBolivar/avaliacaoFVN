import axios from 'axios'
import api from './api'
import type { TokenResponse, AuthUser } from '@/types'

export const authService = {
  async login(municipio_id: number | null, login: string, senha: string): Promise<TokenResponse> {
    const response = await axios.post<TokenResponse>('/api/v1/auth/login', {
      municipio_id,
      login,
      senha,
    })
    return response.data
  },

  async logout(refresh_token: string): Promise<void> {
    await api.post('/auth/logout', { refresh_token })
  },

  async me(): Promise<AuthUser> {
    const response = await api.get<AuthUser>('/auth/me')
    return response.data
  },

  async refreshToken(refresh_token: string): Promise<TokenResponse> {
    const response = await axios.post<TokenResponse>('/api/v1/auth/refresh', { refresh_token })
    return response.data
  },
}
