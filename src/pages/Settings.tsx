
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';
import CompaniesSettings from '@/components/settings/CompaniesSettings';
import ContractTemplatesSettings from '@/components/settings/ContractTemplatesSettings';
import UsersSettings from '@/components/settings/UsersSettings';

import { useAuth } from '@/hooks/useAuth';

const SUPER_ADMIN_USERNAME = 'phillipe.sodre';

interface Settings {
  theme: string;
  notifications: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  system: {
    version: string;
    lastUpdate: string;
    autoBackup: boolean;
    maintenance_alerts: boolean;
  };
  preferences: {
    language: string;
    timezone: string;
    currency: string;
  };
}

const Settings = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.username === SUPER_ADMIN_USERNAME;
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Ativar tema escuro por padrão
  useEffect(() => {
    if (!theme || theme === 'system') {
      setTheme('dark');
    }
  }, [theme, setTheme]);

  // Carregar configurações do backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({ title: 'Erro ao carregar configurações', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [toast]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const updateSetting = async (path: string, value: any) => {
    if (!settings) return;

    const newSettings = { ...settings };
    const keys = path.split('.');
    let current = newSettings as any;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    setSettings(newSettings);

    try {
      setSaving(true);
      const response = await fetch('http://localhost:3001/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      if (response.ok) {
        toast({ title: 'Configuração atualizada com sucesso!' });
      } else {
        throw new Error('Erro ao salvar');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: 'Erro ao salvar configuração', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <PageHeader title="Configurações" subtitle="Carregando..." />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Configurações" 
        subtitle="Configurações do sistema"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid gap-6 max-w-5xl">
          {isSuperAdmin && <UsersSettings />}
          <CompaniesSettings />
          
          <ContractTemplatesSettings />



          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dark-mode">Tema Escuro</Label>
                  <div className="text-sm text-muted-foreground">
                    Ative o tema escuro para uma experiência visual mais confortável
                  </div>
                </div>
                <Switch
                  id="dark-mode"
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Versão do Sistema</Label>
                  <div className="text-sm text-muted-foreground">
                    {settings?.system.version || 'v1.0.0'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Última Atualização</Label>
                  <div className="text-sm text-muted-foreground">
                    {settings?.system.lastUpdate ? 
                      new Date(settings.system.lastUpdate).toLocaleDateString('pt-BR') : 
                      new Date().toLocaleDateString('pt-BR')
                    }
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-backup">Backup Automático</Label>
                  <div className="text-sm text-muted-foreground">
                    Realizar backup automático dos dados
                  </div>
                </div>
                <Switch 
                  id="auto-backup" 
                  checked={settings?.system.autoBackup || false}
                  onCheckedChange={(value) => updateSetting('system.autoBackup', value)}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notifications">Notificações Push</Label>
                  <div className="text-sm text-muted-foreground">
                    Receba notificações sobre atualizações importantes
                  </div>
                </div>
                <Switch 
                  id="notifications" 
                  checked={settings?.notifications.push || false}
                  onCheckedChange={(value) => updateSetting('notifications.push', value)}
                  disabled={saving}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Notificações por Email</Label>
                  <div className="text-sm text-muted-foreground">
                    Receba relatórios e alertas por email
                  </div>
                </div>
                <Switch 
                  id="email-notifications" 
                  checked={settings?.notifications.email || false}
                  onCheckedChange={(value) => updateSetting('notifications.email', value)}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="maintenance-alerts">Alertas de Manutenção</Label>
                  <div className="text-sm text-muted-foreground">
                    Receba alertas sobre manutenções programadas
                  </div>
                </div>
                <Switch 
                  id="maintenance-alerts" 
                  checked={settings?.system.maintenance_alerts || false}
                  onCheckedChange={(value) => updateSetting('system.maintenance_alerts', value)}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferências</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <Label>Idioma</Label>
                  <div className="text-sm text-muted-foreground">
                    {settings?.preferences.language || 'pt-BR'}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label>Fuso Horário</Label>
                  <div className="text-sm text-muted-foreground">
                    {settings?.preferences.timezone || 'America/Sao_Paulo'}
                  </div>
                </div>
              </div>
              <div className="space-y-0.5">
                <Label>Moeda</Label>
                <div className="text-sm text-muted-foreground">
                  {settings?.preferences.currency || 'BRL'}
                </div>
              </div>
            </CardContent>
          </Card>

          {saving && (
            <div className="text-center text-sm text-muted-foreground">
              Salvando configurações...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
