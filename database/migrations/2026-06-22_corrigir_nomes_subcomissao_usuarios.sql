-- Corrige nomes corrompidos dos usuários de subcomissão
UPDATE usuarios
SET nome = 'SubComissão Fundamental'
WHERE email = 'subcomissao.fundamental@teste.com';

UPDATE usuarios
SET nome = 'SubComissão Média e Técnica'
WHERE email = 'subcomissao.media@teste.com';

UPDATE usuarios
SET nome = 'SubComissão Superior'
WHERE email = 'subcomissao.superior@teste.com';
