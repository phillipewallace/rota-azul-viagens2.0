/**
 * Modal de captura de fotos obrigatórias (mín. 3 fotos)
 * Usa <input capture="environment"> para abrir câmera do dispositivo.
 */
import React, { useRef, useState } from 'react';
import { Camera, X, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadPhotos } from '@/services/photoUpload';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  routeId: string;
  pointId: string;
  operationType: 'entrega' | 'recolhimento' | 'manutencao';
  minPhotos?: number;
  onClose: () => void;
  onConfirmed: () => void;
}

const PhotoCaptureModal: React.FC<Props> = ({
  open,
  routeId,
  pointId,
  operationType,
  minPhotos = 3,
  onClose,
  onConfirmed,
}) => {
  const [photos, setPhotos] = useState<{ blob: Blob; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const addPhoto = (file: File) => {
    const preview = URL.createObjectURL(file);
    setPhotos((prev) => [...prev, { blob: file, preview }]);
  };

  const removePhoto = (i: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const handleConfirm = async () => {
    if (photos.length < minPhotos) {
      toast.error(`Mínimo de ${minPhotos} fotos obrigatório`);
      return;
    }
    setUploading(true);
    try {
      const result = await uploadPhotos(
        routeId,
        pointId,
        operationType,
        photos.map((p) => p.blob)
      );
      if (result.queued > 0) {
        toast.success(`${result.uploaded} enviadas, ${result.queued} na fila offline`);
      } else {
        toast.success(`${result.uploaded} fotos enviadas`);
      }
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      onConfirmed();
    } catch (e: any) {
      toast.error('Erro ao enviar fotos: ' + (e?.message || ''));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-lg">Fotos obrigatórias</h2>
          <button onClick={onClose} disabled={uploading}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-sm text-gray-600 mb-3">
            Tire pelo menos <strong>{minPhotos} fotos</strong> da operação ({operationType}).
            <br />
            <span className={photos.length >= minPhotos ? 'text-green-600' : 'text-orange-600'}>
              {photos.length} / {minPhotos}
            </span>
          </p>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square">
                <img src={p.preview} className="w-full h-full object-cover rounded-lg" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => inputRef.current?.click()}
              className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500"
            >
              <Camera className="h-6 w-6" />
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              const MAX = 25 * 1024 * 1024;
              for (const f of files) {
                if (f.size > MAX) {
                  toast.error(`${f.name}: máximo 25MB`);
                  continue;
                }
                addPhoto(f);
              }
              e.target.value = '';
            }}
          />
        </div>

        <div className="p-4 border-t pb-safe">
          <Button
            onClick={handleConfirm}
            disabled={photos.length < minPhotos || uploading}
            className="w-full h-12 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-5 w-5 mr-2" />
            {uploading ? 'Enviando...' : 'Confirmar e concluir'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCaptureModal;
