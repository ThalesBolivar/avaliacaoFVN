from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from html import escape
import io
import logging
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER

from app.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.audit import log_event, Acoes
from app.models.periodo import FormularioAvaliacao, RespostaAvaliacao, StatusVinculoEnum
from app.models.servidor import Servidor
from app.models.usuario import Usuario
from app.models.questionario import PerguntaAvaliacao, TipoRespostaEnum

router = APIRouter(prefix="/documentos", tags=["Documentos"])
logger = logging.getLogger(__name__)

AZUL = colors.HexColor("#1d4ed8")
AZUL_CLARO = colors.HexColor("#dbeafe")
CINZA_CLARO = colors.HexColor("#f9fafb")
CINZA_BORDA = colors.HexColor("#e5e7eb")
TEXTO = colors.HexColor("#111827")
TEXTO_SEC = colors.HexColor("#4b5563")

TIPO_LABEL = {
    "AUTOAVALIACAO": "Autoavaliação",
    "SUPERIOR_IMEDIATO": "Avaliação pela Chefia Imediata",
    "SUBCOMISSAO": "Avaliação pela Subcomissão",
}


def _gerar_pdf_reportlab(formulario: FormularioAvaliacao, servidor: Servidor) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm,
    )

    estilos = getSampleStyleSheet()
    titulo_style = ParagraphStyle("titulo", fontName="Helvetica-Bold", fontSize=18, textColor=AZUL, spaceAfter=4)
    subtitulo_style = ParagraphStyle("sub", fontName="Helvetica", fontSize=10, textColor=TEXTO_SEC, spaceAfter=12)
    secao_style = ParagraphStyle("secao", fontName="Helvetica-Bold", fontSize=12, textColor=AZUL, spaceBefore=16, spaceAfter=8)
    criterio_style = ParagraphStyle("criterio", fontName="Helvetica-Bold", fontSize=10, textColor=TEXTO, spaceAfter=2)
    texto_style = ParagraphStyle("texto", fontName="Helvetica", fontSize=9, textColor=TEXTO_SEC, spaceAfter=4)
    resposta_style = ParagraphStyle("resp", fontName="Helvetica-Bold", fontSize=10, textColor=TEXTO, spaceAfter=2)
    obs_style = ParagraphStyle("obs", fontName="Helvetica", fontSize=9, textColor=TEXTO, leading=14)

    agora = datetime.now().strftime("%d/%m/%Y às %H:%M")
    tipo_label = TIPO_LABEL.get(formulario.tipo_avaliacao.value, formulario.tipo_avaliacao.value)
    pontuacao = f"{formulario.pontuacao_total:.2f}" if formulario.pontuacao_total is not None else "N/A"
    finalizado = formulario.finalizado_em.strftime("%d/%m/%Y %H:%M") if formulario.finalizado_em else "—"

    story = []

    # Cabeçalho
    story.append(Paragraph("Avaliação de Desempenho Funcional", titulo_style))
    story.append(Paragraph(f"Documento gerado em {agora}", subtitulo_style))
    story.append(HRFlowable(width="100%", thickness=2, color=AZUL, spaceAfter=12))

    # Tabela de dados do servidor
    dados = [
        ["Servidor", servidor.nome if servidor else "—"],
        ["Matrícula", servidor.matricula if servidor else "—"],
        ["Cargo", servidor.cargo or "—"],
        ["Lotação", servidor.lotacao or "—"],
        ["Tipo de avaliação", tipo_label],
        ["Pontuação total", pontuacao],
        ["Finalizado em", finalizado],
    ]
    t = Table(dados, colWidths=[4.5*cm, 13*cm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), TEXTO_SEC),
        ("TEXTCOLOR", (1, 0), (1, -1), TEXTO),
        ("BACKGROUND", (0, 0), (0, -1), CINZA_CLARO),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, CINZA_CLARO]),
        ("GRID", (0, 0), (-1, -1), 0.5, CINZA_BORDA),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t)
    story.append(Spacer(1, 16))

    # Respostas
    story.append(Paragraph("Perguntas e Respostas", secao_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=CINZA_BORDA, spaceAfter=8))

    respostas_ordenadas = sorted(
        formulario.respostas,
        key=lambda r: r.pergunta.numero_pergunta if r.pergunta else 9999,
    )

    for i, resposta in enumerate(respostas_ordenadas):
        pergunta = resposta.pergunta
        if not pergunta:
            continue

        # Texto da resposta
        if resposta.resposta_texto:
            resp_texto = resposta.resposta_texto
        elif resposta.opcao_selecionada:
            opcao = next((o for o in pergunta.opcoes if o.letra_opcao.value == resposta.opcao_selecionada), None)
            resp_texto = f"{resposta.opcao_selecionada} - {opcao.texto_opcao}" if opcao else resposta.opcao_selecionada
        elif resposta.resposta_numerica is not None:
            if pergunta.tipo_resposta == TipoRespostaEnum.SIM_NAO:
                resp_texto = "Sim" if float(resposta.resposta_numerica) > 0 else "Não"
            else:
                resp_texto = str(resposta.resposta_numerica)
        else:
            resp_texto = "Não respondida"

        pontos = f"{resposta.pontuacao_obtida:.2f}" if resposta.pontuacao_obtida is not None else "—"

        bloco = [
            [
                Paragraph(f"{pergunta.numero_pergunta}. {pergunta.criterio}", criterio_style),
                Paragraph(f"Pontos: {pontos}", ParagraphStyle("pts", fontName="Helvetica-Bold", fontSize=9, textColor=AZUL, alignment=2)),
            ],
            [Paragraph(pergunta.texto_pergunta, texto_style), ""],
            [Paragraph(f"Resposta: {resp_texto}", resposta_style), ""],
        ]
        tb = Table(bloco, colWidths=[13.5*cm, 4*cm])
        tb.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.5, CINZA_BORDA),
            ("SPAN", (0, 1), (1, 1)),
            ("SPAN", (0, 2), (1, 2)),
            ("ROWBACKGROUNDS", (0, 0), (-1, 0), [CINZA_CLARO]),
            ("PADDING", (0, 0), (-1, -1), 7),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(tb)
        story.append(Spacer(1, 6))

    # Observações
    if formulario.observacoes:
        story.append(Spacer(1, 8))
        story.append(Paragraph("Observações", secao_style))
        story.append(Paragraph(formulario.observacoes, obs_style))

    if formulario.sugestoes_melhoria:
        story.append(Spacer(1, 8))
        story.append(Paragraph("Sugestões de melhoria", secao_style))
        story.append(Paragraph(formulario.sugestoes_melhoria, obs_style))

    doc.build(story)
    return buf.getvalue()


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

    pdf_bytes = _gerar_pdf_reportlab(formulario, servidor)
    content = io.BytesIO(pdf_bytes)
    content.seek(0)
    media_type = "application/pdf"
    filename = f"avaliacao_{formulario_id}.pdf"

    await log_event(
        db, current_user.municipio_id, Acoes.PDF_BAIXADO, "avaliacao",
        usuario=current_user, entidade_id=str(formulario_id),
    )

    return StreamingResponse(
        content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
