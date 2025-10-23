const express = require('express');
const bodyParser = require('body-parser');
const cassandra = require('cassandra-driver');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const client = new cassandra.Client({
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  keyspace: 'userlogks'
});

client.connect((err) => {
  if (err) {
    console.error('Cassandra connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to Cassandra');
});

// Login page
app.get('/', (req, res) => {
  res.render('login');
});

// Handle login
app.post('/login', async (req, res) => {
  const { userId, dob } = req.body;
  const loginDate = new Date();
  const logintime = loginDate.toTimeString().split(' ')[0];
  const firstname = 'User';
  const lastname = 'Auto';

  const query = `
    INSERT INTO user_login_data (userId, dob, loginDate, firstname, lastname, logintime)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  try {
    await client.execute(query, [userId, dob, loginDate, firstname, lastname, logintime], { prepare: true });
    res.redirect(`/results?userId=${encodeURIComponent(userId)}&dob=${encodeURIComponent(dob)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Login failed');
  }
});

// Query results
app.get('/results', async (req, res) => {
  const { userId, dob } = req.query;
  const query = `
    SELECT * FROM user_login_data
    WHERE userId = ? AND dob = ?
    ORDER BY loginDate DESC
  `;
  try {
    const result = await client.execute(query, [userId, dob], { prepare: true });
    res.render('results', { rows: result.rows, userId, dob });
  } catch (err) {
    console.error(err);
    res.status(500).send('Query failed');
  }
});

// Bulk login
app.post('/bulk-login', async (req, res) => {
  const count = parseInt(req.body.count) || 1;
  for (let i = 0; i < count; i++) {
    const userId = 'user_' + Math.random().toString(36).substring(2, 10);
    const now = new Date();
    const min = new Date(now.getFullYear() - 30, now.getMonth(), now.getDate());
    const max = new Date(now.getFullYear() - 20, now.getMonth(), now.getDate());
    const dobTime = min.getTime() + Math.random() * (max.getTime() - min.getTime());
    const dob = new Date(dobTime).toISOString().split('T')[0];

    const loginDate = new Date();
    const logintime = loginDate.toTimeString().split(' ')[0];

    const query = `
      INSERT INTO user_login_data (userId, dob, loginDate, firstname, lastname, logintime)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await client.execute(query, [userId, dob, loginDate, 'Auto', 'User', logintime], { prepare: true });
  }
  res.json({ success: true, count });
});

app.listen(3000, '0.0.0.0', () => {
  console.log('App running on port 3000');
});