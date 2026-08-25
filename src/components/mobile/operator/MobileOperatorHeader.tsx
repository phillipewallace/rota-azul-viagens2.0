import { Menu, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import MobileOperatorMenu from './MobileOperatorMenu';

interface MobileOperatorHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

const MobileOperatorHeader = ({ title, showBack, onBack }: MobileOperatorHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border z-40 flex items-center px-4 safe-area-top transition-colors duration-200">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {showBack ? (
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 -ml-2"
            onClick={handleBack}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 -ml-2"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <MobileOperatorMenu />
            </SheetContent>
          </Sheet>
        )}

        {title ? (
          <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
        ) : (
          <span className="text-lg font-bold tracking-tight text-primary">
            AlchemyRotas
          </span>
        )}
      </div>
    </header>
  );
};

export default MobileOperatorHeader;
