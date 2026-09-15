await client.query(`GRANT ALL ON public.erp_documents TO lipe`).catch(() => undefined);
    await client.query(`GRANT ALL ON SEQUENCE erp_documents_id_seq TO lipe`).catch(() => undefined);

    // ðŸ“¦ Garantir tabela erp_document_files (sub-pasta — múltiplos arquivos por documento)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.erp_document_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES public.erp_documents(id) ON DELETE CASCADE,
        arquivo_url TEXT NOT NULL,
        arquivo_nome TEXT NOT NULL,
        arquivo_tamanho BIGINT,
        arquivo_tipo TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS erp_document_files_document_idx ON public.erp_document_files (document_id)
    `);
    await client.query(`GRANT ALL ON public.erp_document_files TO lipe`).catch(() => undefined);
    await client.query(`GRANT ALL ON SEQUENCE erp_document_files_id_seq TO lipe`).catch(() => undefined);

    console.log('âœ… Extensµes e tabelas base do PostgreSQL verificadas')