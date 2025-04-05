const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Modelo do MongoDB
const SiteContent = mongoose.model('SiteContent', {
  heroSlides: [{
    image: String,
    title: String,
    description: String
  }],
  palpitesTitle: String,
  palpites: [{
    dia: String,
    numeros: [String]
  }],
  resultadosTitle: String,
  resultados: [{
    data: String,
    numeros: [String],
    animal: String,
    premiacao: String
  }],
  whatsappNumber: String,
  youtubeLink: String,
  features: [{
    title: String,
    description: String
  }],
  updatedAt: { type: Date, default: Date.now }
});

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Rotas da API
app.get('/api/content', async (req, res) => {
  const content = await SiteContent.findOne().sort({ updatedAt: -1 });
  res.json(content || {});
});

app.post('/api/content', upload.array('images'), async (req, res) => {
  const { 
    slideTitles, 
    slideDescriptions, 
    palpitesTitle,
    palpitesDias,
    palpitesNumeros,
    resultadosTitle,
    resultadosDatas,
    resultadosNumeros,
    resultadosAnimais,
    resultadosPremiacoes,
    whatsappNumber,
    youtubeLink,
    featureTitles,
    featureDescriptions
  } = req.body;

  // Processar heroSlides
  const heroSlides = slideTitles.map((title, index) => ({
    title,
    description: slideDescriptions[index],
    image: req.files[index] ? `/uploads/${req.files[index].filename}` : undefined
  }));

  // Processar palpites
  const palpites = palpitesDias.map((dia, index) => ({
    dia,
    numeros: JSON.parse(palpitesNumeros[index])
  }));

  // Processar resultados
  const resultados = resultadosDatas.map((data, index) => ({
    data,
    numeros: JSON.parse(resultadosNumeros[index]),
    animal: resultadosAnimais[index],
    premiacao: resultadosPremiacoes[index]
  }));

  // Processar features
  const features = featureTitles.map((title, index) => ({
    title,
    description: featureDescriptions[index]
  }));

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
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));