import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: ptBR })
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, "dd/MM/yyyy 'às' HH:mm")
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function maskCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-**')
}

export function formatPontuacao(value: number): string {
  return value.toFixed(2)
}

export const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADO: 'Publicado',
  ARQUIVADO: 'Arquivado',
  PLANEJADO: 'Planejado',
  ATIVO: 'Ativo',
  ENCERRADO: 'Encerrado',
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em Andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
}

export const TIPO_AVALIACAO_LABELS: Record<string, string> = {
  AUTOAVALIACAO: 'Autoavaliação',
  SUPERIOR_IMEDIATO: 'Superior Imediato',
  SUBCOMISSAO: 'Subcomissão',
}

export const PERFIL_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMINISTRADOR: 'Administrador',
  CHEFIA: 'Chefia',
  SUBCOMISSAO: 'Subcomissão',
  SERVIDOR: 'Servidor',
}
