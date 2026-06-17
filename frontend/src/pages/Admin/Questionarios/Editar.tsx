import { useParams } from 'react-router-dom'
import QuestionarioForm from './Form'

export default function EditarQuestionario() {
  const { id } = useParams()

  if (!id) return null

  return <QuestionarioForm mode="edit" modelId={Number(id)} />
}
