const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');
const path = require('path');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection setup with pooling
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'hackathon',
  password: 'Aashi@2005',
  port: 5432,
});

// Middleware setup
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'your_secret_key', // Replace with a secure secret key in production
  resave: false,
  saveUninitialized: true,
}));
app.use(flash());

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Home route
app.get('/', (req, res) => {
  res.render('home', { 
    title: 'Welcome to Our Website',  // Pass the title here
    messages: req.flash('info') 
  });
});

// Signup page
app.get('/signup', (req, res) => {
  res.render('signup', { messages: req.flash('info') });
});

// Signup route with validation
app.post(
  "/signup",
  [
    body("username").not().isEmpty().withMessage("Username is required"),
    body("email")
      .isEmail()
      .withMessage("Please enter a valid email")
      .custom(async (email) => {
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (user.rows.length > 0) {
          throw new Error("Email already in use");
        }
      }),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
      .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
      .matches(/\d/).withMessage("Password must contain at least one number")
      .matches(/[\W_]/).withMessage("Password must contain at least one special character"),
    body("confirm_password")
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords do not match");
        }
        return true;
      })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('info', errors.array().map(err => err.msg).join(", "));
      return res.redirect('/signup');
    }

    const { username, email, password, phone, state, city } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        "INSERT INTO users (username, email, password, phone, state, city) VALUES ($1, $2, $3, $4, $5, $6)",
        [username, email, hashedPassword, phone, state, city]
      );
      req.flash('info', 'Signup successful! You can log in now.');
      res.redirect('/login');
    } catch (err) {
      console.error(err.message);
      req.flash('info', 'An error occurred while signing up.');
      res.redirect('/signup');
    }
  }
);

//admin login route
app.get('/admin_login', (req, res) => {
  res.render('admin_login', { 
    title: 'Admin Login', 
    messages: req.flash('info') 
  });
});


// Admin login POST route
app.post('/admin_login', async (req, res) => {
  const { admin_id, security_pin } = req.body;

  try {
    // Fetch admin details from the database
    const admin = await pool.query('SELECT * FROM admins WHERE admin_id = $1', [admin_id]);

    // If admin is found, compare the security PIN (hashed in the database)
    if (admin.rows.length > 0) {
      const validPin = await bcrypt.compare(security_pin, admin.rows[0].security_pin);
      if (validPin) {
        req.session.admin_id = admin_id; // Set session for logged-in admin
        req.flash('info', 'Login successful!');
        return res.redirect('/admin_dashboard'); // Redirect to admin dashboard
      } else {
        req.flash('info', 'Invalid Security PIN.');
        return res.redirect('/admin_login');
      }
    } else {
      req.flash('info', 'Admin ID not found.');
      return res.redirect('/admin_login');
    }
  } catch (err) {
    console.error(err.message);
    req.flash('info', 'An error occurred during login.');
    return res.redirect('/admin_login');
  }
});


// User login page
app.get('/userlogin', (req, res) => {
  res.render('userlogin', { 
    title: 'User Login',   // Define the title here
    messages: req.flash('info'), 
    username: req.body.username || '' 
  });
});


// User login POST route
app.post('/userlogin', async (req, res) => {
  const { username, password, remember } = req.body;

  try {
    // Fetch user details from the database
    const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    // If user is found, compare the password (hashed in the database)
    if (user.rows.length > 0) {
      const validPassword = await bcrypt.compare(password, user.rows[0].password);
      if (validPassword) {
        req.session.user_id = user.rows[0].id; // Set session for logged-in user
        req.flash('info', 'Login successful!');
        
        // If "Remember me" is checked, extend the session duration
        if (remember) {
          req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        }

        return res.redirect('/dashboard'); // Redirect to user dashboard
      } else {
        req.flash('info', 'Invalid password.');
        return res.redirect('/userlogin');
      }
    } else {
      req.flash('info', 'Username not found.');
      return res.redirect('/userlogin');
    }
  } catch (err) {
    console.error(err.message);
    req.flash('info', 'An error occurred during login.');
    return res.redirect('/userlogin');
  }
});



// Route for the emergency page
app.get('/emergency', (req, res) => {
  res.render('emergency'); // Render emergency.ejs
});


// Updated counselors data
const counselors = [
    { name: 'Aashi Yadav', email: 'bt23ece049@iiitn.ac.in', image: '/images/Aashi.jpg' },
    { name: 'Sidrah Aaisha', email: 'bt23cse211@iiitn.ac.in', image: '/images/Sidrah.jpg' },
    { name: 'Akshita Jundiya', email: 'bt23cse075@iiitn.ac.in', image: '/images/akshita.jpg' },
    { name: 'Shreya Thakur', email: 'bt23cse221@iiitn.ac.in', image: '/images/Shreya.jpg' }
];

// Route for Legal Support page
app.get('/legal-support', (req, res) => {
    res.render('legal-support', { counselors });
});


// Fetch counselors
app.get('/api/counselors', async (req, res) => {
  try {
      const result = await pool.query('SELECT * FROM counselors');
      res.json(result.rows); // Send the rows as JSON response
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});

// Render the legal-support page
app.get('/legal-support', async (req, res) => {
  try {
      const result = await pool.query('SELECT * FROM counselors');
      res.render('legal-support', { counselors: result.rows }); // Pass counselors data to the template
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});

// Route to display emergency contacts
app.get('/emergency', async (req, res) => {
  try {
      // Query the database for emergency contacts
      const result = await pool.query('SELECT service_name, emergency_number, local_number FROM emergency_contacts');
      
      // Pass the retrieved data to the EJS template
      res.render('emergency', { emergencyContacts: result.rows });
  } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
  }
});

// Route to serve the report EJS file
app.get('/report', (req, res) => {
  res.render('report'); // Render the EJS file named report.ejs
});

//submit form
app.post('/submit_form', async (req, res) => {
  const { location, report_date, report_time, description, form_filled } = req.body;

  // Determine if an FIR has been filed
  const fir = form_filled === 'yes';

  // Insert the form data into the report_data table
  const sql = `
      INSERT INTO public.report_data (location, report_date, report_time, description, fir) 
      VALUES ($1, $2, $3, $4, $5)
  `;

  try {
      await pool.query(sql, [location, report_date, report_time, description, fir]);
      res.redirect('/thank_you'); // Redirect to a thank you page after successful submission
  } catch (err) {
      console.error('Database Error:', err); // Log detailed error message
      res.status(500).send('Error saving report to the database: ' + err.message); // Display specific error
  }
});


// Optional: Route for thank you page
app.get('/thank_you', (req, res) => {
  res.send('Thank you for your submission!'); // Simple response or render another EJS page
});








// Sample data (replace this with your actual data)
const stateData = [
    { name: "Andaman and Nicobar Islands", color: "#FCE4D6", data: 204 },
    { name: "Andhra Pradesh", color: "#C65911", data: 60876 },
    { name: "Arunachal Pradesh", color: "#FCE4D6", data: 234 },
    { name: "Assam", color: "#F4B084", data: 34780 },
    { name: "Bihar", color: "#F4B084", data: 23304 },
    { name: "Chandigarh", color: "#FCE4D6", data: 962 },
    { name: "Chhattisgarh", color: "#F4B084", data: 13986 },
    { name: "Dadra and Nagar Haveli", color: "#FCE4D6", data: 38 },
    { name: "Daman and Diu", color: "#FCE4D6", data: 36 },
    { name: "Delhi", color: "#F4B084", data: 25706 },
    { name: "Goa", color: "#FCE4D6", data: 824 },
    { name: "Gujarat", color: "#F4B084", data: 24246 },
    { name: "Haryana", color: "#F4B084", data: 18026 },
    { name: "Himachal Pradesh", color: "#FCE4D6", data: 2944 },
    { name: "Jammu and Kashmir", color: "#F8CBAD", data: 7010 },
    { name: "Jharkhand", color: "#F8CBAD", data: 10130 },
    { name: "Karnataka", color: "#F4B084", data: 19984 },
    { name: "Kerala", color: "#F4B084", data: 22026 },
    { name: "Lakshadweep", color: "#FCE4D6", data: 6 },
    { name: "Madhya Pradesh", color: "#C65911", data: 43934 },
    { name: "Maharashtra", color: "#C65911", data: 49126 },
    { name: "Manipur", color: "#FCE4D6", data: 570 },
    { name: "Meghalaya", color: "#FCE4D6", data: 678 },
    { name: "Mizoram", color: "#FCE4D6", data: 354 },
    { name: "Nagaland", color: "#FCE4D6", data: 132 },
    { name: "Odisha", color: "#F4B084", data: 24260 },
    { name: "Puducherry", color: "#FCE4D6", data: 142 },
    { name: "Punjab", color: "#F8CBAD", data: 9708 },
    { name: "Rajasthan", color: "#C65911", data: 55468 },
    { name: "Sikkim", color: "#FCE4D6", data: 186 },
    { name: "Tamil Nadu", color: "#F8CBAD", data: 13224 },
    { name: "Telangana", color: "#FCE4D6", data: 120 },
    { name: "Tripura", color: "#FCE4D6", data: 3254 },
    { name: "Uttarakhand", color: "#FCE4D6", data: 3412 },
    { name: "Uttar Pradesh", color: "#C65911", data: 62462 },
    { name: "West Bengal", color: "#C65911", data: 59222 }
];




// Route for the insights page
app.get('/insights', (req, res) => {
  res.render('insights', { stateData }); // Passing stateData to the template
});


// Define your route for the dashboard page
app.get('/dashboard', (req, res) => {
  // Filter the states with the color code "#C65911"
  const filteredStates = stateData.filter(state => state.color === '#C65911');
  
  // Render the dashboard view and pass the filtered states to the EJS template
  res.render('dashboard', { states: filteredStates });
});


// Valid admins data
const validAdmins = [
  { admin_id: 'BT23ECE049', security_pin: '23456' },
  { admin_id: 'BT23CSE075', security_pin: '23456' },
  { admin_id: 'BT23CSE211', security_pin: '23456' },
  { admin_id: 'BT23CSE221', security_pin: '23456' }
];

// Route to render the login page
app.get('/admin_login', (req, res) => {
  res.render('admin_login', { error: null });
});

// Handle login form POST request
app.post('/admin_login', (req, res) => {
  const { admin_id, security_pin } = req.body;

  // Find the admin by ID and PIN
  const admin = validAdmins.find(a => a.admin_id === admin_id && a.security_pin === security_pin);

  if (admin) {
      // Successful login, render the dashboard
      res.render('admin_dashboard', { admin_id: admin.admin_id });
  } else {
      // Login failed, re-render the login page with an error message
      res.render('admin_login', { error: 'Invalid Admin ID or Security PIN' });
  }
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.redirect('/');
    }
    req.flash('info', 'Logout successful!');
    res.redirect('/');
  });
});


// Catch-all route for 404 errors
app.use((req, res) => {
  res.status(404).send('Sorry, that route does not exist.');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
