
# 🚀 Guia Completo - AlchemyRotas Mobile (APK Android)

## 📱 1. Teste Rápido no Navegador (Recomendado para Início)
```bash
cd mobile/
npm install
npm run dev
```
Acesse: http://localhost:3002
- Use F12 para abrir DevTools
- Clique no ícone de celular para simular mobile

---

## 🔧 2. Configuração Inicial do Capacitor

### Pré-requisitos Obrigatórios:

1. **Node.js 18+** (https://nodejs.org/)
2. **Java Development Kit (JDK 17)** (https://adoptium.net/)
3. **Android Studio** (https://developer.android.com/studio)

### Instalar Dependências:
```bash
cd mobile/
npm install

# Instalar Capacitor e plugins nativos
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm install @capacitor/geolocation @capacitor/app @capacitor/device
```

### Inicializar Capacitor:
```bash
# Inicializar projeto Capacitor (só uma vez)
npx cap init "AlchemyRotas Motorista" "app.alchemyrotas.mobile"
```

---

## 📋 3. Configuração do capacitor.config.ts

Edite o arquivo `capacitor.config.ts`:
```typescript
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.alchemyrotas.mobile',
  appName: 'AlchemyRotas Motorista',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Geolocation: {
      permissions: ["location"]
    },
    App: {
      launchAutoHide: true
    }
  }
};

export default config;
```

---

## 🤖 4. Configuração Completa para Android APK

### Passo 1: Configurar Variáveis de Ambiente

**Windows:**
1. Abra "Configurações do Sistema" → "Variáveis de Ambiente"
2. Adicione as seguintes variáveis:

```
JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot
ANDROID_HOME = C:\Users\[SeuUsuario]\AppData\Local\Android\Sdk
```

3. Adicione ao PATH:
```
%JAVA_HOME%\bin
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%ANDROID_HOME%\cmdline-tools\latest\bin
```

**macOS/Linux:**
```bash
# Adicionar ao ~/.bash_profile ou ~/.zshrc
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
```

### Passo 2: Configurar Android Studio
1. **Instalar Android Studio**
2. **Abrir SDK Manager** (Tools → SDK Manager)
3. **Instalar componentes essenciais:**
   - Android SDK Platform 33 (API Level 33)
   - Android SDK Build-Tools 33.0.0
   - Android Emulator
   - Android SDK Platform-Tools
   - Android SDK Command-line Tools

### Passo 3: Preparar o Projeto
```bash
# No diretório mobile/
npm run build
```

### Passo 4: Adicionar Plataforma Android
```bash
npx cap add android
```

### Passo 5: Sincronizar Arquivos
```bash
npx cap sync android
```

### Passo 6: Configurar Permissões Android

Edite `android/app/src/main/AndroidManifest.xml`:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Permissões necessárias -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

---

## 🏗️ 5. Gerando o APK

### Método 1: APK de Debug (Mais Rápido)
```bash
# Abrir projeto no Android Studio
npx cap open android

# Ou gerar APK via linha de comando
cd android
./gradlew assembleDebug
```

**APK estará em:** `android/app/build/outputs/apk/debug/app-debug.apk`

### Método 2: APK de Release (Para Distribuição)

1. **Gerar Keystore (chave de assinatura):**
```bash
keytool -genkey -v -keystore alchemyrotas-release-key.keystore -alias alchemyrotas -keyalg RSA -keysize 2048 -validity 10000
```

2. **Configurar assinatura no Android Studio:**
   - File → Project Structure
   - Modules → app → Signing Configs
   - Criar novo signing config com o keystore gerado 

3. **Gerar APK Release:**
   - Build → Generate Signed Bundle/APK
   - Selecionar APK
   - Escolher keystore e configurações
   - Build Type: release

**APK final:** `android/app/build/outputs/apk/release/app-release.apk`

---

## 📱 6. Instalação e Teste

### Em Dispositivo Real:

1. **Habilitar Depuração USB:**
   - Configurações → Sobre o telefone
   - Toque 7x em "Número da compilação"
   - Voltar → Opções do desenvolvedor
   - Ativar "Depuração USB"

2. **Conectar dispositivo via USB**

3. **Verificar conexão:**
```bash
adb devices
```

4. **Instalar APK:**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Em Emulador:
```bash
# Executar direto no emulador
npx cap run android
```

---

## 🔄 7. Comandos de Desenvolvimento

### Desenvolvimento Contínuo:
```bash
# Build e sync automático
npm run build && npx cap sync android

# Live reload (hot reload)
npx cap run android --livereload --external

# Apenas sincronizar mudanças
npx cap sync android

# Logs do dispositivo
adb logcat
```

### Build Otimizado:
```bash
# Build de produção
npm run build

# Sync para Android
npx cap sync android

# Gerar APK de release
cd android && ./gradlew assembleRelease
```

---

## 🐛 8. Solução de Problemas Comuns

### Erro: "ANDROID_HOME not set"
```bash
# Verificar variáveis
echo $ANDROID_HOME
echo $JAVA_HOME

# Adicionar ao PATH se necessário
export ANDROID_HOME=$HOME/Library/Android/sdk
```

### Erro: "Gradle build failed"
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### Erro: "SDK not found"
- Abrir Android Studio
- Tools → SDK Manager
- Instalar Android SDK 33+
- Verificar se ANDROID_HOME aponta para o SDK correto

### Erro: "Device not found"
```bash
# Verificar dispositivos conectados
adb devices

# Reiniciar ADB se necessário
adb kill-server
adb start-server
```

### Erro: "App crashes on startup"
- Verificar logs: `adb logcat`
- Verificar permissões no AndroidManifest.xml
- Certificar que backend está acessível

---

## 🚀 9. Deploy para Produção

### APK para Distribuição:
1. **Configurar ícone do app:**
   - Usar Android Studio → Image Asset Studio
   - Gerar ícones para todas as densidades

2. **Configurar nome do app:**
   - Editar `android/app/src/main/res/values/strings.xml`

3. **Gerar APK assinado para produção**

4. **Testar em múltiplos dispositivos**

### Opções de Distribuição:
- **APK Direto**: Enviar arquivo por WhatsApp/Email
- **Google Play Store**: Upload do Bundle AAB
- **Firebase App Distribution**: Para testes beta
- **Site próprio**: Download direto

---

## 📊 10. Monitoramento e Analytics

### Configurações Recomendadas:
```bash
# Adicionar plugins de monitoramento
npm install @capacitor/crashlytics
npm install @capacitor/analytics
```

### Logs Remotos:
- Configurar Crashlytics para erros
- Implementar analytics de uso
- Monitorar performance GPS

---

## 🔧 11. Configurações Avançadas

### Otimização de Performance:
1. **Reduzir tamanho do APK:**
   - Minificar código JavaScript
   - Otimizar imagens
   - Remover dependências não utilizadas

2. **Melhorar GPS:**
   - Configurar requestLocationUpdates
   - Implementar background location
   - Otimizar frequência de updates

### Configuração de Produção:
```javascript
// capacitor.config.ts - Produção
const config: CapacitorConfig = {
  appId: 'app.alchemyrotas.mobile',
  appName: 'AlchemyRotas',
  webDir: 'dist',
  server: {
    url: 'https://seu-backend-producao.com', // URL do seu backend
    cleartext: false
  },
  plugins: {
    Geolocation: {
      permissions: ["location"],
      enableHighAccuracy: true
    }
  }
};
```

---

## 📞 12. Suporte e Próximos Passos

### Para Teste em Campo:
1. ✅ Gerar APK de debug para testes
2. ✅ Instalar no dispositivo do motorista
3. ✅ Configurar backend em servidor dedicado
4. ✅ Testar conectividade GPS em movimento
5. ✅ Treinar motorista no uso do app

### Checklist de Produção:
- [ ] Backend rodando em servidor público (não localhost)
- [ ] APK assinado com keystore de produção
- [ ] Testes em múltiplos dispositivos Android
- [ ] Permissões de localização funcionando
- [ ] Conectividade com APIs do Google Maps
- [ ] Sistema de logs/monitoramento configurado

### URLs Importantes:
- **Backend Local**: http://localhost:3001
- **Backend Produção**: https://seu-dominio.com
- **App Web**: https://seu-dominio.com
- **Google Maps Console**: https://console.cloud.google.com

---

**🎯 Resumo Rápido:**
1. `npm install` → `npx cap add android` → `npx cap sync android`
2. Configurar Android Studio e variáveis de ambiente
3. `npx cap open android` → Build APK
4. Instalar no dispositivo: `adb install app-debug.apk`

**⚠️ Importante:** 
- Backend deve estar acessível via internet (não localhost)
- Dispositivo precisa ter GPS habilitado
- App precisa de permissão de localização
- Testar em área com boa cobertura de dados móveis

**🔗 Links Úteis:**
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Studio](https://developer.android.com/studio)
- [Google Maps APIs](https://developers.google.com/maps)
