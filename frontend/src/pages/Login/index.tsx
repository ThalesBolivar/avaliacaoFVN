import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { municipiosService } from '@/services/municipios.service'
import { useMunicipioStore } from '@/store/municipio.store'
import { useAuthStore } from '@/store/auth.store'
import type { Municipio } from '@/types'
import { Building2, Lock, User, Loader2 } from 'lucide-react'

const schema = z.object({
  municipio_id: z.union([z.coerce.number().min(1, 'Selecione o município'), z.literal(''), z.null()]).optional(),
  login: z.string().min(1, 'Informe o login'),
  senha: z.string().min(1, 'Informe a senha'),
})

type FormData = z.infer<typeof schema>

export default function Login() {
  const { login } = useAuth()
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const { municipios, setMunicipios } = useMunicipioStore()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [form, setForm] = useState({
    municipio_id: '',
    login: '',
    senha: '',
  })

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    municipiosService.listar().then(setMunicipios).catch(console.error)
  }, [setMunicipios])

  const isSuperAdminLogin = form.login.trim().toLowerCase() === 'superadmin@sistema.com'

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setErrors({})

    const formData = new FormData(event.currentTarget)
    const parsed = schema.safeParse({
      municipio_id: formData.get('municipio_id'),
      login: String(formData.get('login') || '').trim(),
      senha: String(formData.get('senha') || ''),
    })

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      setErrors({
        municipio_id: fieldErrors.municipio_id?.[0],
        login: fieldErrors.login?.[0],
        senha: fieldErrors.senha?.[0],
      })
      return
    }

    const municipioIdValue = parsed.data.municipio_id
    const municipioId = typeof municipioIdValue === 'number' ? municipioIdValue : null

    if (!isSuperAdminLogin && !municipioId) {
      setErrors({ municipio_id: 'Selecione o município' })
      return
    }

    setLoading(true)
    try {
      await login(isSuperAdminLogin ? null : municipioId, parsed.data.login, parsed.data.senha)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Erro ao realizar login. Verifique suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Sistema de Avaliação</h1>
          <p className="text-blue-200 mt-2">Avaliação de Desempenho de Servidores Públicos</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Entrar no sistema</h2>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Município {isSuperAdminLogin ? '(opcional para super admin)' : ''}
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  name="municipio_id"
                  value={form.municipio_id}
                  onChange={(e) => setForm((current) => ({ ...current, municipio_id: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                >
                  <option value="">{isSuperAdminLogin ? 'Super admin não precisa selecionar' : 'Selecione o município'}</option>
                  {municipios.map((m: Municipio) => (
                    <option key={m.id} value={m.id}>{m.nome} - {m.estado}</option>
                  ))}
                </select>
              </div>
              {errors.municipio_id && (
                <p className="text-red-500 text-xs mt-1">{errors.municipio_id}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Login</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="login"
                  type="text"
                  value={form.login}
                  onChange={(e) => setForm((current) => ({ ...current, login: e.target.value }))}
                  placeholder="E-mail ou matrícula"
                  autoComplete="username"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {errors.login && (
                <p className="text-red-500 text-xs mt-1">{errors.login}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="senha"
                  type="password"
                  value={form.senha}
                  onChange={(e) => setForm((current) => ({ ...current, senha: e.target.value }))}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {errors.senha && (
                <p className="text-red-500 text-xs mt-1">{errors.senha}</p>
              )}
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Super admin pode entrar só com login e senha. Servidores podem usar a matrícula como login e senha inicial.
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
