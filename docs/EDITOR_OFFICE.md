# Editor de Planilhas e Documentos — Central de Documentos (ERP)

Edição de arquivos **dentro do sistema**, 100% gratuita (sem licenças):

| Tipo | Como editar | Tecnologia (licença) |
|---|---|---|
| **Planilhas** `.xlsx .xls .csv .ods` | Botão **Editar** → editor de planilha completo no navegador (fórmulas, múltiplas abas, numeração, ordenação) → **Salvar** atualiza o documento | Univer (MIT) + SheetJS CE (Apache-2.0) |
| **Word/Outros** `.docx .doc .odt .rtf .pptx` | Botão **Editar** → OnlyOffice Document Server (auto-hospedado, gratuito). Sem ele: pré-visualização fiel do .docx + fluxo baixar → editar → reenviar | OnlyOffice Community + docx-preview (Apache-2.0) |

## Como usar (usuário final)

1. **ERP → Documentos** → na linha do documento, clique no ícone **Editar arquivo** (✎ verde) ou abra a pré-visualização e clique em **Editar**.
2. **Planilhas**: edita no editor estilo Excel. Clique em **Salvar** — o sistema gera o arquivo no formato original, envia e vincula como versão atual do documento.
3. **Word/PPT**: com OnlyOffice configurado, o editor abre embutido e salva automaticamente (callback). Sem OnlyOffice, a tela mostra a prévia do documento e os botões **Baixar** e **Reenviar arquivo**.

## Planilhas — funciona imediatamente (zero configuração)

O editor de planilhas já vem pronto e não exige servidor novo. O que é preservado:

- Valores, textos, números, booleans
- Fórmulas (ex.: `=SOMA(A1:A10)`) — recálculo no Univer
- Múltiplas abas (renomear/criar/abas extras valem para o arquivo salvo)
- Datas são exibidas como texto ISO (`AAAA-MM-DD`) nesta versão
- Formatação visual (cores/fontes) **não** é preservada nesta versão (formato de exportação limpo)

## Word — edição completa (automática pelo deploy)

**Nada para configurar.** O `sudo ./deploy.sh` faz tudo sozinho, de forma idempotente:

1. Instala o Docker na VPS (se faltar);
2. Sobe o container **OnlyOffice Document Server** (gratuito) — acessível apenas localmente (`127.0.0.1:8080`);
3. Gera o segredo JWT (uma única vez) e grava `ONLYOFFICE_JWT_SECRET`, `ONLYOFFICE_PUBLIC_URL` e `PUBLIC_BASE_URL` no `backend/.env`;
4. Publica o editor no **mesmo domínio** do site: `https://<seu-dominio>/office` — sem DNS extra, sem certificado extra, sem problemas de HTTPS misto;
5. Aguarda o healthcheck e reinicia backend/nginx.

> Primeira execução: a imagem do OnlyOffice tem ~2 GB, então o deploy pode demorar alguns minutos. O script avisa e continua mesmo se o OnlyOffice estiver lento — em poucos minutos ele responde sozinho (o container reinicia sozinho com `--restart unless-stopped`).

### O que acontece se algo falhar?

Se o Docker ou o OnlyOffice não subirem, o deploy **não quebra**: o sistema continua 100% funcional com as planilhas (Univer, interno) e o editor de Word cai no modo básico (pré-visualização fiel + baixar/reenviar).

### Manual (alternativa, sem deploy.sh)

Na VPS, com Docker instalado:

```bash
docker compose -f docker-compose.onlyoffice.yml up -d
# Document Server disponível em http://IP-DO-SERVIDOR:8080
```

> Edite `docker-compose.onlyoffice.yml` e troque o `JWT_SECRET` (`troque-este-segredo`).

Configure no `backend/.env`:

```env
ONLYOFFICE_PUBLIC_URL=http://IP-DO-SERVIDOR:8080   # ou https://office.suadominio.com (atrás de nginx)
PUBLIC_BASE_URL=https://api.suadominio.com          # URL pública do backend — o OnlyOffice precisa alcançá-la
ONLYOFFICE_JWT_SECRET=troque-este-segredo           # igual ao JWT_SECRET do container
```

Reinicie o backend (`pm2 restart ...` ou equivalente).

### Requisitos de rede (deploy automático já resolve)

- O OnlyOffice roda na mesma VPS e é publicado via nginx no caminho `/office/`, então nunca há bloqueio de conteúdo misto (HTTP dentro de HTTPS).
- O backend acessa o OnlyOffice pela porta local (`127.0.0.1:8080`) e o OnlyOffice acessa o backend pelo endereço público (`PUBLIC_BASE_URL`, gravado automaticamente pelo deploy).

## Endpoints novos (backend)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/office/documents/:id/config` | Config do editor (JWT assinado quando configurado). Requer auth. |
| POST | `/api/office/documents/:id/callback` | Callback de salvamento do OnlyOffice (validado por JWT). |

## Rotas novas (frontend)

| Rota | Descrição |
|---|---|
| `/erp/documentos/:id/editar` | Editor de planilhas (Univer) |
| `/erp/documentos/:id/office` | Editor Office (OnlyOffice) + fallback de prévia |
