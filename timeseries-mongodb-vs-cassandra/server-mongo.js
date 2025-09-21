// npm install express mongodb body-parser cors
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);
let collection;

async function setup() {
  try {
    await client.connect();
    const db = client.db("handtracking");
    collection = db.collection("gestures");
    console.log("Connected to MongoDB");

    const PORT = 3000;
    app.listen(PORT, () => console.log(`Mongo API running on http://localhost:${PORT}`));
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1); // Exit so you can see the failure
  }
}

app.post("/saveGesture", async (req, res) => {
  try {
    const data = req.body;
    data.timestamp = new Date();
    await collection.insertOne(data);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

setup();
