/**
 * Página de Gestão de Funcionários
 * Adicionado botão de voltar para o Dashboard do ERP.
 */
import React, { lazy, Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Users, UserPlus, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';

const FuncionariosList = lazy(() => import('./FuncionariosList'));

const FuncionariosPage = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="rounded-full hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão de Funcionários</h1>
            <p className="text-sm text-muted-foreground">Controle de acessos, CPF e equipe de campo.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 h-9 px-3"
            onClick={() => navigate('/erp')}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 h-9 px-3"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div id="stats-total-funcionarios">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Equipe</p>
              <p className="text-2xl font-black">...</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lista" className="gap-2"><Users className="h-4 w-4" /> Todos Funcionários</TabsTrigger>
          <TabsTrigger value="novo" className="gap-2"><UserPlus className="h-4 w-4" /> Admissão</TabsTrigger>
        </TabsList>
        <TabsContent value="lista">
          <Suspense fallback={<div className="p-10 text-center text-muted-foreground">Carregando listagem...</div>}>
            <FuncionariosList />
          </Suspense>
        </TabsContent>
        <TabsContent value="novo">
          <div className="max-w-2xl mx-auto py-8">
            <Card className="p-6">
                <div className="text-center space-y-2 mb-6">
                    <UserPlus className="h-10 w-10 text-primary mx-auto" />
                    <h3 className="text-lg font-bold">Nova Admissão</h3>
                    <p className="text-sm text-muted-foreground">O cadastro pode ser feito diretamente pelo botão "Novo Funcionário" na lista.</p>
                </div>
                <div className="flex justify-center">
                    <Button onClick={() => {
                        const trigger = document.querySelector('[value="lista"]') as HTMLButtonElement;
                        trigger?.click();
                        setTimeout(() => {
                           const btn = document.querySelector('button.gap-2') as HTMLButtonElement;
                           btn?.click();
                        }, 100);
                    }}>
                        Ir para Formulário
                    </Button>
                </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FuncionariosPage;
