# Guia de Compartilhamento de Localização - Alchemy Rotas Mobile

## Como Usar o Recurso de Compartilhamento

### 1. Receber Localização do WhatsApp

1. **Receba uma localização no WhatsApp**
   - Abra a conversa no WhatsApp
   - Toque na localização recebida
   - Toque no botão "Compartilhar" ou ícone de compartilhar (三 pontos)

2. **Escolha o App Alchemy Rotas**
   - Na lista de apps que aparece, selecione "AlchemyRotas Mobile"
   - O app abrirá automaticamente

3. **O App Irá:**
   - Abrir a tela de lista de paradas
   - Exibir o modal "Adicionar parada extra"
   - Pré-preencher o campo de localização com o link recebido

4. **Complete as Informações:**
   - Nome do cliente/ponto (obrigatório)
   - Tipo de parada (Coleta, Serviço, Entrega, Outro)
   - Escolha onde inserir a parada na rota
   - Toque em "Adicionar"

### 2. Compartilhar do Google Maps

1. **No Google Maps:**
   - Toque em uma localização ou enderenço
   - Toque em "Compartilhar"
   - Selecione "AlchemyRotas Mobile"

2. **O Processo é o Mesmo:**
   - App abre com modal de adicionar parada
   - Link do Google Maps já preenchido
   - Complete nome e tipo
   - Adicione à rota

### 3. Fluxo Com/Sem Login

**Se você NÃO estiver logado:**
- O conteúdo compartilhado fica guardado
- Você é levado para a tela de login
- Após fazer login, o modal abre automaticamente com a localização

**Se você JÁ estiver logado:**
- O modal abre imediatamente
- Pronto para adicionar a parada

## Funcionalidades da Lista de Paradas

### Visualizar Todas as Paradas
- Toque em "Ver lista completa de paradas" no card da rota
- Veja todas as paradas numeradas
- Veja quais estão concluídas (✓)

### Reordenar Paradas
- Toque e segure o ícone de arrastar (≡) ao lado de cada parada
- Arraste para cima ou para baixo
- Solte na nova posição
- Toque em "Salvar" para confirmar

### Adicionar Parada Extra
- Na lista de paradas, toque em "+ Adicionar parada extra"
- Preencha:
  - Nome do cliente/ponto *
  - Tipo de parada
  - Endereço ou link de localização *
- Escolha onde inserir:
  - Antes de uma parada específica
  - Ou no final da rota (padrão)
- Toque em "Adicionar"

## Tipos de Localização Suportados

O app aceita os seguintes formatos:

1. **Links do Google Maps:**
   - `https://maps.google.com/?q=-23.550520,-46.633308`
   - `https://www.google.com/maps/@-23.550520,-46.633308,15z`
   - `https://goo.gl/maps/xxxxx`

2. **Links do WhatsApp:**
   - Links de localização compartilhados via WhatsApp
   - O app extrai as coordenadas automaticamente

3. **Endereços de Texto:**
   - "Rua Exemplo, 123, São Paulo, SP"
   - Qualquer texto de endereço

## Importante

- ✅ Sempre salve as alterações após reordenar
- ✅ Verifique se a parada foi adicionada corretamente
- ✅ Todas as paradas extras ficam vinculadas à rota atual do caminhão
- ⚠️ Se sair da lista sem salvar, as alterações serão perdidas
- ⚠️ Não é possível adicionar paradas se não houver rota ativa

## Build do APK

Para que o compartilhamento funcione no APK Android:

1. Execute o build do projeto:
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   ```

2. No Android Studio, gere o APK assinado

3. Instale no dispositivo

4. O app estará disponível nas opções de compartilhamento do sistema

## Troubleshooting

**O app não aparece nas opções de compartilhamento:**
- Verifique se o AndroidManifest.xml tem os intent-filters corretos
- Reinstale o app
- Limpe o cache do sistema

**Localização não é preenchida automaticamente:**
- Verifique se o formato do link é suportado
- Tente copiar e colar manualmente no campo

**Erro ao adicionar parada:**
- Verifique se há conexão com internet
- Confirme que há uma rota ativa para o caminhão
- Tente novamente

## Suporte

Para problemas ou dúvidas, entre em contato com o suporte técnico.
