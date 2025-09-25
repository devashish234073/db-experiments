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
  // Generate loading divs and labels with IPs on the server side
  const nodeDivs = members.map((member, i) => `
    <div>
      <strong>Node ${i + 1} (${member})</strong>
      <div id="node-status-${i}">Loading...</div>
    </div>
  `).join('\n');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>MongoDB Replica Set UI</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .node { margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
        pre { background: #f5f5f5; padding: 8px; overflow: auto; }
      </style>
    </head>
    <body>
      <h1>MongoDB Replica Set UI</h1>
      
      <form method="POST" action="/write">
        <input name="message" placeholder="Message" required style="width: 300px; padding: 5px;" />
        <button type="submit">Insert Document</button>
      </form>

      <h3>Node Status (auto-refresh every 5s):</h3>
      ${nodeDivs}

      <br/>
      <a href="/status">View Replica Set Status</a>

      <script>
        const members = ${JSON.stringify(members)};
        
        function fetchNode(idx) {
          fetch('/read?member=' + encodeURIComponent(members[idx]))
            .then(r => r.text())
            .then(html => {
              document.getElementById('node-status-' + idx).innerHTML = html;
            })
            .catch(e => {
              document.getElementById('node-status-' + idx).innerHTML = '<pre style="color:red">Error: ' + e.message + '</pre>';
            });
        }

        function refreshAll() {
          for (let i = 0; i < members.length; i++) {
            fetchNode(i);
          }
        }

        // Initial load + auto-refresh
        refreshAll();
        setInterval(refreshAll, 5000);
      </script>
    </body>
    </html>
  `);
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
    await client.close();
    res.redirect("/");
  } catch (err) {
    res.status(500).send(`<pre style="color:red">Write failed:\n${err.message}</pre><a href="/">Back</a>`);
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

    if (docs.length === 0) {
      res.send('<em>No documents found</em>');
    } else {
      res.send(`
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