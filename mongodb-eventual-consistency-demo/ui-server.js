const express = require("express");
const { MongoClient } = require("mongodb");
const os = require("os");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

function randomText(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
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
        .nodes { display: flex; gap: 20px; align-items: flex-start; }
        .overlay {
          position: fixed; top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0,0,0,0.8);
          color: white; font-size: 20px;
          display: flex; align-items: center; justify-content: center;
          z-index: 9999; flex-direction: column;
        }
        #progressBar {
          width: 60%; height: 20px;
          background: #444; border-radius: 10px; margin-top: 10px;
        }
        #progressFill {
          height: 100%; width: 0%; background: limegreen; border-radius: 10px;
        }
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

      <br/>
      <label>Bulk Insert Count:</label>
      <select id="recordCount">
        ${[...Array(10)].map((_, i) => `<option value="${(i + 1) * 1000000}">${i + 1} Million</option>`).join("")}
      </select>
      <button id="startBulk">Start Bulk Write</button>

      <div id="overlay" class="overlay" style="display:none;">
        <div id="progressText">Starting write...</div>
        <div id="progressBar"><div id="progressFill"></div></div>
      </div>

      <div id="searchContainer" style="display:none; margin-top:20px;">
        <h3>Search DB</h3>
        <input id="searchKey" placeholder="Enter attribute key (e.g. attr1)" />
        <input id="searchValue" placeholder="Enter value" />
        <button id="searchBtn">Search</button>
        <pre id="searchResult"></pre>
      </div>

      <h3>Node Status (auto-refresh every 5s):</h3>
      <div class="nodes">${nodeDivs}</div>

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

        document.getElementById("startBulk").onclick = async () => {
        const total = parseInt(document.getElementById("recordCount").value);
        const overlay = document.getElementById("overlay");
        const progressText = document.getElementById("progressText");
        const progressFill = document.getElementById("progressFill");

        overlay.style.display = "flex";
        progressFill.style.width = "0%";
        progressText.innerText = "Starting bulk write...";

        const stepCount = 10;
        for (let step = 1; step <= stepCount; step++) {
          progressText.innerText = \`Writing step \${step} of \${stepCount}...\`;
          const res = await fetch(\`/bulkWriteStep?total=\${total}&step=\${step}\`);
          const data = await res.json();

          progressText.innerText = data.message;
          progressFill.style.width = data.percent + "%";

          if (data.done) break;
        }

        progressText.innerText = "✅ Bulk write completed!";
        await new Promise(r => setTimeout(r, 1000));
        overlay.style.display = "none";
        document.getElementById("searchContainer").style.display = "block";
      };


        document.getElementById("searchBtn").onclick = async () => {
          const key = document.getElementById("searchKey").value;
          const value = document.getElementById("searchValue").value;
          const res = await fetch("/search?key=" + encodeURIComponent(key) + "&value=" + encodeURIComponent(value));
          const text = await res.text();
          document.getElementById("searchResult").textContent = text;
        };
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

app.get("/bulkWriteStep", async (req, res) => {
  const total = parseInt(req.query.total || "1000000");
  const step = parseInt(req.query.step || "1");
  const stepCount = 10;
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
    const docs = await db.collection(collName).find({ [key]: value }).limit(10).toArray();
    await client.close();
    res.send(JSON.stringify(docs, null, 2));
  } catch (err) {
    res.status(500).send("Search failed: " + err.message);
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