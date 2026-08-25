
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, uploadsDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    // Generate unique filename while preserving extension
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req: any, _file: any, cb: any) => {
    // Accept all file types
    cb(null, true);
  }
});

// Upload single file - using any types to avoid Express type conflicts in monorepo
router.post('/', (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      console.error('❌ Multer error:', err);
      return res.status(500).json({ error: 'Erro no upload do arquivo' });
    }
    
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      console.log('📁 File uploaded:', file.filename);

      const fileInfo = {
        id: uuidv4(),
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        url: `/uploads/${file.filename}`
      };

      res.json(fileInfo);
    } catch (error) {
      console.error('❌ Upload error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
});

// Serve uploaded files
router.get('/files/:filename', (req: any, res: any) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    console.log('📁 Serving file:', filename);
    res.sendFile(filePath);
  } catch (error) {
    console.error('❌ Error serving file:', error);
    res.status(500).json({ error: 'Erro ao acessar arquivo' });
  }
});

// Delete file
router.delete('/files/:filename', (req: any, res: any) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ File deleted:', filename);
      res.json({ message: 'Arquivo excluído com sucesso' });
    } else {
      res.status(404).json({ error: 'Arquivo não encontrado' });
    }
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ error: 'Erro ao excluir arquivo' });
  }
});

export default router;
