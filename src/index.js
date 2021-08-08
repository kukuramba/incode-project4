const express = require('express'); 
const crypto = require('crypto');
const pool = require('./mrCoffeeDB');
const app = express();
const cookieParser = require('cookie-parser');

const port = 3000;
app.listen(3000, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

app.use(express.json()); 
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static('public'))

app.set('view engine', 'ejs');

const getHashedPassword = (password) => {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  return hash;
};

app.use((req, res, next) => {
  // Get auth token from the cookies
  const authToken = req.cookies['AuthToken'];
  // Inject the user to the request
  req.user = authTokens[authToken];
  next();
});

const requireAuth = (req, res, next) => {
  if (req.user) {
      next();
  } else {
      res.render('login', {message: 'Please login to continue', message2: null});
  }
};

// GET REQUESTS

app.get('/', (_, res) => {
  res.render('index');
});

app.get('/login', (_, res) => {
  res.render('login', {message: null, message2: null});
});

app.get('/signup', (_, res) => {
  res.render('signup', {message: null});
});

app.get('/logout', requireAuth, (req, res) => {
  res.cookie('AuthToken', '', { maxAge: 1})
  res.redirect('/');
});

app.get('/users', requireAuth, async (_, res) => {
  try {
    const usersDB = await pool.query(`SELECT * FROM users`);
    res.render('users', {users: usersDB.rows});
  } catch (err) {
    console.error(err.message)
  }
});

app.get('/users/new', requireAuth, (_, res) => { 
  res.render('newUserForm', {message: null});
});

app.get('/users/:id', requireAuth, async (req, res) => {
  try {
    const usersDB = await pool.query(`SELECT * FROM users`);
    const userId = Number(req.params.id);
    if (usersDB.rows[userId] === undefined) {
      res.status(404).send(`Incorrect user id: ${userId}`);
    } 
    res.render('singleUser', {users: usersDB.rows, userId: userId});
  } catch (err) {
    console.error(err.message)
  }
});

app.get('/schedules', requireAuth, async (_, res) => {
  try {
    const schedulesDB = await pool.query(`SELECT * FROM schedules`);
    res.render('schedules', {schedules: schedulesDB.rows});
  } catch (err) {
    console.error(err.message)
  }
});

app.get('/schedules/new', requireAuth, async (_, res) => {
  try {
    const usersDB = await pool.query(`SELECT * FROM users`);
    res.render('newScheduleForm', {users: usersDB.rows, message: null});
  } catch (err) {
    console.error(err.message)
  }
});

app.get('/users/:id/schedules', requireAuth, async (req, res) => {
  try {
    const usersDB = await pool.query(`SELECT * FROM users`);
    const userId = Number(req.params.id);
    if (usersDB.rows[userId] === undefined) {
      res.status(404).send(`Incorrect user id: ${userId}`);
    } 
    const schedulesDB = await pool.query(`SELECT * FROM schedules`);
    const userSchedule = [];
    for (let i = 0; i < schedulesDB.rows.length; i++) {
      if (schedulesDB.rows[i].user_id === userId) {
        userSchedule.push(schedulesDB.rows[i]);
      }
    }
    res.render('singleUserSchedule', {userSchedule: userSchedule, userId: userId});
  } catch (err) {
    console.error(err.message)
  }
});

// POST REQUESTS

app.post('/users', requireAuth, async (req, res) => {
  const { firstname, lastname, email, password, password2 } = req.body;
  if (password !== password2) {
    res.render('newUserForm', {message: `Passwords don't match. Please enter the same password in both password fields`});
    return;
  } 
  const hashedPassword = getHashedPassword(password);
  try {
    await pool.query(
      `INSERT INTO users (firstname, lastname, email, password) VALUES($1, $2, $3, $4) RETURNING *`,
      [firstname, lastname, email, hashedPassword] 
    );
    res.redirect('users');
  } catch (err) {
    console.error(err.message)
  }
});

app.post('/schedules', requireAuth, async (req, res) => {
  try {
    const { user_id, day, start_at, end_at } = req.body;
    await pool.query(
      `INSERT INTO schedules (user_id, day, start_at, end_at) VALUES($1, $2, $3, $4) RETURNING *`,
      [user_id, day, start_at, end_at] 
    );
    res.redirect('schedules');
  } catch (err) {
    console.error(err.message)
  }
});

/* POST - SIGNUP */

app.post('/signup', async (req, res) => {

  // Check if the 'password' and 'confirm password' fields match
  const { firstname, lastname, email, password, password2 } = req.body;
  if (password === password2) {
    
    // Check if user with the same email is also registered
    const usersDB = await pool.query(`SELECT * FROM users`);
    if (usersDB.rows.find(user => user.email === email)) {
      res.render('signup', {
          message: 'User already registered.'
      });
      return;
    }
    
    // Store user into the database
    const hashedPassword = getHashedPassword(password);
    try {
      await pool.query(
        `INSERT INTO users (firstname, lastname, email, password) VALUES($1, $2, $3, $4) RETURNING *`,
        [firstname, lastname, email, hashedPassword] 
      );
      res.render('login', {message2: 'Registration Complete. Please login to continue.', message: null});
    } catch (err) {
      console.error(err.message)
    }

  } else {
    res.render('signup', {message: "Passwords don't match."});
  }
});
  
/* POST - LOGIN - TOKEN - COOKIE */

const generateAuthToken = () => {
  return crypto.randomBytes(30).toString('hex');
}
// This will hold the users and authToken related to users
const authTokens = {};

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = getHashedPassword(password);

  const usersDB = await pool.query(`SELECT * FROM users`);

  const user = usersDB.rows.find(u => {
    return email === u.email && hashedPassword === u.password
  });

  if (user) {
    const authToken = generateAuthToken();
    
    // Store authentication token
    authTokens[authToken] = user;
    
    // Setting the auth token in cookies
    res.cookie('AuthToken', authToken);
    
    // Redirect user to the protected page
    res.redirect('/schedules');
  } else {
    res.render('login', {message: 'Invalid username or password', message2: null});
  }
});
