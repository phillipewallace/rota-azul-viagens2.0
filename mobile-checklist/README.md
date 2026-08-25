# Alchemy Checklist — App APK

Wrapper Capacitor mínimo: o APK é apenas um navegador embutido que abre
**https://alchemyrotas.com/checklist** em tela cheia. Toda a lógica do
checklist roda no site (sempre na versão mais recente publicada).

## Por que um wrapper?

- Nada para reconstruir quando o checklist mudar — o usuário sempre vê a
  última versão.
- APK pequeno (alguns MB).
- Mesma assinatura do motorista, câmera, etc., funcionam via WebView.

## Pré-requisitos

- Node 18+
- JDK 17
- Android Studio + SDK (para gerar o APK)

## Setup (1ª vez)

```bash
cd mobile-checklist
npm install
npm run add:android       # cria a pasta android/
npm run sync              # copia config para o nativo
```

## Gerar APK de debug (instalável em qualquer Android)

```bash
npm run apk:debug
# saída: android/app/build/outputs/apk/debug/app-debug.apk
```

Depois é só transferir esse `.apk` para o celular do motorista
(WhatsApp, link, USB) e instalar (precisa permitir "fontes desconhecidas").

## Gerar APK de release assinado (loja ou distribuição séria)

1. Crie uma keystore (uma vez):
```bash
keytool -genkey -v -keystore alchemy-checklist.keystore \
  -alias alchemy -keyalg RSA -keysize 2048 -validity 10000
```
2. Em `android/app/build.gradle` adicione `signingConfigs` apontando para
   essa keystore.
3. Rode:
```bash
npm run apk:release
# saída: android/app/build/outputs/apk/release/app-release.apk
```

## Atualizar o app

Como o app só carrega o site, **basta publicar uma nova versão do
frontend** que o motorista vê na próxima vez que abre. Só precisa
recompilar o APK se mudar o `appId`, ícone, splash, ou permissões
nativas.

## Trocar para outra URL (staging, dev)

Edite `capacitor.config.ts` → `server.url`, depois `npm run sync` e
recompile.

## Nome / ícone do app

- Nome: `Alchemy Checklist` (em `capacitor.config.ts` → `appName`)
- ID: `com.alchemyrotas.checklist`
- Para trocar ícone: substitua os arquivos em
  `android/app/src/main/res/mipmap-*` depois de `add:android`.
