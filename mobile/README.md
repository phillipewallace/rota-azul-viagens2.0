
# Rota Azul Viagens - Aplicação Mobile

Esta é a aplicação mobile separada para motoristas do sistema Rota Azul Viagens.

## Estrutura Separada

A aplicação mobile foi separada da principal para facilitar:
- Build independente
- Deploy mobile específico  
- Manutenção simplificada
- Performance otimizada

## Como Executar

### Desenvolvimento Local
```bash
cd mobile/
npm install
npm run dev
```

A aplicação rodará em `http://localhost:3002`

### Build para Produção
```bash
cd mobile/
npm run build
```

### Para usar com Capacitor (App Nativo)

1. Instale as dependências do Capacitor:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
```

2. Inicialize o Capacitor:
```bash
npx cap init
```

3. Configure o capacitor.config.ts:
```typescript
{
  appId: 'app.rotaazul.mobile',
  appName: 'Rota Azul Motorista',
  webDir: 'dist',
  server: {
    url: 'http://localhost:3002', // Para desenvolvimento
    cleartext: true
  }
}
```

4. Adicione as plataformas:
```bash
npx cap add ios
npx cap add android
```

5. Sync e execute:
```bash
npm run build
npx cap sync
npx cap run android  # ou ios
```

## Funcionalidades

- Login por placa do caminhão
- Visualização da rota ativa
- Marcação de pontos como concluídos
- Atualização de localização em tempo real
- Interface otimizada para mobile

## Comunicação com Backend

A aplicação se comunica com o backend principal em `http://localhost:3001/api`

### Endpoints usados:
- `GET /api/mobile/truck/:plate` - Buscar dados do caminhão
- `PUT /api/mobile/truck/:id/location` - Atualizar localização
- `PUT /api/mobile/truck/:truckId/route/point/:pointId` - Marcar ponto como concluído

## Tecnologias

- React 18
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- Lucide Icons
- Vite

## Estrutura de Pastas

```
mobile/
├── src/
│   ├── components/ui/     # Componentes de interface
│   ├── hooks/            # Custom hooks
│   ├── pages/            # Páginas da aplicação
│   ├── lib/              # Utilitários
│   └── App.tsx           # Componente principal
├── package.json
├── vite.config.ts
└── tailwind.config.js
```
