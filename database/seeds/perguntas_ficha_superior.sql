-- ============================================================================
-- SEED: Perguntas da Ficha Superior (ANEXO VIII - LC 197/2020 - PCCV SAAE)
-- ----------------------------------------------------------------------------
-- Insere um MODELO de avaliação (RASCUNHO) e suas perguntas com as
-- 4 alternativas (A/B/C/D) cada, na mesma ordem do documento.
--
-- Pré-requisitos:
--   * As 12 categorias já devem existir em `categorias_avaliacao` para o
--     município abaixo, com `ordem` de 1 a 12.
--   * As perguntas referenciam a categoria pela `ordem` (não depende de ID fixo).
--
-- Observações:
--   * Alternativas SEM pontuação (pontuacao = NULL).
--   * Rodar este script mais de uma vez cria um NOVO modelo a cada execução.
--   * Banco: MySQL.
--
-- Como rodar:
--   mysql -u USUARIO -p NOME_DO_BANCO < superior.sql
-- ============================================================================

START TRANSACTION;

-- Município: Mariana (resolvido pelo identificador — robusto para multi-município)
SET @municipio_id = (SELECT id FROM municipios WHERE identificador = 'mariana' LIMIT 1);

INSERT INTO modelos_avaliacao
    (municipio_id, nome, descricao, versao, status,
     para_autoavaliacao, para_superior_imediato, para_subcomissao, criado_em)
VALUES
    (@municipio_id,
     'Avaliação de Desempenho - Nível Superior',
     'Ficha Superior (ANEXO VIII) - LC 197/2020 - PCCV SAAE',
     1, 'RASCUNHO', 1, 1, 1, NOW());

SET @modelo_id = LAST_INSERT_ID();

-- PERGUNTA 1 — ASSIDUIDADE (categoria ordem 1)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=1 AND ativo=1 LIMIT 1),
     'ASSIDUIDADE', 1,
     'Considera a assiduidade ao trabalho:',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Não falta ou ausenta-se ao trabalho.',NULL,NOW()),
(@p,'B','Falta esporadicamente por motivo comprovado, no máximo, por duas vezes por ano.',NULL,NOW()),
(@p,'C','Falta ao serviço por motivo comprovado por mais de 02 vezes por mês.',NULL,NOW()),
(@p,'D','Falta com muita frequência, sem comprovação ou faz-se substituir por outro servidor.',NULL,NOW());

-- PERGUNTA 2 — PONTUALIDADE (categoria ordem 2)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=2 AND ativo=1 LIMIT 1),
     'PONTUALIDADE', 2,
     'Avalia o cumprimento de horários de chegada e saída.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Cumpre os horários com seriedade e rigidez.',NULL,NOW()),
(@p,'B','Cumpre os horários satisfatoriamente, atrasa-se com frequência inferior a 04 (quatro) vezes por ano.',NULL,NOW()),
(@p,'C','Cumpre os horários razoavelmente, atrasa-se com frequência inferior a 02 (duas) vezes por mês.',NULL,NOW()),
(@p,'D','Não cumpre os horários de chegada e saída. Sempre chega mais tarde ou sai mais cedo.',NULL,NOW());

-- PERGUNTA 3 — DISCIPLINA (categoria ordem 3)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=3 AND ativo=1 LIMIT 1),
     'DISCIPLINA', 3,
     'Considera a habilidade para ordenar o trabalho, os recursos de que dispõe e a facilidade em manter a sequência, a execução e os resultados das tarefas, de acordo com a necessidade do setor e de acordo com as ordens dadas.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Apresenta habilidade para ordenar o trabalho de maneira lógica e exerce domínio e controle sobre as suas próprias tarefas.',NULL,NOW()),
(@p,'B','Organiza-se e mantém em ordem o seu trabalho de forma racional.',NULL,NOW()),
(@p,'C','Passa o tempo organizando e controlando suas tarefas, mas o resultado não é satisfatório.',NULL,NOW()),
(@p,'D','Mantém-se desorganizado. Necessita de acompanhamento e controle, assim como é necessário cobrar serviços.',NULL,NOW());

-- PERGUNTA 4 — CAPACIDADE TÉCNICA (categoria ordem 4)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=4 AND ativo=1 LIMIT 1),
     'CAPACIDADE TÉCNICA', 4,
     'Considera a capacidade técnica do servidor no exercício das atividades inerentes ao seu cargo:',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','O servidor desempenha suas atividades com desenvoltura e de forma eficaz.',NULL,NOW()),
(@p,'B','O servidor desempenha suas atividades sem desenvoltura, necessitando do auxílio de colegas.',NULL,NOW()),
(@p,'C','O servidor demonstra conhecer, mas não domina as regras técnicas inerentes a sua função.',NULL,NOW()),
(@p,'D','O servidor demonstra não conhecer as regras técnicas inerentes à sua função.',NULL,NOW());

-- PERGUNTA 5 — CAPACIDADE TÉCNICA (categoria ordem 4)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=4 AND ativo=1 LIMIT 1),
     'CAPACIDADE TÉCNICA', 5,
     'Considera a capacidade de cumprir as demandas de trabalho dentro dos prazos previamente estabelecidos.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','É extremamente habilidoso para organizar e dividir adequadamente seu tempo de trabalho, sempre cumprindo os prazos estabelecidos para a realização de suas atividades.',NULL,NOW()),
(@p,'B','Organiza e divide bem o seu tempo de trabalho, raramente descumprindo os prazos estabelecidos para a realização de suas atividades.',NULL,NOW()),
(@p,'C','Não tem grande habilidade para organizar e dividir adequadamente seu tempo de trabalho, descumprindo frequentemente os prazos estabelecidos para a realização de suas atividades.',NULL,NOW()),
(@p,'D','Não consegue organizar e dividir seu tempo de trabalho, descumprindo os prazos estabelecidos para a realização de suas atividades.',NULL,NOW());

-- PERGUNTA 6 — CAPACIDADE TÉCNICA (categoria ordem 4)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=4 AND ativo=1 LIMIT 1),
     'CAPACIDADE TÉCNICA', 6,
     'Considera a capacidade de aproveitamento dos recursos e racionalização de processo, visando à melhoria dos fluxos dos processos de trabalho e consecução de resultados.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Sempre utiliza os materiais de trabalho de forma adequada, sem desperdiçá-los e buscando diminuir o consumo. Sempre apresenta ideias para simplificar, agilizar ou otimizar os processos de trabalho.',NULL,NOW()),
(@p,'B','Utiliza constantemente os materiais de trabalho de forma adequada, buscando não desperdiçá-los. Frequentemente apresenta ideias para simplificar, agilizar ou otimizar os processos de trabalho.',NULL,NOW()),
(@p,'C','Raramente utiliza os materiais de trabalho de forma adequada, muitas vezes desperdiçando-os. Raramente apresenta ideias para simplificar, agilizar ou otimizar os processos de trabalho.',NULL,NOW()),
(@p,'D','Não se preocupa em utilizar os materiais de trabalho de forma adequada, desperdiçando-os. Não apresenta ideias para simplificar, agilizar ou otimizar os processos de trabalho.',NULL,NOW());

-- PERGUNTA 7 — RESPONSABILIDADE (categoria ordem 5)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=5 AND ativo=1 LIMIT 1),
     'RESPONSABILIDADE', 7,
     'Avalia o grau de comprometimento no desempenho de suas funções e para com a instituição.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Assume total responsabilidade pela execução de seu trabalho, cumprindo eficazmente os prazos estabelecidos.',NULL,NOW()),
(@p,'B','Aceita a responsabilidade pela execução de seu trabalho, cumprindo suas obrigações e prazos com razoável frequência.',NULL,NOW()),
(@p,'C','Assume apenas parte da responsabilidade pela execução de um trabalho, relegando o resultado para segundo plano e perdendo, muitas vezes, prazos.',NULL,NOW()),
(@p,'D','Não assume a responsabilidade pela execução de seus trabalhos, desrespeitando o cumprimento de obrigações e prazos.',NULL,NOW());

-- PERGUNTA 8 — INICIATIVA, DINAMISMO E EFICIÊNCIA (categoria ordem 6)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=6 AND ativo=1 LIMIT 1),
     'INICIATIVA, DINAMISMO E EFICIÊNCIA', 8,
     'Considera a capacidade do servidor perceber quando há necessidade de intervenção do Poder Público em soluções de problemas externos:',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Demonstra grande iniciativa, raciocinando e agindo por conta própria nas situações em que identifica como necessária a intervenção do Poder Público.',NULL,NOW()),
(@p,'B','Frequentemente demonstra iniciativa, agindo por conta própria em situações por ele identificadas.',NULL,NOW()),
(@p,'C','Demonstra iniciativa apenas quando é demandado pelo público em geral ou pelo seu superior hierárquico.',NULL,NOW()),
(@p,'D','É passivo, esperando sempre que o público em geral apresente o problema.',NULL,NOW());

-- PERGUNTA 9 — INICIATIVA, DINAMISMO E EFICIÊNCIA (categoria ordem 6)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=6 AND ativo=1 LIMIT 1),
     'INICIATIVA, DINAMISMO E EFICIÊNCIA', 9,
     'Considera a habilidade que o servidor tem em contribuir para que o serviço atinja o nível de eficiência desejado.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Realiza suas atividades de forma completa, precisa e criteriosa, superando aos padrões de qualidade esperados.',NULL,NOW()),
(@p,'B','O servidor possui boa produtividade, tanto em quantidade como em qualidade.',NULL,NOW()),
(@p,'C','O servidor atinge a quantidade e volume de trabalho esperado, mas a qualidade de trabalho deixa a desejar.',NULL,NOW()),
(@p,'D','O servidor não atinge o nível esperado, tanto em qualidade como em quantidade.',NULL,NOW());

-- PERGUNTA 10 — INICIATIVA, DINAMISMO E EFICIÊNCIA (categoria ordem 6)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=6 AND ativo=1 LIMIT 1),
     'INICIATIVA, DINAMISMO E EFICIÊNCIA', 10,
     'Considera a quantidade, rapidez e qualidade com que executa o seu trabalho.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Faz rapidamente e bem tudo que lhe é confiado. A produtividade supera as expectativas.',NULL,NOW()),
(@p,'B','Possui ritmo normal de trabalho. Sai bem em suas tarefas, desde que não haja acúmulo de serviço.',NULL,NOW()),
(@p,'C','O rendimento do trabalho é irregular. A produtividade atinge o grau mínimo esperado.',NULL,NOW()),
(@p,'D','É lento no desempenho de suas tarefas, deixando o serviço acumulado. É improdutivo.',NULL,NOW());

-- PERGUNTA 11 — INICIATIVA, DINAMISMO E EFICIÊNCIA (categoria ordem 6)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=6 AND ativo=1 LIMIT 1),
     'INICIATIVA, DINAMISMO E EFICIÊNCIA', 11,
     'Considera a receptividade do servidor à inovação de métodos, processos, sistemas de informação e de ferramentas de trabalho.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Adapta-se completamente às inovações, inter-relacionando-as com os métodos, processos, softwares e usos de ferramenta de trabalho.',NULL,NOW()),
(@p,'B','Adapta-se suficientemente às inovações, inter-relacionando-as com os métodos, processos, softwares e usos de ferramenta de trabalho.',NULL,NOW()),
(@p,'C','Adapta-se com frequência às inovações, tendo dificuldades para inter-relacionar com os métodos, processos, softwares e usos de ferramenta de trabalho.',NULL,NOW()),
(@p,'D','É resistente a inovações.',NULL,NOW());

-- PERGUNTA 12 — ÉTICA NO SERVIÇO PÚBLICO (categoria ordem 7)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=7 AND ativo=1 LIMIT 1),
     'ÉTICA NO SERVIÇO PÚBLICO', 12,
     'Considera o comportamento no aspecto ético-profissional:',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Comporta-se com ética, sigilo, discrição e justiça. Não pratica discriminação aos colegas de trabalho, superiores e público em geral.',NULL,NOW()),
(@p,'B','Procura comportar-se obedecendo a ética, sigilo, discrição e justiça, bem como em não discriminar colegas, superiores e público em geral.',NULL,NOW()),
(@p,'C','Apresenta dificuldade e necessita de orientação quanto a ética, sigilo, discrição e justiça, bem como em não discriminar colegas, superiores e público em geral.',NULL,NOW()),
(@p,'D','Não se comporta com ética, não respeita o sigilo profissional, age com indiscrição, falta de justiça e discrimina colegas de trabalho, superiores e público em geral.',NULL,NOW());

-- PERGUNTA 13 — EQUILIBRIO EMOCIONAL (categoria ordem 8)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=8 AND ativo=1 LIMIT 1),
     'EQUILIBRIO EMOCIONAL', 13,
     'Considera o equilíbrio emocional do servidor quando em situação de tensão, o relacionamento e tratamento com a chefia, os demais colegas e o público em geral.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Tem excelente capacidade de agir em situações de tensão com discrição e bom senso. Sempre respeita a chefia e os colegas. É cuidadoso com o público e age sempre de forma respeitosa e atenciosa.',NULL,NOW()),
(@p,'B','Quase sempre age em situações de tensão com discrição e bom senso. Procura respeitar à chefia e aos colegas. Trata o público de forma respeitosa.',NULL,NOW()),
(@p,'C','Tem pouca capacidade de agir em situação de tensão com discrição e bom senso. Raramente respeita a chefia e os colegas. Age de forma desrespeitosa e/ou rude com o público em geral.',NULL,NOW()),
(@p,'D','Não tem capacidade de agir em situação de tensão com discrição e bom senso. Não respeita a chefia e os colegas. Age de forma desrespeitosa ou rude com o público em geral.',NULL,NOW());

-- PERGUNTA 14 — DEDICAÇÃO (categoria ordem 9)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=9 AND ativo=1 LIMIT 1),
     'DEDICAÇÃO', 14,
     'Considera a dedicação, demonstração de entusiasmo pelo trabalho, satisfação pessoal e boas expectativas futuras:',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Está sempre motivado e estimulado para realizar as tarefas. Dedica-se ao desempenho de suas tarefas e assume responsabilidade por suas tarefas.',NULL,NOW()),
(@p,'B','Está frequentemente motivado e estimulado para realizar as tarefas. Dedica-se razoavelmente às suas atividades.',NULL,NOW()),
(@p,'C','Está eventualmente motivado e estimulado para realizar as tarefas. Dedica-se pouco.',NULL,NOW()),
(@p,'D','Está raramente motivado e estimulado para realizar as tarefas. Dedica-se o mínimo possível.',NULL,NOW());

-- PERGUNTA 15 — SOCIABILIDADE E COOPERAÇÃO (categoria ordem 10)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=10 AND ativo=1 LIMIT 1),
     'SOCIABILIDADE E COOPERAÇÃO', 15,
     'Considera o grau de cooperação:',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','É colaborativo, manifesta sempre o interesse em cooperar e apresenta propostas e soluções, mesmo quando não solicitado, visando a qualidade do trabalho e a efetividade do serviço público.',NULL,NOW()),
(@p,'B','Procura colaborar, demonstrando interesse e disponibilidade em cooperar com os colegas de sua e de outras áreas, apresentando sugestões de forma adequada.',NULL,NOW()),
(@p,'C','Colabora com os colegas somente de sua área e colabora com as outras quando é consultado.',NULL,NOW()),
(@p,'D','Não colabora com os colegas de sua área ou de outras e não há disponibilidade em apresentar soluções ou sugestões para os problemas da Autarquia.',NULL,NOW());

-- PERGUNTA 16 — SOCIABILIDADE E COOPERAÇÃO (categoria ordem 10)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=10 AND ativo=1 LIMIT 1),
     'SOCIABILIDADE E COOPERAÇÃO', 16,
     'Considera o interesse em cooperar e solucionar eficazmente as situações de trabalho dentro de suas próprias atribuições para o desenvolvimento dos resultados conjuntos satisfatórios.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Coopera espontaneamente, dando informações ou prestando serviços.',NULL,NOW()),
(@p,'B','Quando solicitado, interessa-se em auxiliar ou dar informações.',NULL,NOW()),
(@p,'C','Evita cooperar, participar ou solucionar situações de trabalho que envolvam outros colegas.',NULL,NOW()),
(@p,'D','Não informa nem presta serviços espontaneamente. Tem dificuldade em integrar-se ao grupo no desempenho de tarefas comuns.',NULL,NOW());

-- PERGUNTA 17 — APRESENTAÇÃO PESSOAL, CAPACIDADE DE ORGANIZAÇÃO E FACILIDADE DE EXPRESSÃO (categoria ordem 11)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=11 AND ativo=1 LIMIT 1),
     'APRESENTAÇÃO PESSOAL, CAPACIDADE DE ORGANIZAÇÃO E FACILIDADE DE EXPRESSÃO', 17,
     'Considera a apresentação pessoal e a forma de comunicar-se:',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','O servidor utiliza e incentiva o uso de linguagem apropriada, veste-se adequadamente e procura comportar-se de forma a dar exemplo aos demais colegas de trabalho.',NULL,NOW()),
(@p,'B','O servidor utiliza linguagem apropriada, veste-se adequadamente e comporta-se bem.',NULL,NOW()),
(@p,'C','O servidor utiliza linguagem não apropriada ou comporta-se de forma inadequada.',NULL,NOW()),
(@p,'D','O servidor utiliza linguagem não apropriada, palavrões, excesso de gírias, vestimenta inadequada ou desleixada e/ou comporta-se de forma inadequada.',NULL,NOW());

-- PERGUNTA 18 — APRESENTAÇÃO PESSOAL, CAPACIDADE DE ORGANIZAÇÃO E FACILIDADE DE EXPRESSÃO (categoria ordem 11)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=11 AND ativo=1 LIMIT 1),
     'APRESENTAÇÃO PESSOAL, CAPACIDADE DE ORGANIZAÇÃO E FACILIDADE DE EXPRESSÃO', 18,
     'Considera a definição e a ordenação de atividades em tarefas lógicas e práticas entrosadas para atingir os objetivos:',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Realiza as atividades de forma extremamente planejada, ordenada, lógica e prática.',NULL,NOW()),
(@p,'B','Realiza as atividades de forma suficientemente planejada, ordenada, lógica e prática.',NULL,NOW()),
(@p,'C','Realiza frequentemente as atividades de forma planejada, ordenada, lógica e prática.',NULL,NOW()),
(@p,'D','Raramente realiza as atividades de forma planejada, ordenada, lógica e prática.',NULL,NOW());

-- PERGUNTA 19 — APRESENTAÇÃO PESSOAL, CAPACIDADE DE ORGANIZAÇÃO E FACILIDADE DE EXPRESSÃO (categoria ordem 11)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=11 AND ativo=1 LIMIT 1),
     'APRESENTAÇÃO PESSOAL, CAPACIDADE DE ORGANIZAÇÃO E FACILIDADE DE EXPRESSÃO', 19,
     'Considera a forma como o servidor se expressa no trabalho.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Seu trabalho é de excelente entendimento, não apresenta erros nem incorreções e não há necessidade de orientações.',NULL,NOW()),
(@p,'B','Seu trabalho é de fácil entendimento, raramente apresenta erros e incorreções e quase nunca precisa de orientações para serem corrigidos.',NULL,NOW()),
(@p,'C','Seu trabalho é de entendimento razoável, eventualmente apresenta erros e incorreções, sendo necessário orientações para corrigi-los.',NULL,NOW()),
(@p,'D','Seu trabalho é de difícil entendimento, apresentando erros e incorreções constantemente, mesmo sob orientação.',NULL,NOW());

-- PERGUNTA 20 — TRABALHO EM EQUIPE (categoria ordem 12)
INSERT INTO perguntas_avaliacao
    (modelo_avaliacao_id, categoria_id, criterio, numero_pergunta, texto_pergunta,
     tipo_resposta, peso, obrigatoria, ativa, criado_em)
VALUES
    (@modelo_id,
     (SELECT id FROM categorias_avaliacao WHERE municipio_id=@municipio_id AND ordem=12 AND ativo=1 LIMIT 1),
     'TRABALHO EM EQUIPE', 20,
     'Tem por base todo e qualquer tipo de contato pessoal com os coordenadores e colegas de trabalho.',
     'MULTIPLA_ESCOLHA', 1.00, 1, 1, NOW());
SET @p := LAST_INSERT_ID();
INSERT INTO opcoes_pergunta_avaliacao (pergunta_avaliacao_id, letra_opcao, texto_opcao, pontuacao, criado_em) VALUES
(@p,'A','Sua facilidade de relacionamento com coordenadores e demais colegas faz dele uma pessoa agradável e bem aceita pela maioria.',NULL,NOW()),
(@p,'B','Faz o possível para ser agradável na convivência com colegas e chefes. Reconhece que é importante ter um bom relacionamento.',NULL,NOW()),
(@p,'C','Tem limitações pessoais no tratamento com colegas e coordenadores.',NULL,NOW()),
(@p,'D','Cria problemas no relacionamento em equipe. É impertinente e inoportuno, não sabendo conviver com as pessoas.',NULL,NOW());

COMMIT;

-- Conferência (opcional):
--   SELECT COUNT(*) FROM perguntas_avaliacao WHERE modelo_avaliacao_id=@modelo_id; -- esperado: 20
--   SELECT COUNT(*) FROM opcoes_pergunta_avaliacao o JOIN perguntas_avaliacao p ON p.id=o.pergunta_avaliacao_id WHERE p.modelo_avaliacao_id=@modelo_id; -- esperado: 80
