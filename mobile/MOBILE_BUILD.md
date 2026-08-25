
# AlchemyRotas Mobile - Guia de Build APK

## Pré-requisitos

1. **Node.js** (versão 18 ou superior)
2. **Android Studio** instalado e configurado
3. **Java Development Kit (JDK)** 11 ou 17
4. **Android SDK** (instalado via Android Studio)

## Configuração do Ambiente

### 1. Instalar dependências
```bash
cd mobile
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env` e configure conforme o ambiente:

**Para desenvolvimento local:**
```env
VITE_API_URL=http://localhost:3001/api
```

**Para desenvolvimento com IP específico:**
```env
VITE_API_URL=http://SEU_IP_LOCAL:3001/api
```

**Para produção (VPS admmicban.com.br):**
```env
VITE_API_URL=https://admmicban.com.br/api
```

### 3. Build da aplicação web
```bash
npm run build
```

## Configuração do Capacitor

### 1. Adicionar plataforma Android (primeira vez)
```bash
npm run add:android
```

### 2. Sincronizar arquivos
```bash
npm run sync
```

## Build do APK

### 1. Abrir no Android Studio
```bash
npm run android
```

### 2. Build via linha de comando
```bash
cd android
./gradlew assembleDebug
```

O APK será gerado em: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Build de Release (para produção)
```bash
cd android
./gradlew assembleRelease
```

## Configuração para VPS (admmicban.com.br)

O mobile está configurado para se conectar automaticamente à VPS em produção:
- **URL da API**: `https://admmicban.com.br/api`
- **Domínio**: admmicban.com.br
- **HTTPS**: Habilitado

### Testando conexão com a VPS
1. Configure o arquivo `.env` com a URL da VPS
2. Teste a conexão no navegador primeiro
3. Build e teste no dispositivo

## Permissões Necessárias

O app solicita as seguintes permissões:
- ✅ **Localização** (ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION)
- ✅ **Internet** (INTERNET, ACCESS_NETWORK_STATE)
- ✅ **HTTPS** (Network Security Config)

## Testando o APK

1. Instale o APK no dispositivo:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

2. Ou use o comando direto:
```bash
npm run android
```

## Solução de Problemas

### Erro de Conexão com VPS
- Verifique se a VPS está online: `https://admmicban.com.br/api/health`
- Confirme se o backend está rodando na porta correta
- Verifique certificados SSL da VPS

### Erro de API Connection
- Confirme a URL da API no arquivo `.env`
- Teste a API diretamente no navegador
- Verifique logs do backend na VPS

### Erro de Build
- Limpe o cache: `npm run sync`
- Rebuild: `npm run build && npm run sync`
- Verifique se todas as dependências estão instaladas

### Permissões de Localização
- O app solicitará permissões na primeira execução
- Certifique-se de aceitar as permissões de localização

## APIs Integradas (VPS admmicban.com.br)

O mobile se conecta com o backend nas seguintes rotas:
- `GET /api/mobile/truck/:plate` - Buscar dados do caminhão
- `PUT /api/mobile/truck/:id/location` - Atualizar localização
- `PUT /api/mobile/truck/:truckId/route/point/:pointId` - Marcar ponto como concluído
- `POST /api/mobile/truck/:truckId/finish-route` - Finalizar rota

## Deployment

Para fazer deploy do APK em produção:
1. Configure `.env` com URL de produção
2. Build com `npm run build`
3. Sync com `npm run sync`
4. Generate release APK: `cd android && ./gradlew assembleRelease`
5. Teste em dispositivo real conectando à VPS

## Logs e Debug

Para debugar problemas de conexão:
1. Abra as ferramentas de desenvolvedor do Chrome
2. Conecte o dispositivo via USB
3. Acesse `chrome://inspect`
4. Visualize logs do aplicativo em tempo real
