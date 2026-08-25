interface OptimizationPoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
  completedAt?: string;
}

interface OptimizationResult {
  optimizedPoints: OptimizationPoint[];
  totalDistance: number;
  totalDuration: number;
  polyline: string;
  optimizedOrder: string[];
}

// ✅ NOVA INTERFACE - Para clustering geográfico
interface GeographicalCluster {
  centroid: { lat: number; lng: number };
  points: OptimizationPoint[];
  clusterId: number;
}

import { optimizeLargeRoute } from './hybridOptimizer';

class GoogleMapsOptimizer {
  private apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
  private readonly ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  private readonly MAX_WAYPOINTS = 25; // ✅ ATUALIZADO: Routes API v2 suporta 25 waypoints intermediários

  async optimizeRouteWithGoogleAPIs(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER V2] Otimizando ${points.length} pontos com Routes API v2 (MAX 25 waypoints)`);
    
    if (points.length < 2) {
      throw new Error('Necessário pelo menos 2 pontos para otimizar');
    }

    // Para rotas simples (2 pontos)
    if (points.length === 2) {
      return await this.optimizeTwoPointRoute(points);
    }

    // ✅ ATUALIZADO: Aplicar limite de 25 waypoints antes da otimização
    if (points.length > this.MAX_WAYPOINTS + 2) {
      console.log(`⚠️ [OPTIMIZER V2] Rota muito grande (${points.length} pontos), limitando a ${this.MAX_WAYPOINTS + 2} pontos`);
      return await this.handleLargeRoute(points);
    }

    // Para rotas normais, usar Routes API v2 diretamente
    return await this.optimizeWithRoutesAPIv2(points);
  }

  private async optimizeTwoPointRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    const [origin, destination] = points;
    
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
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      departureTime: new Date(Date.now() + 60_000).toISOString(),
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      units: 'METRIC'
    };

    try {
      const response = await fetch(this.ROUTES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [OPTIMIZER V2] Routes API error:`, errorText);
        throw new Error(`Routes API v2 error: ${response.status}`);
      }

      const data = await response.json() as any;

      if (!data.routes?.length) {
        throw new Error('Nenhuma rota encontrada');
      }

      const route = data.routes[0];
      const totalDistance = route.distanceMeters / 1000;
      const totalDuration = parseInt(route.duration?.replace('s', '') || '0');

      return {
        optimizedPoints: [
          { ...origin, order: 0, type: 'origin' },
          { ...destination, order: 1, type: 'destination' }
        ],
        totalDistance,
        totalDuration,
        polyline: route.polyline?.encodedPolyline || '',
        optimizedOrder: [origin.id, destination.id]
      };

    } catch (error) {
      console.error('❌ [OPTIMIZER V2] Erro na otimização 2 pontos:', error);
      throw error;
    }
  }

  private async optimizeWithRoutesAPIv2(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER V2] ========================================`);
    console.log(`🎯 [OPTIMIZER V2] Recebendo ${points.length} pontos para otimizar`);
    
    // ✅ LOGAR CADA PONTO RECEBIDO COM SEU TIPO
    points.forEach((p, i) => {
      console.log(`  ${i}. [${p.type || 'SEM TIPO'}] ${p.address?.substring(0, 40)}`);
    });
    
    // Identificar origem e destino pelo tipo, não pela posição
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    
    // Filtrar APENAS waypoints verdadeiros, excluindo origem e destino
    const waypoints = points.filter(p => 
      p.type === 'waypoint' && p.id !== origin.id && p.id !== destination.id
    );

    console.log(`🚀 [OPTIMIZER V2] Distribuição após filtragem:`);
    console.log(`   ✅ Origem [FIXO]: ${origin.address?.substring(0, 40)}`);
    console.log(`   🔄 Waypoints [SERÃO OTIMIZADOS]: ${waypoints.length} ponto(s)`);
    waypoints.forEach((wp, i) => {
      console.log(`     ${i+1}. ${wp.address?.substring(0, 40)}`);
    });
    console.log(`   ✅ Destino [FIXO]: ${destination.address?.substring(0, 40)}`);

    // ✅ CRÍTICO: Aplicar limite rigoroso de 25 waypoints
    const limitedWaypoints = waypoints.slice(0, this.MAX_WAYPOINTS);
    
    if (waypoints.length > this.MAX_WAYPOINTS) {
      console.log(`⚠️ [OPTIMIZER V2] Limitando waypoints: ${waypoints.length} → ${this.MAX_WAYPOINTS}`);
    }

    console.log(`🚀 [OPTIMIZER V2] Processando ${limitedWaypoints.length} waypoints de ${waypoints.length} totais`);

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
      intermediates: limitedWaypoints.map(wp => ({
        location: {
          latLng: {
            latitude: wp.lat,
            longitude: wp.lng
          }
        }
      })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      departureTime: new Date(Date.now() + 60_000).toISOString(),
      optimizeWaypointOrder: true,
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      units: 'METRIC'
    };

    try {
      console.log(`📡 [OPTIMIZER V2] Enviando requisição para Routes API v2 com ${limitedWaypoints.length} waypoints`);
      
      const response = await fetch(this.ROUTES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [OPTIMIZER V2] Routes API error:`, errorText);
        throw new Error(`Routes API v2 error: ${response.status}`);
      }

      const data = await response.json() as any;

      if (!data.routes?.length) {
        throw new Error('Nenhuma rota encontrada');
      }

      const route = data.routes[0];
      let optimizedPoints: any[] = [{ ...origin, order: 0, type: 'origin' as const }];

      // Reordenar waypoints conforme otimização do Google
      if (route.optimizedIntermediateWaypointIndex && limitedWaypoints.length > 0) {
        console.log(`🔄 [OPTIMIZER V2] Reordenando ${limitedWaypoints.length} waypoints conforme otimização`);
        
        const reorderedWaypoints = route.optimizedIntermediateWaypointIndex
          .map((index: number, newOrder: number) => ({
            ...limitedWaypoints[index],
            order: newOrder + 1,
            type: 'waypoint' as const
          }));
        optimizedPoints.push(...reorderedWaypoints);
      } else {
        optimizedPoints.push(
          ...limitedWaypoints.map((wp, index) => ({
            ...wp,
            order: index + 1,
            type: 'waypoint' as const
          }))
        );
      }

      // ✅ MELHORADO: Adicionar waypoints excedentes que não puderam ser otimizados no final
      if (waypoints.length > this.MAX_WAYPOINTS) {
        const excessWaypoints = waypoints.slice(this.MAX_WAYPOINTS).map((wp, index) => ({
          ...wp,
          order: optimizedPoints.length + index,
          type: 'waypoint' as const
        }));
        optimizedPoints.push(...excessWaypoints);
        
        console.log(`📍 [OPTIMIZER V2] Adicionados ${excessWaypoints.length} waypoints excedentes não otimizados`);
      }

      // Garantir que o destino seja sempre o último
      optimizedPoints.push({
        ...destination,
        order: optimizedPoints.length,
        type: 'destination' as const
      });

      const totalDistance = route.distanceMeters / 1000;
      const totalDuration = parseInt(route.duration?.replace('s', '') || '0');

      console.log(`✅ [OPTIMIZER V2] Otimizada: ${totalDistance.toFixed(1)}km, ${Math.round(totalDuration/60)}min`);
      console.log(`📊 [OPTIMIZER V2] Total de pontos processados: ${optimizedPoints.length}`);

      return {
        optimizedPoints,
        totalDistance,
        totalDuration,
        polyline: route.polyline?.encodedPolyline || '',
        optimizedOrder: optimizedPoints.map(p => p.id)
      };

    } catch (error) {
      console.error('❌ [OPTIMIZER V2] Erro na otimização Routes API v2:', error);
      throw error;
    }
  }

  private async handleLargeRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`📊 [OPTIMIZER V2] Rota grande (${points.length} pts) → delegando ao HYBRID OPTIMIZER (NN + 2-opt + or-opt)`);

    try {
      const hybrid = await optimizeLargeRoute(points.map(p => ({
        id: p.id,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        type: p.type,
      })) as any);

      const optimizedPoints = hybrid.optimizedPoints.map((p: any, i: number) => {
        const orig = points.find(x => x.id === p.id) || p;
        return {
          ...orig,
          order: i,
          type: (i === 0 ? 'origin' : i === hybrid.optimizedPoints.length - 1 ? 'destination' : 'waypoint') as any,
        };
      });

      return {
        optimizedPoints,
        totalDistance: hybrid.totalDistance,
        totalDuration: hybrid.totalDuration,
        polyline: hybrid.polyline,
        optimizedOrder: optimizedPoints.map(p => p.id),
      };
    } catch (error) {
      console.error('❌ [OPTIMIZER V2] Hybrid falhou, fallback ordem original:', error);
      const origin = points.find(p => p.type === 'origin') || points[0];
      const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
      const waypoints = points.filter(p => p.type === 'waypoint' && p.id !== origin.id && p.id !== destination.id);
      const fb = [origin, ...waypoints, destination].map((point, index) => ({ ...point, order: index }));
      return {
        optimizedPoints: fb,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: fb.map(p => p.id),
      };
    }
  }


  async optimizePartialRoute(
    completedPoints: OptimizationPoint[], 
    remainingPoints: OptimizationPoint[]
  ): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER PARTIAL] Otimização parcial - ${completedPoints.length} concluídos, ${remainingPoints.length} restantes`);
    
    if (remainingPoints.length === 0) {
      console.log(`✅ [OPTIMIZER PARTIAL] Nenhum ponto pendente - retornando pontos concluídos`);
      return {
        optimizedPoints: completedPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: completedPoints.map(p => p.id)
      };
    }

    if (remainingPoints.length === 1) {
      console.log(`✅ [OPTIMIZER PARTIAL] Apenas 1 ponto pendente - concatenando`);
      const allPoints = [
        ...completedPoints,
        { ...remainingPoints[0], order: completedPoints.length }
      ];
      
      return {
        optimizedPoints: allPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: allPoints.map(p => p.id)
      };
    }

    try {
      const lastCompletedPoint = completedPoints[completedPoints.length - 1];
      console.log(`🚀 [OPTIMIZER PARTIAL] Otimizando a partir do último ponto concluído: ${lastCompletedPoint.address}`);
      
      // ✅ CORRIGIDO: Aplicar clustering se há muitos pontos pendentes (independente de concluídos)
      if (remainingPoints.length > this.MAX_WAYPOINTS) {
        console.log(`🗺️ [OPTIMIZER PARTIAL] Muitos pontos pendentes (${remainingPoints.length}) - aplicando clustering geográfico`);
        return await this.optimizePartialRouteWithClustering(completedPoints, remainingPoints);
      }

      // Para rotas menores, usar lógica original
      const pointsToOptimize = [
        { ...lastCompletedPoint, type: 'origin' as const },
        ...remainingPoints.slice(0, -1).map(p => ({ ...p, type: 'waypoint' as const })),
        { ...remainingPoints[remainingPoints.length - 1], type: 'destination' as const }
      ];

      const optimizationResult = await this.optimizeWithRoutesAPIv2(pointsToOptimize);
      
      const finalPoints = [
        ...completedPoints.slice(0, -1),
        ...optimizationResult.optimizedPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length - 1 + index,
          completed: index === 0 ? true : false
        }))
      ];

      console.log(`✅ [OPTIMIZER PARTIAL] Otimização parcial concluída - ${finalPoints.length} pontos finais`);

      return {
        optimizedPoints: finalPoints,
        totalDistance: optimizationResult.totalDistance,
        totalDuration: optimizationResult.totalDuration,
        polyline: optimizationResult.polyline,
        optimizedOrder: finalPoints.map(p => p.id)
      };
      
    } catch (error) {
      console.error('❌ [OPTIMIZER PARTIAL] Erro na otimização parcial:', error);
      
      // Fallback: manter ordem atual sem otimização
      const fallbackPoints = [
        ...completedPoints,
        ...remainingPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length + index,
          completed: false
        }))
      ];
      
      console.log(`⚠️ [OPTIMIZER PARTIAL] Usando fallback - ${fallbackPoints.length} pontos sem otimização`);
      
      return {
        optimizedPoints: fallbackPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: fallbackPoints.map(p => p.id)
      };
    }
  }

  // ✅ CORRIGIDO: Otimização parcial com clustering geográfico - SEM dupla limitação
  private async optimizePartialRouteWithClustering(
    completedPoints: OptimizationPoint[], 
    remainingPoints: OptimizationPoint[]
  ): Promise<OptimizationResult> {
    console.log(`🗺️ [OPTIMIZER CLUSTERING] Iniciando otimização com clustering - ${remainingPoints.length} pontos pendentes`);
    
    try {
      const lastCompletedPoint = completedPoints[completedPoints.length - 1];
      
      // ✅ Aplicar clustering geográfico nos pontos pendentes
      const clusters = this.applyGeographicalClustering(remainingPoints, this.MAX_WAYPOINTS);
      console.log(`🎯 [OPTIMIZER CLUSTERING] ${remainingPoints.length} pontos agrupados em ${clusters.length} clusters`);
      
      // ✅ Ordenar clusters para conectividade otimizada
      const orderedClusters = this.orderClustersOptimally(clusters, lastCompletedPoint);
      
      let allOptimizedPoints = [...completedPoints.slice(0, -1)]; // Todos exceto o último
      let totalDistance = 0;
      let totalDuration = 0;
      let finalPolyline = '';
      
      // ✅ CORRIGIDO: Processar cada cluster DIRETAMENTE com optimizeWithRoutesAPIv2
      for (let i = 0; i < orderedClusters.length; i++) {
        const cluster = orderedClusters[i];
        const isLastCluster = i === orderedClusters.length - 1;
        
        // Determinar origem e destino do cluster
        const clusterOrigin = i === 0 ? lastCompletedPoint : allOptimizedPoints[allOptimizedPoints.length - 1];
        const clusterDestination = isLastCluster ? 
          cluster.points[cluster.points.length - 1] : 
          cluster.points[cluster.points.length - 1];
        
        // ✅ SIMPLIFICADO: Criar pontos para otimização DIRETA do cluster
        const clusterPointsToOptimize = [
          { ...clusterOrigin, type: 'origin' as const },
          ...cluster.points.map(p => ({ ...p, type: 'waypoint' as const })),
          { ...clusterDestination, type: 'destination' as const }
        ].slice(0, this.MAX_WAYPOINTS + 2); // Garantir limite rigoroso

        console.log(`🔧 [OPTIMIZER CLUSTERING] Otimizando cluster ${i + 1}/${orderedClusters.length} com ${clusterPointsToOptimize.length} pontos DIRETAMENTE`);

        try {
          // ✅ CORRIGIDO: Chamar DIRETAMENTE optimizeWithRoutesAPIv2 (sem dupla limitação)
          const clusterResult = await this.optimizeWithRoutesAPIv2(clusterPointsToOptimize);
          
          // Adicionar pontos do cluster (exceto o primeiro se não for o primeiro cluster)
          const pointsToAdd = i === 0 ? 
            clusterResult.optimizedPoints : 
            clusterResult.optimizedPoints.slice(1);
          
          pointsToAdd.forEach((point) => {
            allOptimizedPoints.push({
              ...point,
              order: allOptimizedPoints.length,
              completed: point.id === lastCompletedPoint.id ? true : false
            });
          });

          totalDistance += clusterResult.totalDistance;
          totalDuration += clusterResult.totalDuration;
          
          if (clusterResult.polyline) {
            finalPolyline += clusterResult.polyline;
          }

        } catch (clusterError) {
          console.error(`❌ [OPTIMIZER CLUSTERING] Erro no cluster ${i + 1}:`, clusterError);
          
          // Fallback: adicionar pontos do cluster sem otimização
          const fallbackPoints = cluster.points.map((point) => ({
            ...point,
            order: allOptimizedPoints.length,
            completed: false
          }));
          
          allOptimizedPoints.push(...fallbackPoints);
        }
      }

      console.log(`✅ [OPTIMIZER CLUSTERING] Clustering concluído - ${allOptimizedPoints.length} pontos, ${clusters.length} clusters processados`);
      console.log(`📊 [OPTIMIZER CLUSTERING] Distância total: ${totalDistance.toFixed(1)}km, Duração: ${Math.round(totalDuration/60)}min`);

      return {
        optimizedPoints: allOptimizedPoints,
        totalDistance,
        totalDuration,
        polyline: finalPolyline,
        optimizedOrder: allOptimizedPoints.map(p => p.id)
      };
      
    } catch (error) {
      console.error('❌ [OPTIMIZER CLUSTERING] Erro no clustering:', error);
      
      // Fallback: usar segmentação tradicional
      return await this.optimizePartialRouteWithSegmentation(completedPoints, remainingPoints);
    }
  }

  // ✅ NOVA FUNÇÃO - Clustering geográfico K-means simples
  private applyGeographicalClustering(points: OptimizationPoint[], maxPointsPerCluster: number): GeographicalCluster[] {
    console.log(`🗺️ [CLUSTERING] Aplicando K-means em ${points.length} pontos com máximo ${maxPointsPerCluster} por cluster`);
    
    // Calcular número de clusters necessários
    const numClusters = Math.ceil(points.length / maxPointsPerCluster);
    console.log(`🎯 [CLUSTERING] Criando ${numClusters} clusters`);
    
    // Inicializar centroids aleatoriamente
    const centroids: { lat: number; lng: number }[] = [];
    for (let i = 0; i < numClusters; i++) {
      const randomPoint = points[Math.floor(Math.random() * points.length)];
      centroids.push({ lat: randomPoint.lat, lng: randomPoint.lng });
    }
    
    // K-means simples (3 iterações)
    for (let iter = 0; iter < 3; iter++) {
      const clusters: GeographicalCluster[] = centroids.map((centroid, i) => ({
        centroid,
        points: [],
        clusterId: i
      }));
      
      // Atribuir pontos aos clusters mais próximos
      for (const point of points) {
        let bestCluster = 0;
        let minDistance = this.calculateGeographicalDistance(point, centroids[0]);
        
        for (let i = 1; i < centroids.length; i++) {
          const distance = this.calculateGeographicalDistance(point, centroids[i]);
          if (distance < minDistance) {
            minDistance = distance;
            bestCluster = i;
          }
        }
        
        clusters[bestCluster].points.push(point);
      }
      
      // Atualizar centroids (média das posições)
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].points.length > 0) {
          const avgLat = clusters[i].points.reduce((sum, p) => sum + p.lat, 0) / clusters[i].points.length;
          const avgLng = clusters[i].points.reduce((sum, p) => sum + p.lng, 0) / clusters[i].points.length;
          centroids[i] = { lat: avgLat, lng: avgLng };
        }
      }
    }
    
    // Criar clusters finais
    const finalClusters: GeographicalCluster[] = centroids.map((centroid, i) => ({
      centroid,
      points: [],
      clusterId: i
    }));
    
    // Atribuição final dos pontos
    for (const point of points) {
      let bestCluster = 0;
      let minDistance = this.calculateGeographicalDistance(point, centroids[0]);
      
      for (let i = 1; i < centroids.length; i++) {
        const distance = this.calculateGeographicalDistance(point, centroids[i]);
        if (distance < minDistance) {
          minDistance = distance;
          bestCluster = i;
        }
      }
      
      finalClusters[bestCluster].points.push(point);
    }
    
    // Filtrar clusters vazios
    const nonEmptyClusters = finalClusters.filter(cluster => cluster.points.length > 0);
    
    console.log(`✅ [CLUSTERING] ${nonEmptyClusters.length} clusters criados:`);
    nonEmptyClusters.forEach((cluster, i) => {
      console.log(`   - Cluster ${i + 1}: ${cluster.points.length} pontos`);
    });
    
    return nonEmptyClusters;
  }

  // ✅ NOVA FUNÇÃO - Ordenar clusters para conectividade
  private orderClustersOptimally(clusters: GeographicalCluster[], startPoint: OptimizationPoint): GeographicalCluster[] {
    console.log(`🔗 [CLUSTER ORDERING] Ordenando ${clusters.length} clusters para conectividade`);
    
    if (clusters.length <= 1) return clusters;
    
    const orderedClusters: GeographicalCluster[] = [];
    const remainingClusters = [...clusters];
    
    // Encontrar primeiro cluster (mais próximo do ponto inicial)
    let currentPoint = startPoint;
    
    while (remainingClusters.length > 0) {
      let bestClusterIndex = 0;
      let minDistance = this.calculateGeographicalDistance(currentPoint, remainingClusters[0].centroid);
      
      for (let i = 1; i < remainingClusters.length; i++) {
        const distance = this.calculateGeographicalDistance(currentPoint, remainingClusters[i].centroid);
        if (distance < minDistance) {
          minDistance = distance;
          bestClusterIndex = i;
        }
      }
      
      const selectedCluster = remainingClusters.splice(bestClusterIndex, 1)[0];
      orderedClusters.push(selectedCluster);
      
      // Próximo ponto de referência é o último ponto do cluster selecionado
      if (selectedCluster.points.length > 0) {
        currentPoint = selectedCluster.points[selectedCluster.points.length - 1];
      }
    }
    
    console.log(`✅ [CLUSTER ORDERING] Clusters ordenados para conectividade otimizada`);
    return orderedClusters;
  }

  // ✅ NOVA FUNÇÃO - Calcular distância geográfica simples
  private calculateGeographicalDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371; // Raio da Terra em km
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
             Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // ✅ MELHORADO: Fallback com segmentação tradicional - SEM dupla limitação
  private async optimizePartialRouteWithSegmentation(
    completedPoints: OptimizationPoint[], 
    remainingPoints: OptimizationPoint[]
  ): Promise<OptimizationResult> {
    console.log(`📦 [OPTIMIZER SEGMENTATION] Fallback - usando segmentação tradicional para ${remainingPoints.length} pontos`);
    
    try {
      const lastCompletedPoint = completedPoints[completedPoints.length - 1];
      
      // Usar lógica similar ao handleLargeRoute
      const segments: any[] = [];
      const segmentSize = this.MAX_WAYPOINTS;
      
      for (let i = 0; i < remainingPoints.length; i += segmentSize) {
        const segmentPoints = remainingPoints.slice(i, i + segmentSize);
        segments.push(segmentPoints);
      }
      
      console.log(`🔧 [OPTIMIZER SEGMENTATION] Dividindo em ${segments.length} segmentos`);
      
      let allOptimizedPoints: any[] = [...completedPoints.slice(0, -1)];
      let totalDistance = 0;
      let totalDuration = 0;
      let finalPolyline = '';
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLastSegment = i === segments.length - 1;
        
        const segmentOrigin = i === 0 ? lastCompletedPoint : allOptimizedPoints[allOptimizedPoints.length - 1];
        const segmentDestination = isLastSegment ? 
          segment[segment.length - 1] : 
          segment[segment.length - 1];
        
        const segmentPoints = [
          { ...segmentOrigin, type: 'origin' as const },
          ...segment.map(p => ({ ...p, type: 'waypoint' as const })),
          { ...segmentDestination, type: 'destination' as const }
        ];

        try {
          // ✅ CORRIGIDO: Chamar DIRETAMENTE optimizeWithRoutesAPIv2 (sem dupla limitação)
          const segmentResult = await this.optimizeWithRoutesAPIv2(segmentPoints);
          
          const pointsToAdd = i === 0 ? segmentResult.optimizedPoints : segmentResult.optimizedPoints.slice(1);
          
          pointsToAdd.forEach((point) => {
            allOptimizedPoints.push({
              ...point,
              order: allOptimizedPoints.length,
              completed: point.id === lastCompletedPoint.id ? true : false
            });
          });

          totalDistance += segmentResult.totalDistance;
          totalDuration += segmentResult.totalDuration;
          
          if (segmentResult.polyline) {
            finalPolyline += segmentResult.polyline;
          }

        } catch (segmentError) {
          console.error(`❌ [OPTIMIZER SEGMENTATION] Erro no segmento ${i + 1}:`, segmentError);
          
          const fallbackPoints = segment.map((point) => ({
            ...point,
            order: allOptimizedPoints.length,
            completed: false
          }));
          
          allOptimizedPoints.push(...fallbackPoints);
        }
      }

      console.log(`✅ [OPTIMIZER SEGMENTATION] Segmentação concluída - ${allOptimizedPoints.length} pontos`);

      return {
        optimizedPoints: allOptimizedPoints,
        totalDistance,
        totalDuration,
        polyline: finalPolyline,
        optimizedOrder: allOptimizedPoints.map(p => p.id)
      };
      
    } catch (error) {
      console.error('❌ [OPTIMIZER SEGMENTATION] Erro na segmentação:', error);
      throw error;
    }
  }

  // ✅ FUNÇÃO AUXILIAR - Converter graus para radianos
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const googleMapsOptimizer = new GoogleMapsOptimizer();
