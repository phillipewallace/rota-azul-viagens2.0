import { Helmet } from "react-helmet-async";

interface PageMetaProps {
  /** Título da página (será sufixado com o nome do produto). */
  title: string;
  /** Meta description (até ~160 chars). */
  description?: string;
  /** Caminho canônico relativo (ex: "/routes"). Default: pathname atual. */
  canonical?: string;
  /** Marca a rota como noindex (telas internas, autenticadas). */
  noindex?: boolean;
}

const BRAND = "AlchemyRotas";

/**
 * Metadados por rota. Aplica title/description/canonical e og:* básicos.
 * Mantém og:* do index.html como fallback para crawlers sem JS.
 */
export function PageMeta({
  title,
  description,
  canonical,
  noindex = false,
}: PageMetaProps) {
  const fullTitle = title.includes(BRAND) ? title : `${title} · ${BRAND}`;
  const path =
    canonical ??
    (typeof window !== "undefined" ? window.location.pathname : "/");

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={path} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:url" content={path} />
      {description && <meta property="og:description" content={description} />}
      {noindex && <meta name="robots" content="noindex,nofollow" />}
    </Helmet>
  );
}
