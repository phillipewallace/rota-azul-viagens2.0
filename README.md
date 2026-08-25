# Sistema de Roteirização Rota Azul Viagens

Sistema completo de gerenciamento de rotas, caminhões e motoristas com otimização de rotas via Google Maps.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior) - [Download](https://nodejs.org/)
- **PostgreSQL** (versão 14 ou superior) - [Download](https://www.postgresql.org/download/)
- **npm** ou **yarn** (geralmente vem com Node.js)
- **Git** - [Download](https://git-scm.com/)

## 🚀 Instalação e Configuração

### 1. Clonar o Repositório

```bash
git clone <url-do-repositorio>
cd rota-azul-viagens
```

### 2. Configurar o Banco de Dados PostgreSQL

#### 2.1. Criar o Banco de Dados

Abra o terminal do PostgreSQL (psql) ou use uma ferramenta como pgAdmin:

```sql
-- Conectar ao PostgreSQL como superusuário
psql -U postgres

-- Criar o banco de dados
CREATE DATABASE roteirizador1;

-- Sair do psql
\q
```

#### 2.2. Executar o Script de Criação das Tabelas

```bash
# Navegar até a pasta database
cd database

# Executar o script SQL (substitua pelos seus dados de conexão)
psql -U lipe -d roteirizador1 -f complete-schema-fixed.sql

# Ou se estiver usando outro usuário:
psql -U seu_usuario -d roteirizador1 -f complete-schema-fixed.sql
```

**Nota:** O script `complete-schema-fixed.sql` irá:
- Criar todas as tabelas necessárias (users, drivers, trucks, routes, schedules, etc.)
- Criar índices para otimização
- Inserir dados de exemplo
- Configurar triggers automáticos

### 3. Configurar o Backend

#### 3.1. Navegar para a pasta do backend

```bash
cd backend
```

#### 3.2. Instalar Dependências

```bash
npm install
```

#### 3.3. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Database - AJUSTE CONFORME SEU POSTGRESQL
DATABASE_URL=postgresql://seu_usuario:sua_senha@localhost:5432/roteirizador1
DB_HOST=localhost
DB_PORT=5432
DB_NAME=roteirizador1
DB_USER=seu_usuario
DB_PASSWORD=sua_senha

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# API Keys - IMPORTANTE: Configure sua chave do Google Maps
GOOGLE_MAPS_API_KEY=sua_chave_google_maps_aqui

# JWT
JWT_SECRET=sua-chave-secreta-jwt-aqui
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3002
```

**⚠️ IMPORTANTE:**
- Substitua `seu_usuario` e `sua_senha` pelas credenciais do seu PostgreSQL
- Configure uma chave válida do Google Maps API (necessária para otimização de rotas)
- Altere o `JWT_SECRET` para uma string aleatória e segura

#### 3.4. Obter Chave do Google Maps API

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative as APIs:
   - Google Maps JavaScript API
   - Directions API
   - Geocoding API
   - Distance Matrix API
4. Crie credenciais (API Key)
5. Copie a chave e cole no arquivo `.env`

### 4. Configurar o Frontend

#### 4.1. Voltar para a raiz do projeto

```bash
cd ..
```

#### 4.2. Instalar Dependências

```bash
npm install
```

#### 4.3. Verificar Configuração da API

O arquivo `src/services/config.ts` já está configurado para:
- **Desenvolvimento:** `http://localhost:3001/api`
- **Produção:** `https://admmicban.com.br/api`

Não é necessário alterar nada para desenvolvimento local.

### 5. Configurar Aplicação Mobile (Opcional)

Se você deseja usar a aplicação mobile para motoristas:

```bash
cd mobile
npm install
```

A configuração de variáveis de ambiente está em `mobile/.env`. Copie o exemplo:

```bash
cp .env.example .env
```

Edite conforme necessário (geralmente a configuração padrão funciona para desenvolvimento).

## ▶️ Executando o Sistema

### Iniciar o Backend

Em um terminal, na pasta `backend`:

```bash
cd backend
npm run dev
```

O backend estará rodando em: `http://localhost:3001`

### Iniciar o Frontend

Em outro terminal, na pasta raiz do projeto:

```bash
npm run dev
```

O frontend estará rodando em: `http://localhost:5173`

### Iniciar Aplicação Mobile (Opcional)

Em outro terminal, na pasta `mobile`:

```bash
cd mobile
npm run dev
```

A aplicação mobile estará rodando em: `http://localhost:3002`

## 🔐 Credenciais Padrão

Após executar o script SQL, você pode fazer login com:

- **Usuário:** `admin@rotaazul.com`
- **Senha:** `admin123`

**⚠️ SEGURANÇA:** Altere essas credenciais após o primeiro login!

## 📁 Estrutura do Projeto

```
rota-azul-viagens/
├── backend/               # API Node.js/Express
│   ├── src/
│   │   ├── config/       # Configurações (database, etc.)
│   │   ├── routes/       # Rotas da API
│   │   └── services/     # Serviços (otimização, etc.)
│   └── .env              # Variáveis de ambiente do backend
│
├── database/              # Scripts SQL
│   └── complete-schema-fixed.sql  # Schema completo
│
├── mobile/                # Aplicação mobile para motoristas
│   ├── src/
│   └── android/          # Build Android
│
├── src/                   # Frontend React
│   ├── components/       # Componentes React
│   ├── pages/            # Páginas da aplicação
│   ├── hooks/            # Custom hooks
│   └── services/         # Serviços de API
│
└── public/               # Arquivos estáticos
```

## 🔧 Troubleshooting

### Erro: "Connection refused" no backend

**Solução:** Verifique se o PostgreSQL está rodando:

```bash
# Linux/Mac
sudo service postgresql status

# Windows (abra Services e procure por PostgreSQL)
```

### Erro: "Database does not exist"

**Solução:** Certifique-se de ter criado o banco de dados:

```sql
CREATE DATABASE roteirizador1;
```

### Erro: "Authentication failed"

**Solução:** Verifique as credenciais no arquivo `backend/.env`:
- `DB_USER` e `DB_PASSWORD` devem corresponder ao seu usuário PostgreSQL

### Erro: "Google Maps API error"

**Solução:** 
1. Verifique se a chave do Google Maps está correta no `backend/.env`
2. Certifique-se de que as APIs necessárias estão ativadas no Google Cloud Console
3. Verifique se há créditos disponíveis na sua conta Google Cloud

### Backend não conecta ao banco

**Solução:**
1. Teste a conexão manualmente:
```bash
psql -U seu_usuario -d roteirizador1
```

2. Se necessário, ajuste as permissões no PostgreSQL:
```sql
GRANT ALL PRIVILEGES ON DATABASE roteirizador1 TO seu_usuario;
```

### Porta já em uso

**Solução:** Se as portas 3001 (backend) ou 5173 (frontend) estiverem em uso:

```bash
# Encontrar processo usando a porta (Linux/Mac)
lsof -i :3001

# Matar o processo
kill -9 <PID>
```

Ou altere a porta no arquivo de configuração correspondente.

## 🌐 Deployment em Produção

Para colocar o sistema em produção:

1. **Backend:** Configure o `NODE_ENV=production` no `.env`
2. **Frontend:** Execute `npm run build` para gerar build otimizado
3. **Banco de Dados:** Use um servidor PostgreSQL em produção (não localhost)
4. **SSL:** Configure certificados SSL para HTTPS
5. **CORS:** Ajuste `CORS_ORIGIN` para incluir o domínio de produção

## 📱 Build da Aplicação Mobile (Android)

Para gerar o APK da aplicação mobile, consulte: `mobile/MOBILE_BUILD.md`

## 🆘 Suporte

Para dúvidas ou problemas:

1. Verifique a seção de Troubleshooting
2. Revise os logs do backend e frontend
3. Certifique-se de que todas as dependências foram instaladas

## 📄 Licença

[Adicione informações de licença aqui]

## 👥 Contribuidores

[Adicione informações dos contribuidores aqui]

---

**Desenvolvido com ❤️ para Rota Azul Viagens**
