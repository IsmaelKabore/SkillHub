const express = require('express');
const pool = require('./src/models/db'); // Import the PostgreSQL connection
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken'); // For JWT token generation
const winston = require('winston'); // For error logging
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' }),
  ],
});

// Middleware to authenticate users using JWT
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Access denied, token missing' });
  }

  try {
    const decoded = jwt.verify(token, 'your_secret_key');
    req.user = decoded; // Attach user info to request
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

// A basic route to test if the server is running
app.get('/', (req, res) => {
  res.send('Welcome to SkillHub!');
});

// Route to get all users from the database (Protected)
app.get('/users', authenticate, async (req, res) => {
  try {
    // Query to fetch all users
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows); // Respond with users as JSON
  } catch (err) {
    logger.error('Error fetching users:', err);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Registration Route
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Check if all required fields are provided
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Please provide all required fields (username, email, password)' });
  }

  try {
    // Check if the email already exists in the database
    const checkEmail = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Check if the username already exists in the database
    const checkUsername = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (checkUsername.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash the password before saving it to the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the user into the database
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
      [username, email, hashedPassword]
    );

    // Return the newly registered user
    res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
  } catch (err) {
    logger.error('Error registering user:', err.message);
    res.status(500).json({ error: 'Error registering user', details: err.message });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    logger.error('Login attempt failed: Missing email or password');
    return res.status(400).json({ error: 'Please provide both email and password' });
  }

  try {
    // Find the user by email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Check if the user exists
    if (!user) {
      logger.error(`Login failed: User not found for email ${email}`);
      return res.status(404).json({ error: 'User not found' });
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      logger.error(`Login failed: Incorrect password for user ${email}`);
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user.id, username: user.username, email: user.email }, 'your_secret_key', { expiresIn: '1h' });

    logger.info(`Login successful for user ${email}`);

    res.json({ message: 'Login successful', token });
  } catch (err) {
    logger.error('Error logging in user:', err);
    res.status(500).json({ error: 'Error logging in user' });
  }
});

// Route to get all skills for a user (Protected)
app.get('/skills', authenticate, async (req, res) => {
  try {
    // Get the userId from the JWT token
    const userId = req.user.userId;

    // Query to get all skills for the user
    const result = await pool.query('SELECT * FROM skills WHERE user_id = $1', [userId]);
    res.json(result.rows); // Respond with skills
  } catch (err) {
    logger.error('Error fetching skills:', err);
    res.status(500).json({ error: 'Error fetching skills' });
  }
});

// Route to add a skill for a user (Protected)
app.post('/skills', authenticate, async (req, res) => {
  const { skill_name, proficiency } = req.body;
  
  // Validate skill name and proficiency
  if (!skill_name || !proficiency) {
    return res.status(400).json({ error: 'Please provide both skill name and proficiency' });
  }

  try {
    // Get the userId from the JWT token
    const userId = req.user.userId;

    // Insert the skill into the database
    const result = await pool.query(
      'INSERT INTO skills (user_id, skill_name, proficiency) VALUES ($1, $2, $3) RETURNING *',
      [userId, skill_name, proficiency]
    );

    res.status(201).json({ message: 'Skill added successfully', skill: result.rows[0] });
  } catch (err) {
    logger.error('Error adding skill:', err);
    res.status(500).json({ error: 'Error adding skill' });
  }
});

// Route to update a skill (Protected)
app.put('/skills/:id', authenticate, async (req, res) => {
  const { skill_name, proficiency } = req.body;
  const skillId = req.params.id;

  // Validate the provided fields
  if (!skill_name || !proficiency) {
    return res.status(400).json({ error: 'Please provide both skill name and proficiency' });
  }

  try {
    // Update the skill in the database
    const result = await pool.query(
      'UPDATE skills SET skill_name = $1, proficiency = $2 WHERE id = $3 RETURNING *',
      [skill_name, proficiency, skillId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    res.json({ message: 'Skill updated successfully', skill: result.rows[0] });
  } catch (err) {
    logger.error('Error updating skill:', err);
    res.status(500).json({ error: 'Error updating skill' });
  }
});

// Route to delete a skill (Protected)
app.delete('/skills/:id', authenticate, async (req, res) => {
  const skillId = req.params.id;

  try {
    // Delete the skill from the database
    const result = await pool.query('DELETE FROM skills WHERE id = $1 RETURNING *', [skillId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    res.json({ message: 'Skill deleted successfully' });
  } catch (err) {
    logger.error('Error deleting skill:', err);
    res.status(500).json({ error: 'Error deleting skill' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
