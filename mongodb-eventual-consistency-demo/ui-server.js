const express = require("express");
const { MongoClient } = require("mongodb");
const os = require("os");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// Load replica members from environment
const members = process.env.MONGO_RS_MEMBERS
  ? process.env.MONGO_RS_MEMBERS.split(",")
  : ["127.0.0.1:27017"];

const dbName = "experimentDB";
const collName = "testdata";

// In-memory store for inserted documents (to simulate replication / fast search)
const inMemoryStore = [];

// Helper: get direct connection to a specific node
async function getClient(member) {
  const uri = `mongodb://${member}/?directConnection=true`;
  return new MongoClient(uri, { useUnifiedTopology: true });
}

function randomText(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Home page with form + read options
app.get("/", (req, res) => {
  // Read the HTML template
  const fs = require("fs");
  const path = require("path");
  let html = fs.readFileSync(path.join(__dirname, "public", "home.html"), "utf8");

  // Inject node status placeholders
  const nodeDivs = members.map((member, i) => `
    <div class="node">
      <strong>Node ${i + 1} (${member})</strong>
      <div id="node-status-${i}">Loading...</div>
    </div>
  `).join('\n');

  // Inject bulk insert options
  const bulkOptions = [...Array(10)].map((_, i) => 
    `<option value="${(i + 1) * 1000000}">${i + 1} Million</option>`
  ).join("");

  // Replace placeholders
  html = html
    .replace('Node status divs will be injected by server', nodeDivs)
    .replace('const members = [];', `const members = ${JSON.stringify(members)};`);

  res.send(html);
});

app.get("/bulkWritePage", (req, res) => {
  // Read the HTML template
  const fs = require("fs");
  const path = require("path");
  let html = fs.readFileSync(path.join(__dirname, "public", "bulk.html"), "utf8");

  // Inject node status placeholders
  const nodeDivs = members.map((member, i) => `
    <div class="node">
      <strong>Node ${i + 1} (${member})</strong>
      <div id="node-status-${i}">Loading...</div>
    </div>
  `).join('\n');

  // Inject bulk insert options
  const bulkOptions = [...Array(10)].map((_, i) => 
    `<option value="${(i + 1) * 1000000}">${i + 1} Million</option>`
  ).join("");

  // Replace placeholders
  html = html
    .replace('Options will be injected by server', bulkOptions);

  res.send(html);
});

// Endpoint to create an index on a given attribute
app.post("/createIndex", async (req, res) => {
  const attr = req.query.attr;

  // Basic validation
  if (!attr || typeof attr !== 'string' || attr.trim() === '') {
    return res.status(400).json({ error: "Missing or invalid 'attr' query parameter" });
  }

  // Optional: restrict to known safe field names (e.g., attr1, attr2, attr3)
  const allowedAttrs = ['attr1', 'attr2', 'attr3', 'message', 'host'];
  if (!allowedAttrs.includes(attr)) {
    return res.status(400).json({ 
      error: `Indexing not allowed on '${attr}'. Allowed: ${allowedAttrs.join(', ')}` 
    });
  }

  try {
    const client = await getClient(members[0]); // connect to primary
    await client.connect();
    const db = client.db(dbName);
    const coll = db.collection(collName);

    // Create index (idempotent — safe to call multiple times)
    const result = await coll.createIndex({ [attr]: 1 });
    
    await client.close();

    res.json({
      message: `Index created on '${attr}'`,
      indexName: result // e.g., "attr2_1"
    });
  } catch (err) {
    console.error("Index creation failed:", err);
    res.status(500).json({ error: "Index creation failed: " + err.message });
  }
});

// Insert document into PRIMARY (assumes members[0] is primary)
app.post("/write", async (req, res) => {
  try {
    const client = await getClient(members[0]);
    await client.connect();
    const db = client.db(dbName);
    await db.collection(collName).insertOne({
      message: req.body.message,
      ts: new Date(),
      host: os.hostname(),
    });
    if(req.body.storeInMemory=="on") {
      // also save in in-memory store
      inMemoryStore.push({ message: req.body.message, ts: new Date(), host: os.hostname() });
    }
    await client.close();
    res.redirect("/");
  } catch (err) {
    res.status(500).send(`<pre style="color:red">Write failed:\n${err.message}</pre><a href="/">Back</a>`);
  }
});

app.get("/bulkWriteStep", async (req, res) => {
  const total = parseInt(req.query.total || "1000000");
  const step = parseInt(req.query.step || "1");
  const stepCount = parseInt(req.query.stepCount || "10");
  const storeInMemory = req.query.storeInMemory === "Y";
  const stepSize = Math.ceil(total / stepCount);
  const start = (step - 1) * stepSize;
  const end = Math.min(total, start + stepSize);

  const client = await getClient(members[0]);
  await client.connect();
  const db = client.db(dbName);
  const coll = db.collection(collName);

  try {
    const batch = Array.from({ length: end - start }, () => ({
      attr1: randomText(8),
      attr2: randomText(12),
      attr3: randomText(6),
      ts: new Date(),
      host: os.hostname(),
    }));

    await coll.insertMany(batch);
    if(storeInMemory) {
      // add to in-memory store as well
      inMemoryStore.push(...batch);
    }
    const percent = Math.round((end / total) * 100);

    res.json({
      message: `Inserted ${end} / ${total}`,
      percent,
      done: end >= total
    });
  } catch (e) {
    res.status(500).json({ message: "❌ Error: " + e.message, percent: 100, done: true });
  } finally {
    await client.close();
  }
});

// Handler: search attribute
app.get("/search", async (req, res) => {
  const key = req.query.key;
  const value = req.query.value;
  if (!key || !value) return res.send("Provide ?key= and ?value=");

  try {
    const client = await getClient(members[0]);
    await client.connect();
    const db = client.db(dbName);
    const start = Date.now();
    const docs = await db.collection(collName).find({ [key]: value }).limit(10).toArray();
    const durationMs = Date.now() - start;
    await client.close();
    res.json({ docs, timeMs: durationMs });
  } catch (err) {
    res.status(500).send("Search failed: " + err.message);
  }
});

// Search in in-memory store
app.get("/searchInMem", async (req, res) => {
  const key = req.query.key;
  const value = req.query.value;
  if (!key || !value) return res.send("Provide ?key= and ?value=");

  try {
    const start = Date.now();
    // simple filter (string equality)
    const docs = inMemoryStore.filter(d => {
      const v = d[key];
      if (v === undefined) return false;
      return String(v) === String(value);
    }).slice(0, 10);
    const durationMs = Date.now() - start;
    res.json({ docs, timeMs: durationMs });
  } catch (err) {
    res.status(500).send("SearchInMem failed: " + err.message);
  }
});

// Read from specific node
app.get("/read", async (req, res) => {
  const member = req.query.member;
  try {
    const client = await getClient(member);
    await client.connect();
    const docs = await client
      .db(dbName)
      .collection(collName)
      .find({})
      .sort({ ts: -1 })
      .limit(10)
      .toArray();
    const isMasterResult = await client.db().admin().command({ isMaster: 1 });
    const isPrimary = isMasterResult.ismaster; // true or false
    await client.close();

    const statusBadge = isPrimary
      ? '<span style="background:green;color:white;padding:2px 6px;border-radius:4px">PRIMARY</span>'
      : '<span style="background:orange;color:white;padding:2px 6px;border-radius:4px">SECONDARY</span>';

    if (docs.length === 0) {
      res.send(`<div>${statusBadge}<em>No documents found</em></div>`);
    } else {
      res.send(`
        <div>${statusBadge}</div>
        <pre>${JSON.stringify(docs, null, 2)}</pre>
        <small>Last updated: ${new Date().toISOString()}</small>
      `);
    }
  } catch (err) {
    res.send(`<pre style="color:red">Read failed from ${member}:\n${err.message}</pre>`);
  }
});

// Show replica set status
app.get("/status", async (req, res) => {
  try {
    const client = await getClient(members[0]);
    await client.connect();
    const adminDb = client.db("admin");
    const status = await adminDb.command({ replSetGetStatus: 1 });
    await client.close();
    res.send(`
      <h2>Replica Set Status</h2>
      <pre>${JSON.stringify(status, null, 2)}</pre>
      <a href="/">Back</a>
    `);
  } catch (err) {
    res.send(`<pre style="color:red">Status fetch failed:\n${err.message}</pre><a href="/">Back</a>`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`UI app running on port ${PORT}`);
});