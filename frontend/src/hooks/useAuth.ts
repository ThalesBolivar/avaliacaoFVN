import { useAuthStore } from '@/store/auth.store'
import { authService } from '@/services/auth.service'
import { useNavigate } from 'react-router-dom'

export function useAuth() {
  const { user, isAuthenticated, logout: storeLogout, setAuth, setTokens, refreshToken, hasPermission } = useAuthStore()
  const navigate = useNavigate()

  async function login(municipio_id: number | null, login: string, senha: string) {
    const data = await authService.login(municipio_id, login, senha)
    setTokens(data.access_token, data.refresh_token)
    const me = await authService.me()
    setAuth(me, data.access_token, data.refresh_token)
    return data
  }

  async function logout() {
    if (refreshToken) {
      try { await authService.logout(refreshToken) } catch {}
    }
    storeLogout()
    navigate('/login', { replace: true })
  }

  return { user, isAuthenticated, login, logout, hasPermission }
}
