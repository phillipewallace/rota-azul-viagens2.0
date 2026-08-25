
#!/bin/bash

echo "🚀 Configurando Backend para Produção - Rota Azul"
echo "================================================"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    log_error "package.json não encontrado. Execute este script no diretório backend."
    exit 1
fi

log_info "Iniciando configuração do backend..."

# 1. Instalar dependências
log_info "Instalando dependências..."
npm install
if [ $? -eq 0 ]; then
    log_success "Dependências instaladas com sucesso"
else
    log_error "Falha ao instalar dependências"
    exit 1
fi

# 2. Criar diretório de logs
log_info "Criando diretório de logs..."
mkdir -p logs
log_success "Diretório de logs criado"

# 3. Verificar arquivo .env
if [ ! -f ".env" ]; then
    log_warning "Arquivo .env não encontrado. Criando template..."
    cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rota_azul_db
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT Secret
JWT_SECRET=your-super-secret-key-change-in-production

# Server Configuration
PORT=3001

# Google Maps API Key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
EOF
    log_warning "Arquivo .env criado. CONFIGURE AS VARIÁVEIS antes de continuar!"
    log_warning "Edite o arquivo .env com suas configurações de banco de dados"
    exit 1
fi

log_success "Arquivo .env encontrado"

# 4. Compilar TypeScript
log_info "Compilando código TypeScript..."
npm run build
if [ $? -eq 0 ]; then
    log_success "Código compilado com sucesso"
else
    log_error "Falha na compilação. Verifique os erros acima"
    exit 1
fi

# 5. Verificar se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 não encontrado. Instalando globalmente..."
    npm install -g pm2
    if [ $? -eq 0 ]; then
        log_success "PM2 instalado com sucesso"
    else
        log_error "Falha ao instalar PM2"
        exit 1
    fi
else
    log_success "PM2 já está instalado"
fi

# 6. Parar instância anterior se existir
log_info "Parando instância anterior do PM2..."
pm2 stop rota-azul-backend 2>/dev/null || true
pm2 delete rota-azul-backend 2>/dev/null || true
log_success "Instância anterior removida"

# 7. Iniciar aplicação com PM2
log_info "Iniciando aplicação com PM2..."
pm2 start ecosystem.config.js
if [ $? -eq 0 ]; then
    log_success "Aplicação iniciada com sucesso"
else
    log_error "Falha ao iniciar aplicação"
    exit 1
fi

# 8. Salvar configuração PM2
log_info "Salvando configuração PM2..."
pm2 save
pm2 startup

# 9. Verificar status
log_info "Verificando status da aplicação..."
pm2 list

echo ""
echo "🎉 Configuração concluída com sucesso!"
echo "================================================"
log_success "Backend está rodando na porta 3001"
log_info "Comandos úteis:"
echo "  • Ver logs: pm2 logs rota-azul-backend"
echo "  • Status: pm2 status"
echo "  • Reiniciar: pm2 restart rota-azul-backend"
echo "  • Parar: pm2 stop rota-azul-backend"
echo ""
log_warning "Não esqueça de:"
echo "  1. Configurar seu banco PostgreSQL"
echo "  2. Executar o schema SQL na base de dados"
echo "  3. Configurar o arquivo .env com suas credenciais"
echo "  4. Testar a conexão: curl http://localhost:3001/api/auth/verify"
