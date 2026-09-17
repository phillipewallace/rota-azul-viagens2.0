const fs = require('fs');
const p = 'backend/src/routes/erp-office.ts';
let s = fs.readFileSync(p, 'utf8');
const i = s.indexOf('const base = backendPublicUrl(req);');
const j = s.indexOf('res.json({ enabled: true', i);
const block = [
  '    const base = backendPublicUrl(req);',
  '    // Chave de versão: muda sempre que o documento é atualizado (invalida cache do OnlyOffice).',
  '    const key = crypto',
  '      .createHash(\'sha1\')',
  '      .update(`${doc.id}|${doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt}`)',
  '      .digest(\'hex\');',
  '',
  '    const title = doc.arquivoNome || doc.id;',
  '    // Corrige mojibake de nomes UTF-8 que vieram gravados com codificação latin1.',
  '    let tituloCorrigido = title;',
  '    try {',
  '      const latin1 = Buffer.from(title, \'latin1\').toString(\'utf8\');',
        '      if (!latin1.includes("\\uFFFD") && /[ÃÕÇçÉéÍíÓóÚúÂâÊêÎîÔôÛûÀà]/.test(latin1)) tituloCorrigido = latin1;',
  '    } catch { /* mantém original */ }',
  '',
  '    const editorConfig: Record<string, any> = {',
  '      // Configurações que o DocsAPI.DocEditor recebe como \'config\' direto.',
  '      documentType: docType,',
  '      document: {',
  '        fileType: ext,',
  '        key,',
  '        title: tituloCorrigido,',
  '        url: `${base}${doc.arquivoUrl}`,',
  '        permissions: { edit: true, download: true, print: true },',
  '      },',
  '      editorConfig: {',
  '        callbackUrl: `${base}/api/office/documents/${doc.id}/callback`,',
  '        mode: \'edit\',',
  '        lang: \'pt-BR\',',
  '        user: { id: String(req.user?.id || \'anonymous\'), name: req.user?.username || \'Usuário\' },',
  '        customization: {',
  '          forcesave: true,',
  '          compactHeader: true,',
  '          hideRightMenu: true,',
  '          uiTheme: \'theme-classic-light\',',
  '        },',
  '      },',
  '    };',
  '',
  '',
].join('\n');

fs.writeFileSync(p, s.slice(0, i) + block + s.slice(j));
console.log('OK - file rewritten');
