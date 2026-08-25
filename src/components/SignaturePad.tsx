import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';

export interface SignaturePadHandle {
  toDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number }>(
  ({ height = 180 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const dirtyRef = useRef(false);

    useEffect(() => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };
      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }, []);

    const pos = (e: PointerEvent | React.PointerEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: (e as PointerEvent).clientX - rect.left, y: (e as PointerEvent).clientY - rect.top };
    };

    const start = (e: React.PointerEvent) => {
      const ctx = canvasRef.current!.getContext('2d')!;
      const p = pos(e.nativeEvent);
      drawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      (e.target as Element).setPointerCapture(e.pointerId);
    };
    const move = (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      const ctx = canvasRef.current!.getContext('2d')!;
      const p = pos(e.nativeEvent);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      dirtyRef.current = true;
    };
    const end = () => { drawingRef.current = false; };

    useImperativeHandle(ref, () => ({
      toDataURL: () => (dirtyRef.current ? canvasRef.current!.toDataURL('image/png') : null),
      clear: () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        dirtyRef.current = false;
      },
      isEmpty: () => !dirtyRef.current,
    }));

    return (
      <div className="space-y-2">
        <div className="rounded-md border-2 border-dashed border-gray-300 bg-white touch-none">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height, touchAction: 'none', display: 'block' }}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const canvas = canvasRef.current!;
              const ctx = canvas.getContext('2d')!;
              ctx.fillStyle = '#fff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              dirtyRef.current = false;
            }}
          >
            Limpar assinatura
          </Button>
        </div>
      </div>
    );
  }
);
SignaturePad.displayName = 'SignaturePad';
