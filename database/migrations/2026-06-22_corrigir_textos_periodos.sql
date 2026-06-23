-- Corrige nomes de períodos gravados com encoding corrompido
UPDATE periodos_avaliacao
SET nome = 'Avaliação de Desempenho - Nível Fundamental'
WHERE nome = 'AvaliaÃ§Ã£o de Desempenho - NÃ­vel Fundamental';

UPDATE periodos_avaliacao
SET nome = 'Avaliação de Desempenho - Nível Médio'
WHERE nome = 'AvaliaÃ§Ã£o de Desempenho - NÃ­vel MÃ©dio';

UPDATE periodos_avaliacao
SET nome = 'Avaliação de Desempenho - Nível Superior'
WHERE nome = 'AvaliaÃ§Ã£o de Desempenho - NÃ­vel Superior';
