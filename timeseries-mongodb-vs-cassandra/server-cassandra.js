// npm install express body-parser cors cassandra-driver
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cassandra = require("cassandra-driver");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new cassandra.Client({
  contactPoints: ["127.0.0.1"],
  localDataCenter: "datacenter1",
  keyspace: "handtracking"
});

async function setup() {
  await client.connect();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS gestures (
      id uuid PRIMARY KEY,
      timestamp timestamp,
      coordinates text
    )
  `);
  console.log("Connected to Cassandra");
}

app.post("/saveGesture", async (req, res) => {
  try {
    const data = req.body;
    await client.execute(
      "INSERT INTO gestures (id, timestamp, coordinates) VALUES (?, ?, ?)",
      [cassandra.types.Uuid.random(), new Date(), JSON.stringify(data)],
      { prepare: true }
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

setup();
const PORT = 3000;
app.listen(PORT, () => console.log(`Mongo API running on http://localhost:${PORT}`));
