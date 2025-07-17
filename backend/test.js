const mongoose = require("mongoose");

const uri = "mongodb+srv://smaujara:Ajrmon005@tradeby.d4rpedx.mongodb.net/tradeby?retryWrites=true&w=majority&appName=Tradeby";

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ Connected to MongoDB successfully!");
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });
