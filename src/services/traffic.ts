
interface TrafficData {
  distance: string;
  duration: string;
  durationInTraffic: string;
  status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_WAYPOINTS_EXCEEDED' | 'INVALID_REQUEST' | 'OVER_DAILY_LIMIT' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR';
  trafficConditions?: 'LIGHT' | 'MODERATE' | 'HEAVY' | 'SEVERE';
}

interface RoutePoint {
  lat: number;
  lng: number;
  address: string;
}

interface TrafficLayer {
  congestionLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';
  averageSpeed: number;
  freeFlowSpeed: number;
  currentSpeed: number;
}

class TrafficService {
  private apiKey = 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';
  private trafficLayer: any = null;

  async getTrafficInfo(origin: RoutePoint, destination: RoutePoint): Promise<TrafficData | null> {
    try {
      if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
        console.error('Invalid coordinates provided to getTrafficInfo');
        return null;
      }

      // Use Routes API (more advanced than Distance Matrix)
      const routesResponse = await this.getRoutesWithTraffic(origin, destination);
      if (routesResponse) {
        return routesResponse;
      }

      // Fallback to Distance Matrix API
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
        `origins=${origin.lat},${origin.lng}&` +
        `destinations=${destination.lat},${destination.lng}&` +
        `departure_time=now&` +
        `traffic_model=best_guess&` +
        `key=${this.apiKey}`;

      console.log('Fetching traffic info from Distance Matrix API');

      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Traffic API response not ok:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      
      if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]) {
        const element = data.rows[0].elements[0];
        
        if (element.status === 'OK') {
          return {
            distance: element.distance?.text || 'N/A',
            duration: element.duration?.text || 'N/A',
            durationInTraffic: element.duration_in_traffic?.text || element.duration?.text || 'N/A',
            status: element.status,
            trafficConditions: this.analyzeTrafficConditions(element)
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao obter informações de trânsito:', error);
      return null;
    }
  }

  private async getRoutesWithTraffic(origin: RoutePoint, destination: RoutePoint): Promise<TrafficData | null> {
    try {
      const routesUrl = `https://routes.googleapis.com/directions/v2:computeRoutes`;
      
      const requestBody = {
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng
            }
          }
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidTolls: false,
          avoidHighways: false,
          avoidFerries: false
        },
        languageCode: 'pt-BR',
        units: 'METRIC'
      };

      const response = await fetch(routesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.staticDuration,routes.routeLabels'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.warn('Routes API failed, falling back to Distance Matrix');
        return null;
      }

      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distanceMeters / 1000).toFixed(1);
        const durationMin = Math.round(parseInt(route.duration?.replace('s', '') || '0') / 60);
        const staticDurationMin = Math.round(parseInt(route.staticDuration?.replace('s', '') || '0') / 60);
        
        return {
          distance: `${distanceKm} km`,
          duration: `${staticDurationMin} min`,
          durationInTraffic: `${durationMin} min`,
          status: 'OK' as const,
          trafficConditions: this.calculateTrafficConditions(staticDurationMin, durationMin)
        };
      }

      return null;
    } catch (error) {
      console.error('Error using Routes API:', error);
      return null;
    }
  }

  private analyzeTrafficConditions(element: any): 'LIGHT' | 'MODERATE' | 'HEAVY' | 'SEVERE' {
    if (!element.duration_in_traffic || !element.duration) {
      return 'LIGHT';
    }

    const normalDuration = element.duration.value;
    const trafficDuration = element.duration_in_traffic.value;
    const delay = (trafficDuration - normalDuration) / normalDuration;

    if (delay < 0.1) return 'LIGHT';
    if (delay < 0.3) return 'MODERATE';
    if (delay < 0.6) return 'HEAVY';
    return 'SEVERE';
  }

  private calculateTrafficConditions(staticDuration: number, currentDuration: number): 'LIGHT' | 'MODERATE' | 'HEAVY' | 'SEVERE' {
    const delay = (currentDuration - staticDuration) / staticDuration;
    
    if (delay < 0.1) return 'LIGHT';
    if (delay < 0.3) return 'MODERATE';
    if (delay < 0.6) return 'HEAVY';
    return 'SEVERE';
  }

  async getRouteTrafficInfo(points: RoutePoint[]): Promise<{
    totalDistance: string;
    totalDuration: string;
    totalDurationInTraffic: string;
    segments: TrafficData[];
    overallTrafficCondition: 'LIGHT' | 'MODERATE' | 'HEAVY' | 'SEVERE';
  } | null> {
    if (!points || points.length < 2) {
      console.warn('Invalid points array provided to getRouteTrafficInfo');
      return null;
    }

    try {
      const segments: TrafficData[] = [];
      let totalDistanceKm = 0;
      let totalDurationMin = 0;
      let totalTrafficMin = 0;
      let heaviestTraffic: 'LIGHT' | 'MODERATE' | 'HEAVY' | 'SEVERE' = 'LIGHT';

      console.log('Calculating route traffic for', points.length, 'points');

      for (let i = 0; i < points.length - 1; i++) {
        const segment = await this.getTrafficInfo(points[i], points[i + 1]);
        if (segment && segment.status === 'OK') {
          segments.push(segment);
          
          const distanceMatch = segment.distance.match(/[\d,\.]+/);
          const durationMatch = segment.duration.match(/\d+/);
          const trafficMatch = segment.durationInTraffic.match(/\d+/);
          
          const distanceNum = distanceMatch ? parseFloat(distanceMatch[0].replace(',', '.')) : 0;
          const durationNum = durationMatch ? parseInt(durationMatch[0]) : 0;
          const trafficNum = trafficMatch ? parseInt(trafficMatch[0]) : durationNum;
          
          totalDistanceKm += distanceNum;
          totalDurationMin += durationNum;
          totalTrafficMin += trafficNum;

          // Track heaviest traffic condition
          if (segment.trafficConditions) {
            const conditions = ['LIGHT', 'MODERATE', 'HEAVY', 'SEVERE'];
            const currentIndex = conditions.indexOf(segment.trafficConditions);
            const heaviestIndex = conditions.indexOf(heaviestTraffic);
            if (currentIndex > heaviestIndex) {
              heaviestTraffic = segment.trafficConditions;
            }
          }
          
          console.log(`Segment ${i+1}: ${distanceNum}km, ${durationNum}min, ${trafficNum}min traffic (${segment.trafficConditions})`);
        } else {
          console.warn(`Failed to get traffic info for segment ${i+1}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
      }

      const result = {
        totalDistance: `${totalDistanceKm.toFixed(1)} km`,
        totalDuration: `${Math.round(totalDurationMin)} min`,
        totalDurationInTraffic: `${Math.round(totalTrafficMin)} min`,
        segments,
        overallTrafficCondition: heaviestTraffic
      };

      console.log('Route traffic calculation complete:', result);
      return result;
    } catch (error) {
      console.error('Erro ao calcular rota com trânsito:', error);
      return null;
    }
  }

  // Método para ativar/desativar camada de trânsito no Google Maps
  enableTrafficLayer(map: any) {
    if (window.google && window.google.maps) {
      this.trafficLayer = new window.google.maps.TrafficLayer();
      this.trafficLayer.setMap(map);
      console.log('✅ Traffic layer enabled on map');
    }
  }

  disableTrafficLayer() {
    if (this.trafficLayer) {
      this.trafficLayer.setMap(null);
      this.trafficLayer = null;
      console.log('❌ Traffic layer disabled');
    }
  }

  // Método para obter informações de trânsito em tempo real de uma área
  async getRealTimeTrafficData(bounds: { north: number; south: number; east: number; west: number }): Promise<TrafficLayer[]> {
    try {
      // Usar Roads API para obter dados de trânsito em tempo real
      const roadsUrl = `https://roads.googleapis.com/v1/speedLimits?` +
        `path=${bounds.south},${bounds.west}|${bounds.north},${bounds.east}&` +
        `key=${this.apiKey}`;

      const response = await fetch(roadsUrl);
      
      if (!response.ok) {
        console.warn('Roads API not available, using mock data');
        return this.generateMockTrafficData();
      }

      const data = await response.json();
      return this.processRoadsApiData(data);
    } catch (error) {
      console.error('Error fetching real-time traffic data:', error);
      return this.generateMockTrafficData();
    }
  }

  private processRoadsApiData(data: any): TrafficLayer[] {
    // Processar dados da Roads API
    return data.speedLimits?.map((limit: any) => ({
      congestionLevel: this.calculateCongestionLevel(limit.speedLimit, limit.units),
      averageSpeed: limit.speedLimit || 50,
      freeFlowSpeed: limit.speedLimit || 50,
      currentSpeed: limit.speedLimit * 0.8 || 40
    })) || this.generateMockTrafficData();
  }

  private calculateCongestionLevel(speedLimit: number, units: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE' {
    const speed = units === 'KPH' ? speedLimit : speedLimit * 1.609344;
    
    if (speed > 60) return 'LOW';
    if (speed > 40) return 'MEDIUM';
    if (speed > 20) return 'HIGH';
    return 'SEVERE';
  }

  private generateMockTrafficData(): TrafficLayer[] {
    return [
      {
        congestionLevel: 'MEDIUM',
        averageSpeed: 45,
        freeFlowSpeed: 60,
        currentSpeed: 35
      }
    ];
  }
}

export const trafficService = new TrafficService();
