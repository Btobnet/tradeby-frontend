const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const productsRoute = require("./routes/products");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); // Make sure it can parse JSON

// ✅ Connect to MongoDB before starting server
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log("✅ Connected to MongoDB");

  // Mount your product routes after DB connection
  app.use("/api/products", productsRoute);

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error("❌ MongoDB connection error:", err);
});
