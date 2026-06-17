from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from html import escape
import io
import logging

from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.audit import log_event, Acoes
from app.models.periodo import FormularioAvaliacao, RespostaAvaliacao, StatusVinculoEnum
from app.models.servidor import Servidor
from app.models.usuario import Usuario
from app.models.questionario import PerguntaAvaliacao, TipoRespostaEnum

router = APIRouter(prefix="/documentos", tags=["Documentos"])
logger = logging.getLogger(__name__)


def _formatar_resposta(resposta) -> str:
    pergunta = resposta.pergunta
    if not pergunta:
        return "Pergunta não encontrada"

    if resposta.resposta_texto:
        return escape(resposta.resposta_texto).replace("\n", "<br>")

    if resposta.opcao_selecionada:
        opcao = next(
            (item for item in pergunta.opcoes if item.letra_opcao.value == resposta.opcao_selecionada),
            None,
        )
        if opcao:
            return f"{escape(opcao.letra_opcao.value)} - {escape(opcao.texto_opcao)}"
        return escape(str(resposta.opcao_selecionada))

    if resposta.resposta_numerica is not None:
        if pergunta.tipo_resposta == TipoRespostaEnum.SIM_NAO:
            return "Sim" if float(resposta.resposta_numerica) > 0 else "Não"
        return str(resposta.resposta_numerica)

    return "Não respondida"


def _gerar_bloco_respostas(formulario: FormularioAvaliacao) -> str:
    respostas_ordenadas = sorted(
        formulario.respostas,
        key=lambda resposta: resposta.pergunta.numero_pergunta if resposta.pergunta else 9999,
    )
    if not respostas_ordenadas:
        return "<p class='vazio'>Nenhuma resposta registrada.</p>"

    cards = []
    for resposta in respostas_ordenadas:
        pergunta = resposta.pergunta
        if not pergunta:
            continue

        cards.append(
            f"""
            <div class="pergunta-card">
              <div class="pergunta-topo">
                <span class="numero">{pergunta.numero_pergunta}</span>
                <div>
                  <p class="criterio">{escape(pergunta.criterio)}</p>
                  <p class="texto">{escape(pergunta.texto_pergunta)}</p>
                </div>
              </div>
              <div class="resposta-box">
                <span class="resposta-label">Resposta</span>
                <p class="resposta-texto">{_formatar_resposta(resposta)}</p>
              </div>
            </div>
            """
        )

    return "".join(cards) if cards else "<p class='vazio'>Nenhuma resposta registrada.</p>"


def _gerar_html_avaliacao(formulario: FormularioAvaliacao, servidor: Servidor) -> str:
    pontuacao = f"{formulario.pontuacao_total:.2f}" if formulario.pontuacao_total else "N/A"
    tipo = formulario.tipo_avaliacao.value.replace("_", " ")
    respostas_html = _gerar_bloco_respostas(formulario)
    observacoes_html = ""
    if formulario.observacoes:
        observacoes_html = (
            "<div class='bloco-texto'><strong>Observações</strong><p>"
            + escape(formulario.observacoes).replace("\n", "<br>")
            + "</p></div>"
        )
    sugestoes_html = ""
    if formulario.sugestoes_melhoria:
        sugestoes_html = (
            "<div class='bloco-texto'><strong>Sugestões de melhoria</strong><p>"
            + escape(formulario.sugestoes_melhoria).replace("\n", "<br>")
            + "</p></div>"
        )
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; color: #1f2937; }}
  h1 {{ color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 24px; }}
  h2 {{ color: #111827; margin-top: 28px; margin-bottom: 12px; font-size: 18px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
  th, td {{ border: 1px solid #ddd; padding: 8px 12px; text-align: left; }}
  th {{ background: #f4f6f9; }}
  .pontuacao {{ font-size: 1.35em; font-weight: bold; color: #1d4ed8; margin-top: 16px; }}
  .meta {{ color: #4b5563; margin-top: -8px; margin-bottom: 20px; }}
  .pergunta-card {{ border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px; background: #fff; }}
  .pergunta-topo {{ display: flex; gap: 12px; align-items: flex-start; }}
  .numero {{ width: 28px; height: 28px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }}
  .criterio {{ margin: 0 0 4px 0; font-weight: bold; color: #111827; }}
  .texto {{ margin: 0; color: #374151; }}
  .resposta-box {{ margin-top: 12px; background: #f9fafb; border-radius: 10px; padding: 12px; }}
  .resposta-label {{ display: block; font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }}
  .resposta-texto {{ margin: 0; color: #111827; }}
  .vazio {{ color: #6b7280; }}
  .bloco-texto {{ margin-top: 16px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }}
  .bloco-texto strong {{ display: block; margin-bottom: 6px; color: #111827; }}
</style>
</head>
<body>
<h1>Avaliação de Desempenho</h1>
<p class="meta">Documento gerado a partir do formulário respondido no sistema.</p>
<table>
  <tr><th>Servidor</th><td>{escape(servidor.nome)}</td></tr>
  <tr><th>Matrícula</th><td>{escape(servidor.matricula)}</td></tr>
  <tr><th>Cargo</th><td>{escape(servidor.cargo or "N/A")}</td></tr>
  <tr><th>Lotação</th><td>{escape(servidor.lotacao or "N/A")}</td></tr>
  <tr><th>Tipo de Avaliação</th><td>{tipo}</td></tr>
  <tr><th>Status</th><td>{escape(formulario.status.value)}</td></tr>
  <tr><th>Finalizado em</th><td>{formulario.finalizado_em or "Em andamento"}</td></tr>
</table>
<p class="pontuacao">Pontuação Total: {pontuacao}</p>
<h2>Perguntas e Respostas</h2>
{respostas_html}
{observacoes_html}
{sugestoes_html}
</body>
</html>"""


@router.get("/avaliacao/{formulario_id}/pdf")
async def gerar_pdf_avaliacao(
    formulario_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    result = await db.execute(
        select(FormularioAvaliacao)
        .options(
            selectinload(FormularioAvaliacao.respostas)
            .selectinload(RespostaAvaliacao.pergunta)
            .selectinload(PerguntaAvaliacao.opcoes)
        )
        .where(FormularioAvaliacao.id == formulario_id)
    )
    formulario = result.scalar_one_or_none()

    if not formulario:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    if formulario.municipio_id != current_user.municipio_id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    servidor = await db.get(Servidor, formulario.servidor_avaliado_id)

    html_content = _gerar_html_avaliacao(formulario, servidor)

    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        content = io.BytesIO(pdf_bytes)
        content.seek(0)
        media_type = "application/pdf"
        filename = f"avaliacao_{formulario_id}.pdf"
    except Exception:
        logger.exception("Falha ao gerar PDF da avaliacao %s com WeasyPrint", formulario_id)
        content = io.BytesIO(html_content.encode())
        content.seek(0)
        media_type = "text/html"
        filename = f"avaliacao_{formulario_id}.html"

    await log_event(
        db, current_user.municipio_id, Acoes.PDF_BAIXADO, "avaliacao",
        usuario=current_user, entidade_id=str(formulario_id),
    )

    return StreamingResponse(
        content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
