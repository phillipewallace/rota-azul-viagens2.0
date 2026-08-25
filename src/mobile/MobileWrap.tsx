import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileFrame from './MobileFrame';

/**
 * MobileWrap
 * ------------------------------------------------------------------
 * Em telas mobile, envolve a página existente com o shell móvel
 * (header + bottom nav + safe-area). No desktop, renderiza a página
 * intocada. Preserva 100% da lógica das páginas atuais.
 */
const MobileWrap = ({ children, showBack }: { children: ReactNode; showBack?: boolean }) => {
  const isMobile = useIsMobile();
  if (!isMobile) return <>{children}</>;
  return <MobileFrame showBack={showBack}>{children}</MobileFrame>;
};

export default MobileWrap;
