// backend/index.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const productRoutes = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 5000;

// ──────────────────────────────
// Middleware
// ──────────────────────────────
app.use(cors());
app.use(express.json());

// ──────────────────────────────
// Routes
// ──────────────────────────────
app.get('/', (req, res) => {
  res.send('🚀 Tradeby backend is running');
});
app.use('/products', productRoutes);

// ──────────────────────────────
// MongoDB Connection
// ──────────────────────────────
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () =>
      console.log(`🌐 Server listening at http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

