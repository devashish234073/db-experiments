const express = require("express");
const { MongoClient } = require("mongodb");
const os = require("os");

const app = express();
app.use(express.urlencoded({ extended: true }));

// Load replica members from environment
const members = process.env.MONGO_RS_MEMBERS
  ? process.env.MONGO_RS_MEMBERS.split(",")
  : ["127.0.0.1:27017"];

const dbName = "experimentDB";
const collName = "testdata";

// Helper: get direct connection to a specific node
async function getClient(member) {
  const uri = `mongodb://${member}/?directConnection=true`;
  return new MongoClient(uri, { useUnifiedTopology: true });
}

// Home page with form + read options
app.get("/", (req, res) => {
  res.send(`
    <h1>MongoDB Replica Set UI</h1>
    <form method="POST" action="/write">
      <input name="message" placeholder="Message" required />
      <button type="submit">Insert</button>
    </form>
    <h3>Node Status (auto-refresh every 5s):</h3>
    <div id="node-status-0">Loading Node 1...</div>
    <div id="node-status-1">Loading Node 2...</div>
    <div id="node-status-2">Loading Node 3...</div>
    <script>
      const members = ${JSON.stringify(members)};
      function fetchNode(idx) {
        fetch('/read?member=' + encodeURIComponent(members[idx]))
          .then(r => r.text())
          .then(html => {
            document.getElementById('node-status-' + idx).innerHTML = html;
          })
          .catch(e => {
            document.getElementById('node-status-' + idx).innerHTML = '<pre>Error: ' + e + '</pre>';
          });
      }
      function refreshAll() {
        for (let i = 0; i < members.length; ++i) fetchNode(i);
      }
      refreshAll();
      setInterval(refreshAll, 5000);
    </script>
    <br/>
    <a href="/status">View Replica Set Status</a>
  `);
});

// Insert document into PRIMARY (first member in list assumed primary)
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
    await client.close();
    res.redirect("/");
  } catch (err) {
    res.send(`<pre>Write failed:\n${err}</pre>`);
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
    await client.close();

    res.send(`
      <h2>Last 10 docs from ${member}</h2>
      <pre>${JSON.stringify(docs, null, 2)}</pre>
      <a href="/">Back</a>
    `);
  } catch (err) {
    res.send(`<pre>Read failed from ${member}:\n${err}</pre>`);
  }
});

// Show rs.status() from first member
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
    res.send(`<pre>Status fetch failed:\n${err}</pre>`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`UI app running on port ${PORT}`);
});
