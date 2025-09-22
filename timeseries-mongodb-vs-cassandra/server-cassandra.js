// npm install express body-parser cors cassandra-driver
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cassandra = require("cassandra-driver");
const path = require("path");
const https = require("https");
const fs = require("fs"); 

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const client = new cassandra.Client({
  contactPoints: ["127.0.0.1"],
  localDataCenter: "datacenter1",
  keyspace: "handtracking"
});

async function setup() {
  try {
    const client = new cassandra.Client({
      contactPoints: ["127.0.0.1"],
      localDataCenter: "datacenter1"
      // Do NOT specify keyspace here yet
    });
    await client.connect();

    await client.execute(`
      CREATE KEYSPACE IF NOT EXISTS handtracking 
      WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
    `);

    // ✅ Use the keyspace
    await client.execute('USE handtracking');

    await client.execute(`
        CREATE TABLE IF NOT EXISTS gestures (
        id uuid PRIMARY KEY,
        timestamp timestamp,
        coordinates text
      )`);
    console.log("Connected to Cassandra");

    const options = {
      key: fs.readFileSync("/home/ubuntu/key.pem"),
      cert: fs.readFileSync("/home/ubuntu/cert.pem")
    };

    const PORT = 3000;
    https.createServer(options, app).listen(PORT, () => {
      console.log(`Cassandra App running on https://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to CassandraDB", err);
    process.exit(1); // Exit so you can see the failure
  }
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
