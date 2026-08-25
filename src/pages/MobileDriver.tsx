import { useState } from "react";
import { Truck, LogOut, AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { API_BASE_URL } from "@/services/config";
import { OfflineBanner } from "@/components/mobile/OfflineBanner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface TruckData {
  id: string;
  name: string;
  plate: string;
  model: string;
}

const MobileDriver = () => {
  const [plateNumber, setPlateNumber] = useState("");
  const [truckData, setTruckData] = useState<TruckData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnlineStatus();

  const updateActiveTrackingInStorage = (truckId: string | null, isActive: boolean) => {
    try {
      const stored = localStorage.getItem("active-truck-tracking") || "[]";
      let activeTrucks = JSON.parse(stored);

      if (isActive && truckId && !activeTrucks.includes(truckId)) {
        activeTrucks.push(truckId);
      } else if (!isActive && truckId) {
        activeTrucks = activeTrucks.filter((id: string) => id !== truckId);
      }

      localStorage.setItem("active-truck-tracking", JSON.stringify(activeTrucks));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "active-truck-tracking",
          newValue: JSON.stringify(activeTrucks),
        }),
      );
    } catch (err) {
      console.error("Error updating active tracking storage:", err);
    }
  };

  const handleLogin = async () => {
    const plate = plateNumber.trim();
    if (!plate) {
      setError("Por favor, insira o número da placa");
      return;
    }
    if (!online) {
      setError("Sem conexão · conecte-se à internet para entrar");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "omit",
      });

      if (!response.ok) {
        throw new Error("Caminhão não encontrado");
      }

      const data: TruckData = await response.json();
      setTruckData(data);
      setIsLoggedIn(true);
      updateActiveTrackingInStorage(data.id, true);
      toast.success(`Bem-vindo, ${data.name}!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (truckData?.id) updateActiveTrackingInStorage(truckData.id, false);
    setIsLoggedIn(false);
    setTruckData(null);
    setPlateNumber("");
    setError(null);
    toast.success("Logout realizado");
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <>
      <OfflineBanner />
      <main className="min-h-[100dvh] bg-gradient-to-b from-background to-muted/40 flex items-center justify-center px-4 py-8 safe-area-top safe-area-bottom">
        <Card className="w-full max-w-sm border-border/60 shadow-lg shadow-foreground/5">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Cabeçalho */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div
                aria-hidden
                className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"
              >
                <Truck className="h-7 w-7" strokeWidth={2.25} />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {isLoggedIn ? "Painel do Motorista" : "Acessar caminhão"}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isLoggedIn
                    ? "Você está rastreando este veículo"
                    : "Informe a placa para começar a rota"}
                </p>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Conteúdo */}
            {isLoggedIn && truckData ? (
              <div className="space-y-4">
                <dl className="rounded-xl border border-border/60 bg-muted/30 divide-y divide-border/60">
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Motorista
                    </dt>
                    <dd className="text-sm font-semibold text-foreground truncate max-w-[60%] text-right">
                      {truckData.name}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Placa
                    </dt>
                    <dd className="text-sm font-mono font-semibold text-foreground">
                      {truckData.plate}
                    </dd>
                  </div>
                </dl>
                <Button
                  variant="destructive"
                  className="w-full min-h-11 text-sm font-medium transition-all duration-200"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" aria-hidden />
                  Sair
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="plate" className="text-xs font-medium text-foreground">
                    Placa do caminhão
                  </Label>
                  <Input
                    id="plate"
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="ABC-1234"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    onKeyDown={onKey}
                    disabled={loading}
                    aria-invalid={!!error}
                    aria-describedby={error ? "plate-error" : undefined}
                    className="min-h-11 text-base tracking-wider font-mono uppercase placeholder:font-sans placeholder:text-muted-foreground/70 placeholder:normal-case placeholder:tracking-normal transition-shadow duration-200"
                  />
                </div>
                <Button
                  className="w-full min-h-11 text-sm font-medium transition-all duration-200"
                  onClick={handleLogin}
                  disabled={loading || !plateNumber.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                      Carregando…
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default MobileDriver;
