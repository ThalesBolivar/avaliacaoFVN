import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Municipios from '@/pages/Admin/Municipios'
import Servidores from '@/pages/Admin/Servidores'
import Cargos from '@/pages/Admin/Cargos'
import NiveisCargo from '@/pages/Admin/NiveisCargo'
import Lotacoes from '@/pages/Admin/Lotacoes'
import CadastroUsuarios from '@/pages/Admin/CadastroUsuarios'
import Periodos from '@/pages/Admin/Periodos'
import Questionarios from '@/pages/Admin/Questionarios'
import CriarQuestionario from '@/pages/Admin/Questionarios/Criar'
import EditarQuestionario from '@/pages/Admin/Questionarios/Editar'
import PreviewQuestionario from '@/pages/Admin/Questionarios/Preview'
import Logs from '@/pages/Admin/Logs'
import AvaliacoesPendentes from '@/pages/Avaliacoes/Pendentes'
import MinhasAvaliacoes from '@/pages/Avaliacoes/MinhasAvaliacoes'
import AvaliacoesRecebidas from '@/pages/Avaliacoes/Recebidas'
import PreencherAvaliacao from '@/pages/Avaliacoes/Preencher'
import MinhaSubcomissao from '@/pages/Avaliacoes/MinhaSubcomissao'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin/municipios" element={<Municipios />} />
            <Route path="/admin/servidores" element={<Servidores />} />
            <Route path="/admin/niveis-cargo" element={<NiveisCargo />} />
            <Route path="/admin/lotacoes" element={<Lotacoes />} />
            <Route path="/admin/cargos" element={<Cargos />} />
            <Route path="/admin/cadastro-usuarios" element={<CadastroUsuarios />} />
            {/* Rotas antigas redirecionam para o cadastro unificado */}
            <Route path="/admin/usuarios" element={<Navigate to="/admin/cadastro-usuarios?etapa=usuarios" replace />} />
            <Route path="/admin/funcoes-usuario" element={<Navigate to="/admin/cadastro-usuarios" replace />} />
            <Route path="/admin/servidor-funcoes" element={<Navigate to="/admin/cadastro-usuarios?etapa=vinculos" replace />} />
            <Route path="/admin/periodos" element={<Periodos />} />
            <Route path="/admin/questionarios" element={<Questionarios />} />
            <Route path="/admin/questionarios/novo" element={<CriarQuestionario />} />
            <Route path="/admin/questionarios/:id/editar" element={<EditarQuestionario />} />
            <Route path="/admin/questionarios/:id/preview" element={<PreviewQuestionario />} />
            <Route path="/admin/logs" element={<Logs />} />
            <Route path="/avaliacoes/pendentes" element={<AvaliacoesPendentes />} />
            <Route path="/avaliacoes/minhas" element={<MinhasAvaliacoes />} />
            <Route path="/avaliacoes/recebidas" element={<AvaliacoesRecebidas />} />
            <Route path="/avaliacoes/:id/preencher" element={<PreencherAvaliacao />} />
            <Route path="/avaliacoes/subcomissao" element={<MinhaSubcomissao />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
