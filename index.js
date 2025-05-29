const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const apiRoutes = require("./routes");
const {MONGO_URI,PORT} = require("./config");

const app = express();
app.use(express.json());
app.use(cors());

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

app.use("/api", apiRoutes);
const PORTNUMBER = PORT || 5000;
console.log(PORTNUMBER);
app.listen(PORTNUMBER, () => console.log(`Server running on port ${PORTNUMBER}`));
