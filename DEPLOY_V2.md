# Deploy Premium V2 — instruções para o VPS

## 0. Variáveis de ambiente (backend)
Adicione em `/var/www/rota-azul-viagens/backend/.env`:
```
GOOGLE_MAPS_API_KEY=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w
JWT_SECRET=<seu-segredo-forte>
```

## 1. Backend
```bash
cd /var/www/rota-azul-viagens/backend
git pull
npm install
npm run build
pm2 restart all
```

## 2. Banco de dados (3 migrations, em ordem)
```bash
sudo -u postgres psql -d roteirizador1 -f database/migration-v2-categorias-fotos-concluidas.sql
sudo -u postgres psql -d roteirizador1 -f database/migration-v2-sanitarios.sql
sudo -u postgres psql -d roteirizador1 -f database/migration-v2-fixes.sql
sudo -u postgres psql -d roteirizador1 -f database/migration-performance-indexes.sql
sudo -u postgres psql -d roteirizador1 -f database/migration-erp-os-to-contract-link.sql
sudo -u postgres psql -d roteirizador1 -c "ANALYZE customers, sanitarios, erp_expenses, erp_receipts, erp_signed_pdfs, erp_service_orders, erp_quotes;"
sudo -u postgres psql -d roteirizador1 -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lipe; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lipe;"
mkdir -p /var/www/rota-azul-viagens/backend/uploads/photos
chown -R www-data:www-data /var/www/rota-azul-viagens/backend/uploads
```

## 3. Nginx — servir /uploads
Adicione no bloco `server` antes de `location /`:
```
location /uploads/ {
    alias /var/www/rota-azul-viagens/backend/uploads/;
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```
Depois: `nginx -t && systemctl reload nginx`

## 4. Frontend web
```bash
cd /var/www/rota-azul-viagens
git pull
npm install
npm run build
```

## 5. Mobile (background GPS + fotos obrigatórias)
O app mobile precisa do plugin `@capacitor-community/background-geolocation` e do `@capacitor/camera`. Instale e re-builde o APK:
```bash
cd mobile
npm install @capacitor-community/background-geolocation @capacitor/camera @capacitor/filesystem
npx cap sync android
cd android && ./gradlew assembleRelease
```
APK em `mobile/android/app/build/outputs/apk/release/`.

### Mudanças mobile necessárias (a aplicar no fork):
- `android/app/src/main/AndroidManifest.xml`: adicionar `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`, `CAMERA`.
- `MobileDriver.tsx`: ao logar e existir rota → `BackgroundGeolocation.addWatcher({ distanceFilter: 50, backgroundMessage: 'Rota em andamento' }, cb)`. Ao finalizar rota → `removeWatcher`.
- Tela de conclusão de ponto: exigir 3 fotos via `Camera.getPhoto` antes de habilitar "Próximo ponto". Upload via `POST /api/photos/route/:routeId/point/:pointId/photos` (multipart `photos[]`).
- Recolhimento: ao concluir, modal "Quantidade recolhida" → se `qty === restroomsQty` marca `auto_removed=true`, senão atualiza `recolhido_qty` e mantém na rota.
- Entrega de obra: ao concluir, PUT no ponto setando `operation_type='manutencao'` para mantê-lo fixo até recolhimento.
- A cada conclusão, chamar `PUT /api/completed-routes/:routeId/sync` (cria registro automaticamente via `/start` no início da rota).

## Endpoints novos disponíveis
- `POST /api/photos/route/:routeId/point/:pointId/photos` — upload multipart
- `GET  /api/photos/route/:routeId/photos`
- `POST /api/completed-routes/start`
- `PUT  /api/completed-routes/:routeId/sync`
- `POST /api/completed-routes/:routeId/finish`
- `GET  /api/completed-routes` + `/:id` + `/:id/photos.zip`
- `POST /api/routes/:id/optimize-hybrid` — para rotas grandes (50-150 pontos), Distance Matrix + 2-opt + Or-opt

## Otimizador híbrido
O endpoint `/optimize-hybrid` lida com 50+ pontos:
1. Calcula matriz de tempo via Distance Matrix (com tráfego)
2. Nearest Neighbor + 2-opt + Or-opt (respeita origem, destino e pontos `manutencao` como fixos)
3. Polyline final via Routes API em chunks de 25
