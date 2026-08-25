#!/bin/bash

echo "📦 Instalando dependências do backend..."

# Instalar multer e uuid
npm install multer@1.4.5-lts.1 uuid@9.0.1

# Instalar tipos do TypeScript
npm install --save-dev @types/multer@1.4.13 @types/uuid@9.0.8

echo "✅ Dependências instaladas com sucesso!"
