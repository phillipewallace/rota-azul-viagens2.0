-- Adiciona campo de imagem de assinatura nas empresas emissoras.
-- Quando preenchido, a assinatura é renderizada automaticamente acima
-- da linha da LOCADORA nos contratos gerados em PDF.
ALTER TABLE erp_companies ADD COLUMN IF NOT EXISTS assinatura_url TEXT;
