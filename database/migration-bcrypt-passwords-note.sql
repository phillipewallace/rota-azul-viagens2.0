-- Hash de senhas legadas em bcrypt.
-- O backend já migra automaticamente no próximo login bem-sucedido (login.ts),
-- mas se preferir migrar agora, rode este script Node:
--
--   cd backend && node -e "require('ts-node/register');require('./scripts/hash-legacy-passwords.ts')"
--
-- Este arquivo serve só como nota; a migração de schema não muda colunas.
SELECT 1;
