import React, { useState } from 'react';
import Map from '@/components/Map';
import MobileOperatorHeader from './MobileOperatorHeader';
import MobileOperatorNav from './MobileOperatorNav';
import MobileTrackingDrawer from './MobileTrackingDrawer';
import LinkRouteModal from '@/components/LinkRouteModal';
import { Button } from '@/components/ui/button';
import { Truck, Plus } from 'lucide-react';

const MobileOperatorIndex = () => {
  const [isLinkRouteOpen, setIsLinkRouteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <MobileOperatorHeader />

      {/* Main Content - Full screen map */}
      <main className="flex-1 pt-14 pb-40 relative">
        <div className="absolute inset-0 top-14">
          <Map />
        </div>

        {/* FAB - Floating Action Button */}
        <Button
          className="fixed right-4 bottom-44 z-30 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
          onClick={() => setIsLinkRouteOpen(true)}
        >
          <Truck className="h-6 w-6" />
        </Button>
      </main>

      {/* Tracking Drawer */}
      <MobileTrackingDrawer />

      {/* Bottom Navigation */}
      

      {/* Modals */}
      <LinkRouteModal open={isLinkRouteOpen} onOpenChange={setIsLinkRouteOpen} />
    </div>
  );
};

export default MobileOperatorIndex;
