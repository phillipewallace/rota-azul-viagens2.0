#!/usr/bin/env bash
###############################################################################
# Alchemy Rotas — Deploy local na VPS (sem SSH, sem senha)
#
# Uso (DENTRO da VPS, dentro da pasta do repositório git clonado):
#   sudo ./deploy.sh
#
# O que ele faz (idempotente, pode rodar sempre):
#   1) git pull do branch atual
#   2) Garante node 20, pm2, postgres, nginx (instala se faltar)
#   3) Garante DB 'roteirizador1' + usuário 'lipe' com a senha já usada
#   4) Aplica todos os database/*.sql (idempotentes)
#   5) Instala deps + builda backend (TS) + builda frontend (Vite)
#   6) Publica frontend em /var/www/alchemyrotas
#   7) Cria/garante vhost nginx e reinicia pm2 + nginx
#   8) Editor de documentos Office: sobe OnlyOffice (docker) automaticamente,
#      gera o segredo JWT, grava as variáveis no backend/.env e publica no
#      mesmo domínio (https://<domínio>/office) — zero configuração manual.
#      (Editor de PLANILHAS é 100% interno, não depende do OnlyOffice.)
###############################################################################
set -euo pipefail

# ─── Config (mesmos valores que já estão em backend/.env) ───────────────────
DB_NAME="${DB_NAME:-roteirizador1}"
DB_USER="${DB_USER:-lipe}"
DB_PASS="${DB_PASS:-20087419}"
WEB_ROOT="${WEB_ROOT:-/var/www/alchemyrotas}"
SERVICE_NAME="${SERVICE_NAME:-alchemy-backend}"
SERVER_NAME="${SERVER_NAME:-alchemyrotas.com}"
NODE_VER="${NODE_VER:-20}"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

C_G='\033[0;32m'; C_B='\033[0;34m'; C_Y='\033[1;33m'; C_R='\033[0;31m'; C_0='\033[0m'
log()  { echo -e "${C_B}[deploy]${C_0} $*"; }
ok()   { echo -e "${C_G}[ok]${C_0}    $*"; }
warn() { echo -e "${C_Y}[warn]${C_0}  $*"; }
err()  { echo -e "${C_R}[erro]${C_0}  $*"; exit 1; }
# Nunca morrer em silêncio: se qualquer comando falhar (set -e), imprime linha e rc.
trap 'rc=$?; echo -e "${C_R}[erro]${C_0}  deploy.sh linha ${LINENO} falhou (rc=${rc})" >&2' ERR

[[ $EUID -eq 0 ]] || err "Rode com sudo: sudo ./deploy.sh"

# ─── 1) git pull ────────────────────────────────────────────────────────────
if [[ -d "${PROJECT_DIR}/.git" ]] && [[ "${SKIP_GIT:-0}" != "1" ]]; then
  log "Atualizando código (git pull)…"
  GIT_TERMINAL_PROMPT=0 git -C "${PROJECT_DIR}" pull --rebase --autostash \
    || err "git pull FALHOU — sem ele o deploy usaria código ANTIGO (causa clássica de 'correção não aplicou'). Resolva o repositório na VPS (autenticação/conflito) ou rode com SKIP_GIT=1 para aceitar o código local."
  log "Código em $(git -C "${PROJECT_DIR}" rev-parse --short HEAD) ($(git -C "${PROJECT_DIR}" log -1 --format=%s))"
fi

# ─── 2) Dependências do sistema ─────────────────────────────────────────────
if ! command -v node >/dev/null || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt "${NODE_VER}" ]]; then
  log "Instalando Node.js ${NODE_VER}…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VER}.x" | bash -
  apt-get install -y nodejs
fi
command -v pm2   >/dev/null || npm i -g pm2 >/dev/null
command -v psql  >/dev/null || { log "Instalando PostgreSQL…"; apt-get update && apt-get install -y postgresql postgresql-contrib; systemctl enable --now postgresql; }
command -v nginx >/dev/null || { log "Instalando nginx…"; apt-get install -y nginx; systemctl enable --now nginx; }
# Docker: usado pelo editor de documentos Office (OnlyOffice) embutido
if ! command -v docker >/dev/null; then
  log "Instalando Docker (editor de documentos Office)…"
  apt-get update >/dev/null && apt-get install -y docker.io \
    || warn "Falha ao instalar Docker — o editor de Word ficará no modo básico (baixar/reenviar)"
fi
systemctl enable --now docker >/dev/null 2>&1 || true
ok "Dependências do sistema OK"

# ─── 3) Banco: usuário, DB, senha, permissões ───────────────────────────────
log "Garantindo DB '${DB_NAME}' e usuário '${DB_USER}'…"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';" >/dev/null
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "ALTER SCHEMA public OWNER TO ${DB_USER};" >/dev/null 2>&1 || true
ok "Postgres pronto"

# ─── 4) Schema único e idempotente (preserva dados, só adiciona o que falta) ─
log "Aplicando database/ensure-schema.sql (único, seguro, sem DROP)…"
sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "${PROJECT_DIR}/database/ensure-schema.sql" \
  || err "Falha ao aplicar ensure-schema.sql — verifique sintaxe"

# 🛡️ Salvaguarda: NÃO aplicar nenhum arquivo SQL que contenha DROP/TRUNCATE/DELETE
# Aplica todas as migrations em ordem alfabética. Como cada uma usa IF NOT EXISTS,
# rodar várias vezes é seguro (idempotente) e preserva 100% dos dados existentes.
log "Aplicando database/migration-*.sql (idempotentes, sem destruir dados)…"
shopt -s nullglob
for mig in $(ls "${PROJECT_DIR}/database/"migration-*.sql 2>/dev/null | sort); do
  base="$(basename "$mig")"
  if grep -Eiq '\b(DROP[[:space:]]+TABLE|TRUNCATE|DELETE[[:space:]]+FROM)\b' "$mig"; then
    warn "Pulando $base (contém comando destrutivo — protegendo dados)"
    continue
  fi
  log "  → $base"
  sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "$mig" >/dev/null \
    || warn "Falha em $base (não interrompendo deploy — verificar manualmente)"
done
shopt -u nullglob

# Esta estrutura é obrigatória para o Financeiro identificar de forma
# inequívoca as competências já faturadas, inclusive as históricas.
sudo -u postgres psql -d "${DB_NAME}" -tAc \
  "SELECT to_regclass('public.erp_receipt_billed_competences') IS NOT NULL" \
  | grep -qx t \
  || err "Migration de reconciliação dos recibos não foi aplicada"

sudo -u postgres psql -d "${DB_NAME}" -tAc \
  "SELECT to_regclass('public.erp_invoice_billed_competences') IS NOT NULL" \
  | grep -qx t \
  || err "Migration de reconciliação das notas fiscais não foi aplicada"

# Verifica a tabela de marcação manual de competências faturadas
# (usada pelo botão "Forçar saída" na aba Pendentes do Financeiro)
sudo -u postgres psql -d "${DB_NAME}" -tAc \
  "SELECT to_regclass('public.erp_manual_billed_competences') IS NOT NULL" \
  | grep -qx t \
  || err "Migration de forçar saída de pendentes não foi aplicada"

sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};" >/dev/null 2>&1 || true
ok "Schema + migrations aplicados (dados preservados)"

# ─── 4.2) Tabelas ERP criadas via código (setupDatabase) — garantia via DDL ─
# O backend chama setupDatabase() na inicialização, mas como redundância
# defensiva (e para evitar erro caso o setup falhe), aplicamos o DDL aqui.
log "Garantindo tabelas ERP (erp_documents, erp_companies, erp_sanitario_fotos, erp_sanitario_movimentacoes)…"
sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=0 <<'SQL' >/dev/null
CREATE TABLE IF NOT EXISTS public.erp_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT,
  numeracao TEXT,
  empresa_emissora TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho BIGINT,
  arquivo_tipo TEXT,
  observacoes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS erp_documents_nome_idx ON public.erp_documents (LOWER(nome));
CREATE INDEX IF NOT EXISTS erp_documents_empresa_idx ON public.erp_documents (LOWER(empresa_emissora));

CREATE TABLE IF NOT EXISTS public.erp_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE NOT NULL,
  inscricao_estadual TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email TEXT,
  logo_url TEXT,
  assinatura_url TEXT,
  financeiro_contato TEXT,
  sigla TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.erp_sanitario_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sanitario_id UUID REFERENCES sanitarios(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  tipo_evento TEXT,
  estado_conservacao TEXT,
  observacoes TEXT,
  funcionario_id UUID,
  funcionario_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.erp_sanitario_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sanitario_id UUID REFERENCES sanitarios(id) ON DELETE CASCADE,
  sanitario_numero TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  route_id UUID,
  route_point_id UUID,
  customer_name TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  driver_id UUID,
  driver_name TEXT,
  truck_id UUID,
  funcionario_nome TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);
GRANT ALL ON public.erp_documents TO public;
GRANT ALL ON public.erp_companies TO public;
GRANT ALL ON public.erp_sanitario_fotos TO public;
GRANT ALL ON public.erp_sanitario_movimentacoes TO public;
SQL
ok "Tabelas ERP garantidas"

# ─── 5) Backend: deps + build ───────────────────────────────────────────────
log "Backend: instalando deps + compilando TS…"
cd "${PROJECT_DIR}/backend"
npm ci >/dev/null 2>&1 \
  || { warn "npm ci falhou (lockfile fora de sync), usando npm install…"; \
       npm install --no-audit --no-fund >/dev/null 2>&1 \
       || { warn "npm install falhou por peer deps, tentando --legacy-peer-deps…"; \
            npm install --no-audit --no-fund --legacy-peer-deps >/dev/null; }; }
npm run build
if [[ ! -f .env ]]; then
  log "Gerando backend/.env padrão…"
  cat > .env <<EOF
NODE_ENV=production
PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
JWT_SECRET=$(openssl rand -hex 48)
JWT_EXPIRES_IN=24h
GOOGLE_MAPS_API_KEY=
CORS_ORIGIN=https://${SERVER_NAME},http://localhost:5173,http://localhost:8080
EOF
else
  # Segurança: se o JWT_SECRET ainda for o placeholder/inseguro herdado,
  # rotaciona automaticamente para um valor forte (invalida sessões antigas).
  CURRENT_JWT=$(grep -E '^JWT_SECRET=' .env | head -1 | cut -d= -f2- || true)
  if [[ -z "$CURRENT_JWT" || "$CURRENT_JWT" == "your-super-secret-jwt-key" || "$CURRENT_JWT" == "your-secret-key-change-in-production" || ${#CURRENT_JWT} -lt 32 ]]; then
    NEW_JWT="$(openssl rand -hex 48)"
    if grep -qE '^JWT_SECRET=' .env; then
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_JWT}|" .env
    else
      echo "JWT_SECRET=${NEW_JWT}" >> .env
    fi
    warn "JWT_SECRET fraco detectado — rotacionado automaticamente (sessões antigas serão invalidadas)"
  fi
fi

# ─── 5.0.1) Editor Office (OnlyOffice) — variáveis automáticas ──────────────
# O segredo JWT é gerado uma única vez e reaproveitado nos deploys seguintes.
# As URLs usam o MESMO domínio do site (via proxy /office/ no nginx), então
# funciona com HTTPS sem configurar DNS/certificado extras.
SSL_CERT_EARLY="/etc/letsencrypt/live/${SERVER_NAME}/fullchain.pem"
OFFICE_SCHEME="http"
[[ -f "$SSL_CERT_EARLY" ]] && OFFICE_SCHEME="https"
env_upsert() { local k="$1" v="$2"; if grep -qE "^${k}=" .env; then sed -i "s|^${k}=.*|${k}=${v}|" .env; else echo "${k}=${v}" >> .env; fi; }
OFFICE_JWT=$(grep -E '^ONLYOFFICE_JWT_SECRET=' .env | head -1 | cut -d= -f2- || true)
if [[ -z "$OFFICE_JWT" ]]; then
  OFFICE_JWT="$(openssl rand -hex 32)"
  env_upsert ONLYOFFICE_JWT_SECRET "${OFFICE_JWT}"
fi
# Só define/atualiza a URL se estiver vazia ou apontando para este mesmo domínio
# (não sobrescreve configuração manual de quem usou outro endereço/servidor).
CUR_OFFICE_URL=$(grep -E '^ONLYOFFICE_PUBLIC_URL=' .env | head -1 | cut -d= -f2- || true)
if [[ -z "$CUR_OFFICE_URL" || "$CUR_OFFICE_URL" == *"${SERVER_NAME}/office"* ]]; then
  env_upsert ONLYOFFICE_PUBLIC_URL "${OFFICE_SCHEME}://${SERVER_NAME}/office"
fi
CUR_PUB_URL=$(grep -E '^PUBLIC_BASE_URL=' .env | head -1 | cut -d= -f2- || true)
if [[ -z "$CUR_PUB_URL" || "$CUR_PUB_URL" == *"${SERVER_NAME}"* ]]; then
  env_upsert PUBLIC_BASE_URL "${OFFICE_SCHEME}://${SERVER_NAME}"
fi
ok "Editor Office configurado → ${OFFICE_SCHEME}://${SERVER_NAME}/office"

# Verificação: garante que o backend compilado contém o código novo
[[ -f "${PROJECT_DIR}/backend/dist/routes/carretinhas.js" ]] \
  || err "backend/dist SEM carretinhas.js — o build não contém o código novo (repo desatualizado?)"
[[ -f "${PROJECT_DIR}/backend/dist/routes/erp-office.js" ]] \
  || err "backend/dist SEM erp-office.js — o build não contém o código novo (repo desatualizado?)"

ok "Backend compilado"

# ─── 5.1) Diretório de uploads (logos, PDFs assinados, fotos) ───────────────
log "Garantindo diretório de uploads…"
UPLOADS_DIR="${PROJECT_DIR}/backend/uploads"
mkdir -p "${UPLOADS_DIR}/logos" "${UPLOADS_DIR}/photos" "${UPLOADS_DIR}/contracts" "${UPLOADS_DIR}/documents"
chown -R root:root "${UPLOADS_DIR}"
chmod -R 755 "${UPLOADS_DIR}"
ok "Uploads OK em ${UPLOADS_DIR}"

# ─── 5.2) OnlyOffice Document Server (editor de Word/PPT embutido) ──────────
# Container docker acessível apenas localmente (127.0.0.1:8080) — o nginx
# publica em https://<domínio>/office/. Idempotente: recria o container só
# se o segredo JWT mudou. Se o docker/OnlyOffice falhar, o deploy segue
# normalmente e o editor de Word cai no modo básico (prévia + baixar/reenviar).
log "Editor de documentos Office (OnlyOffice)…"
OFFICE_JWT=$(grep -E '^ONLYOFFICE_JWT_SECRET=' .env | head -1 | cut -d= -f2- || true)
CTR="rota-azul-onlyoffice"
if command -v docker >/dev/null && systemctl is-active --quiet docker; then
  if docker ps -a --format '{{.Names}}' | grep -qx "$CTR"; then
    RUNNING=$(docker inspect -f '{{.State.Running}}' "$CTR" 2>/dev/null || echo "false")
    CTR_JWT=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CTR" 2>/dev/null | grep '^JWT_SECRET=' | cut -d= -f2- || true)
    if [[ "$RUNNING" == "true" && "$CTR_JWT" == "$OFFICE_JWT" ]]; then
      ok "OnlyOffice já em execução"
    else
      log "Recriando container do OnlyOffice (segredo/configuração atualizados)…"
      docker rm -f "$CTR" >/dev/null
      docker run -d --name "$CTR" --restart unless-stopped -p 127.0.0.1:8080:80 \
        -e JWT_ENABLED=true -e JWT_SECRET="${OFFICE_JWT}" \
        onlyoffice/documentserver:latest >/dev/null \
        || warn "Falha ao recriar OnlyOffice — editor de Word no modo básico"
    fi
  else
    log "Baixando e iniciando OnlyOffice (primeira vez — a imagem tem ~2 GB, pode demorar)…"
    docker run -d --name "$CTR" --restart unless-stopped -p 127.0.0.1:8080:80 \
      -e JWT_ENABLED=true -e JWT_SECRET="${OFFICE_JWT}" \
      onlyoffice/documentserver:latest >/dev/null \
      || warn "Falha ao iniciar OnlyOffice — editor de Word no modo básico"
  fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CTR"; then
    log "Aguardando OnlyOffice ficar pronto (até 3 min)…"
    OFFICE_READY=0
    for _ in $(seq 1 36); do
      if curl -sf http://127.0.0.1:8080/healthcheck 2>/dev/null | grep -qi true; then OFFICE_READY=1; break; fi
      sleep 5
    done
    if [[ "$OFFICE_READY" == "1" ]]; then
      ok "OnlyOffice pronto (editor de Word ativo)"
    else
      warn "OnlyOffice ainda inicializando — em poucos minutos ele responde sozinho"
    fi
  fi
else
  warn "Docker indisponível — editor de Word no modo básico (planilhas seguem 100% funcionais)"
fi

# ─── 6) Frontend: build + publicar ──────────────────────────────────────────
log "Frontend: instalando deps + buildando (Vite)…"
cd "${PROJECT_DIR}"
npm ci >/dev/null 2>&1 || npm install --no-audit --no-fund --legacy-peer-deps >/dev/null
npm run build
mkdir -p "${WEB_ROOT}"
rm -rf "${WEB_ROOT:?}/"*
cp -r "${PROJECT_DIR}/dist/." "${WEB_ROOT}/"
# Verificação: garante que o bundle publicado contém o código novo
if ! grep -rq "carretinhas" "${WEB_ROOT}/assets" 2>/dev/null; then
  err "Bundle publicado SEM as rotas novas (carretinhas) — build/git desatualizado"
fi
ok "Frontend publicado em ${WEB_ROOT} (commit $(git -C "${PROJECT_DIR}" rev-parse --short HEAD))"

# Espelho no caminho LEGADO — vhosts antigos podem apontar para cá; garante que
# qualquer entrada também receba o build novo.
LEGACY_DIST="/var/www/rota-azul-viagens/dist"
if [[ -d "/var/www/rota-azul-viagens" ]]; then
  mkdir -p "${LEGACY_DIST}"
  rm -rf "${LEGACY_DIST:?}/"*
  cp -r "${PROJECT_DIR}/dist/." "${LEGACY_DIST}/"
  ok "Espelho legado publicado em ${LEGACY_DIST}"
fi

# ─── 7) PM2 (backend) ───────────────────────────────────────────────────────
log "Reiniciando backend via pm2…"
cd "${PROJECT_DIR}/backend"
# Remove a app pm2 LEGADA deste mesmo projeto (clone antigo) — ela disputa a
# porta 3002 e pode manter o backend antigo no ar mesmo após o deploy.
if pm2 describe "rota-azul-backend" >/dev/null 2>&1; then
  warn "Removendo app pm2 legada 'rota-azul-backend' (duplicata antiga deste projeto)"
  pm2 delete "rota-azul-backend" >/dev/null || true
fi
pm2 describe "${SERVICE_NAME}" >/dev/null 2>&1 && pm2 reload "${SERVICE_NAME}" --update-env || pm2 start dist/index.js --name "${SERVICE_NAME}" --update-env
pm2 save >/dev/null
ok "pm2 OK"

# ─── 8) Nginx vhost ─────────────────────────────────────────────────────────
VHOST="/etc/nginx/sites-available/alchemy-rotas"
log "Regravando vhost nginx…"
SSL_CERT="/etc/letsencrypt/live/${SERVER_NAME}/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/${SERVER_NAME}/privkey.pem"
HAS_SSL=0
[[ -f "$SSL_CERT" && -f "$SSL_KEY" ]] && HAS_SSL=1
{
  cat <<NGINX
server {
  listen 80; server_name ${SERVER_NAME} www.${SERVER_NAME};
NGINX
  if [[ "$HAS_SSL" == "1" ]]; then
    cat <<NGINX
  return 301 https://\$host\$request_uri; }
server {
  listen 443 ssl http2; server_name ${SERVER_NAME} www.${SERVER_NAME};
  ssl_certificate ${SSL_CERT}; ssl_certificate_key ${SSL_KEY};
NGINX
  fi
  cat <<NGINX
  root ${WEB_ROOT}; index index.html; client_max_body_size 25M;
  location /api/ { proxy_pass http://127.0.0.1:3002/api/; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto \$scheme; }
  location /uploads/ { proxy_pass http://127.0.0.1:3002/uploads/; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto \$scheme; }
  # Editor de documentos Office (OnlyOffice) — mesmo domínio, funciona com HTTPS
  location /office/ {
    rewrite /office/(.*) /\$1 break;
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-Host \$host/office;
    proxy_set_header Accept-Encoding "";
    proxy_cache_bypass \$http_upgrade;
    client_max_body_size 100M;
    sub_filter_once off;
    sub_filter_types application/javascript application/json text/html;
    sub_filter '="/' '="/office/';
  }
  location / { try_files \$uri /index.html; }
}
NGINX
} > "$VHOST"
ln -sf "$VHOST" /etc/nginx/sites-enabled/alchemy-rotas
# Detecta vhosts CONCORRENTES que também atendem este domínio (nginx usa o
# primeiro que casa — um vhost antigo pode "vencer" e servir site velho).
for f in /etc/nginx/sites-enabled/*; do
  [[ "$(basename "$f")" == "alchemy-rotas" ]] && continue
  if grep -qs "alchemyrotas.com" "$f"; then
    warn "Vhost concorrente detectado: $f também atende ${SERVER_NAME}. Se o site continuar desatualizado, desative-o:  sudo rm $f && sudo nginx -t && sudo systemctl reload nginx"
  fi
done
nginx -t && systemctl reload nginx
ok "nginx recarregado"

ok "✅ Deploy concluído! → https://${SERVER_NAME}"
