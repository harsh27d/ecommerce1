require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MySQL Connection ---
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
db.connect(err => {
  if (err) {
    console.error('MySQL connection failed:', err);
    process.exit(1);
  }
  console.log('✅ MySQL connected');
});

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your_random_secret_here',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
  })
);
app.use(express.static(path.join(__dirname, 'public')));

// --- Utility: Check login for protected routes ---
function ensureLoggedIn(req, res, next) {
  if (!req.session.loggedin) {
    console.log('Access denied: Not logged in');
    return res.redirect('/login.html');
  }
  next();
}

// --- Routes ---

// Root redirects to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Public pages
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// --- NEW! Return currently logged-in user info for frontend ---
app.get('/api/me', (req, res) => {
  if (!req.session.loggedin || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  // Only send safe fields!
  res.json({ id: req.session.user.id, username: req.session.user.username });
});

// Protected main pages
app.get('/home.html', ensureLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});
app.get('/products.html', ensureLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'products.html'));
});
app.get('/cart.html', ensureLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cart.html'));
});

// --- Authentication ---

// Register
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).send('All fields are required.');
  }

  db.query(
    'SELECT 1 FROM users WHERE username = ? OR email = ?',
    [username, email],
    async (err, results) => {
      if (err) {
        console.error('DB select error:', err);
        return res.status(500).send('Registration failed due to database error.');
      }
      if (results.length > 0) {
        return res.status(409).send('Username or email is already taken.');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      db.query(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        err => {
          if (err) {
            console.error('Registration error:', err);
            return res.status(500).send('Registration failed.');
          }
          res.redirect('/login.html');
        }
      );
    }
  );
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Username and password are required.');
  }
  db.query(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).send('Login failed.');
      }
      if (results.length === 0) {
        return res.status(401).send('Invalid username or password.');
      }
      const user = results[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).send('Invalid username or password.');
      }

      req.session.loggedin = true;
      req.session.user = user;
      res.redirect('/home.html');
    }
  );
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login.html');
});

// --- E-Commerce APIs ---

// Get all products
app.get('/api/products', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) return res.status(500).send('Failed to load products.');
    res.json(results);
  });
});

// Add to cart
app.post('/api/cart', ensureLoggedIn, (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity) {
    return res.status(400).send('Product and quantity are required.');
  }
  db.query(
    'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?',
    [req.session.user.id, productId, quantity, quantity],
    err => {
      if (err) {
        console.error('Cart update error:', err);
        return res.status(500).send('Failed to add to cart.');
      }
      res.send('Added to cart');
    }
  );
});

// Get user's cart
app.get('/api/cart', ensureLoggedIn, (req, res) => {
  db.query(
    'SELECT p.id, p.name, p.price, c.quantity FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?',
    [req.session.user.id],
    (err, results) => {
      if (err) {
        console.error('Cart load error:', err);
        return res.status(500).send('Failed to load cart.');
      }
      res.json(results);
    }
  );
});

// Checkout
app.post('/api/checkout', ensureLoggedIn, (req, res) => {
  db.query(
    'DELETE FROM cart WHERE user_id = ?',
    [req.session.user.id],
    err => {
      if (err) {
        console.error('Checkout error:', err);
        return res.status(500).send('Checkout failed.');
      }
      res.send('Order placed!');
    }
  );
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
