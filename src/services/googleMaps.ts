declare global {
  interface Window {
    google: any;
  }
}

export class GoogleMapsService {
  private static instance: GoogleMapsService;
  private directionsService: any;
  private geocoder: any;
  private isLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): GoogleMapsService {
    if (!GoogleMapsService.instance) {
      GoogleMapsService.instance = new GoogleMapsService();
    }
    return GoogleMapsService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isLoaded && window.google?.maps?.DirectionsService) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = new Promise((resolve, reject) => {
      if (window.google?.maps?.DirectionsService) {
        this.initializeServices();
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w&libraries=geometry,places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        const checkGoogleMaps = () => {
          if (window.google?.maps?.DirectionsService && window.google?.maps?.Geocoder) {
            this.initializeServices();
            resolve();
          } else {
            setTimeout(checkGoogleMaps, 100);
          }
        };
        checkGoogleMaps();
      };
      
      script.onerror = () => reject(new Error('Failed to load Google Maps API'));
      
      document.head.appendChild(script);
    });

    return this.loadingPromise;
  }

  private initializeServices(): void {
    try {
      this.directionsService = new window.google.maps.DirectionsService();
      this.geocoder = new window.google.maps.Geocoder();
      this.isLoaded = true;
      console.log('✅ [GOOGLE MAPS] Services initialized successfully');
    } catch (error) {
      console.error('❌ [GOOGLE MAPS] Error initializing services:', error);
      throw error;
    }
  }

  async getAddressByCep(cep: string): Promise<{ address: string; lat: number; lng: number; cep: string }> {
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const viaCepData = await viaCepResponse.json();
    
    if (viaCepData.erro) {
      throw new Error('CEP não encontrado');
    }

    const address = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
    
    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ address }, (results: any[], status: string) => {
        if (status === 'OK' && results.length > 0) {
          const location = results[0].geometry.location;
          resolve({
            address,
            cep,
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          resolve({
            address,
            cep,
            lat: -23.5505,
            lng: -46.6333
          });
        }
      });
    });
  }

  // ✅ MELHORADO: Otimização mais robusta com validação de coordenadas
  async optimizeRoute(points: any[]): Promise<{
    optimizedOrder: string[];
    totalDistance: number;
    estimatedTime: string;
    polyline: string;
    detailedRoute: any;
  }> {
    if (!this.directionsService) {
      await this.initialize();
    }

    console.log(`🚀 [GOOGLE MAPS] Otimizando rota com ${points.length} pontos`);

    // ✅ VALIDAR COORDENADAS ANTES DE PROCESSAR
    const validPoints = points.filter(p => this.isValidCoordinate(p.lat) && this.isValidCoordinate(p.lng));
    
    if (validPoints.length < 2) {
      console.error('❌ [GOOGLE MAPS] Coordenadas inválidas ou insuficientes');
      throw new Error('Coordenadas inválidas ou insuficientes');
    }

    if (validPoints.length !== points.length) {
      console.warn(`⚠️ [GOOGLE MAPS] ${points.length - validPoints.length} pontos com coordenadas inválidas foram ignorados`);
    }

    const origin = validPoints.find(p => p.type === 'origin') || validPoints[0];
    const destination = validPoints.find(p => p.type === 'destination') || validPoints[validPoints.length - 1];
    const waypoints = validPoints.filter(p => p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id));

    const MAX_WAYPOINTS = 20; // ✅ LIMITE MAIS CONSERVADOR
    
    if (waypoints.length > MAX_WAYPOINTS) {
      console.log(`⚠️ [GOOGLE MAPS] Muitos waypoints (${waypoints.length}), usando apenas os primeiros ${MAX_WAYPOINTS}`);
      waypoints.splice(MAX_WAYPOINTS);
    }

    const waypointsFormatted = waypoints.map(p => ({
      location: new window.google.maps.LatLng(p.lat, p.lng),
      stopover: true
    }));

    return new Promise((resolve, reject) => {
      const request = {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypointsFormatted,
        optimizeWaypoints: true,
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
      };

      console.log(`📡 [GOOGLE MAPS] Enviando requisição com ${waypointsFormatted.length} waypoints`);

      this.directionsService.route(request, (result: any, status: string) => {
        if (status === 'OK' && result) {
          const route = result.routes[0];
          let totalDistance = 0;
          let totalDuration = 0;

          route.legs.forEach((leg: any) => {
            if (leg.distance && leg.distance.value) totalDistance += leg.distance.value;
            if (leg.duration && leg.duration.value) totalDuration += leg.duration.value;
          });

          // ✅ VALIDAR VALORES CALCULADOS
          if (isNaN(totalDistance) || totalDistance <= 0) {
            console.warn('⚠️ [GOOGLE MAPS] Distância inválida, usando estimativa');
            totalDistance = validPoints.length * 5000; // 5km por ponto como estimativa
          }

          if (isNaN(totalDuration) || totalDuration <= 0) {
            console.warn('⚠️ [GOOGLE MAPS] Duração inválida, usando estimativa');
            totalDuration = totalDistance * 0.06; // ~60km/h média
          }

          const hours = Math.floor(totalDuration / 3600);
          const minutes = Math.floor((totalDuration % 3600) / 60);
          const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

          let optimizedOrder = [origin.id];
          if (route.waypoint_order && route.waypoint_order.length > 0) {
            optimizedOrder.push(...route.waypoint_order.map((index: number) => waypoints[index].id));
          }
          optimizedOrder.push(destination.id);

          console.log(`✅ [GOOGLE MAPS] Rota otimizada: ${(totalDistance/1000).toFixed(1)}km, ${estimatedTime}`);

          resolve({
            optimizedOrder,
            totalDistance: totalDistance / 1000,
            estimatedTime,
            polyline: route.overview_polyline,
            detailedRoute: result
          });
        } else {
          console.error(`❌ [GOOGLE MAPS] Directions request failed: ${status}`);
          
          // ✅ FALLBACK: Retornar rota simples sem otimização
          if (status === 'OVER_QUERY_LIMIT' || status === 'REQUEST_DENIED' || status === 'ZERO_RESULTS') {
            console.log('🔄 [GOOGLE MAPS] Usando fallback simples');
            
            // Calcular distância estimada simples
            const estimatedDistance = this.calculateSimpleDistance(validPoints);
            const estimatedDuration = estimatedDistance * 60; // 1 min por km
            const hours = Math.floor(estimatedDuration / 3600);
            const minutes = Math.floor((estimatedDuration % 3600) / 60);
            const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
            
            resolve({
              optimizedOrder: validPoints.map(p => p.id),
              totalDistance: estimatedDistance,
              estimatedTime: estimatedTime,
              polyline: '',
              detailedRoute: null
            });
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        }
      });
    });
  }

  // ✅ NOVA FUNÇÃO: Validação de coordenadas
  private isValidCoordinate(coord: any): boolean {
    return typeof coord === 'number' && !isNaN(coord) && isFinite(coord) && coord !== 0;
  }

  // ✅ NOVA FUNÇÃO: Cálculo simples de distância para fallback
  private calculateSimpleDistance(points: any[]): number {
    if (points.length < 2) return 0;
    
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const point1 = points[i];
      const point2 = points[i + 1];
      
      if (this.isValidCoordinate(point1.lat) && this.isValidCoordinate(point1.lng) && 
          this.isValidCoordinate(point2.lat) && this.isValidCoordinate(point2.lng)) {
        total += this.calculateHaversineDistance(point1, point2);
      }
    }
    return total;
  }

  // ✅ FUNÇÃO AUXILIAR: Cálculo Haversine
  private calculateHaversineDistance(point1: any, point2: any): number {
    const R = 6371; // Raio da Terra em km
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
             Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  async getDirections(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<any> {
    if (!this.directionsService) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.directionsService.route({
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC
      }, (result: any, status: string) => {
        if (status === 'OK') {
          resolve(result);
        } else {
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  }
}

export const googleMapsService = GoogleMapsService.getInstance();
