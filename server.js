require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuração do servidor
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configuração do diretório de uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Conexão com MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB conectado com sucesso');
  } catch (err) {
    console.error('❌ Falha na conexão com MongoDB:', err.message);
    process.exit(1);
  }
}

connectDB();

// Modelo do SiteContent
const SiteContentSchema = new mongoose.Schema({
  heroSlides: [{
    image: { type: String, required: true },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 200 }
  }],
  palpitesTitle: { type: String, required: true, maxlength: 100 },
  palpites: [{
    dia: { type: String, required: true },
    numeros: [{ type: String, required: true }]
  }],
  resultadosTitle: { type: String, required: true, maxlength: 100 },
  resultados: [{
    data: { type: String, required: true },
    numeros: [{ type: String, required: true }],
    animal: { type: String, required: true },
    premiacao: { type: String, required: true }
  }],
  whatsappNumber: { type: String, required: true },
  youtubeLink: { type: String, required: true },
  features: [{
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 300 }
  }],
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const SiteContent = mongoose.model('SiteContent', SiteContentSchema);

// Configuração do Multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Tipo de arquivo não suportado'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Rotas
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

app.get('/api/content', async (req, res) => {
  try {
    const content = await SiteContent.findOne().sort({ updatedAt: -1 });
    res.json(content || {});
  } catch (err) {
    console.error('Erro ao buscar conteúdo:', err);
    res.status(500).json({ error: 'Erro ao buscar conteúdo' });
  }
});

app.post('/api/content', upload.array('images', 10), async (req, res) => {
  try {
    const {
      slideTitles = [],
      slideDescriptions = [],
      palpitesTitle = '',
      palpitesDias = [],
      palpitesNumeros = [],
      resultadosTitle = '',
      resultadosDatas = [],
      resultadosNumeros = [],
      resultadosAnimais = [],
      resultadosPremiacoes = [],
      whatsappNumber = '',
      youtubeLink = '',
      featureTitles = [],
      featureDescriptions = []
    } = req.body;

    // Processar dados
    const heroSlides = slideTitles.map((title, index) => ({
      title,
      description: slideDescriptions[index] || '',
      image: req.files[index] ? `/uploads/${req.files[index].filename}` : ''
    }));

    const palpites = palpitesDias.map((dia, index) => ({
      dia,
      numeros: Array.isArray(palpitesNumeros[index]) ? palpitesNumeros[index] : JSON.parse(palpitesNumeros[index] || '[]')
    }));

    const resultados = resultadosDatas.map((data, index) => ({
      data,
      numeros: Array.isArray(resultadosNumeros[index]) ? resultadosNumeros[index] : JSON.parse(resultadosNumeros[index] || '[]'),
      animal: resultadosAnimais[index] || '',
      premiacao: resultadosPremiacoes[index] || ''
    }));

    const features = featureTitles.map((title, index) => ({
      title,
      description: featureDescriptions[index] || ''
    }));

    // Criar e salvar novo conteúdo
    const newContent = new SiteContent({
      heroSlides,
      palpitesTitle,
      palpites,
      resultadosTitle,
      resultados,
      whatsappNumber,
      youtubeLink,
      features
    });

    await newContent.save();
    res.status(201).json(newContent);

  } catch (err) {
    console.error('Erro ao salvar conteúdo:', err);
    
    // Limpar arquivos em caso de erro
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(path.join(uploadsDir, file.filename));
        } catch (e) {
          console.error('Erro ao deletar arquivo:', e);
        }
      });
    }
    
    res.status(500).json({ error: 'Erro ao salvar conteúdo', details: err.message });
  }
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// Encerramento gracioso
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM. Encerrando servidor...');
  server.close(() => {
    console.log('🔴 Servidor encerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT. Encerrando servidor...');
  server.close(() => {
    console.log('🔴 Servidor encerrado');
    process.exit(0);
  });
});