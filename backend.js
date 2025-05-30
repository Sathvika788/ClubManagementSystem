const express = require('express');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser'); // Still used, but express.json/urlencoded are preferred for new apps
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'jwt_secret_key_54742384238423_ahfgrdtTFHHYJNMP[]yigfgfjdfjd=-+&_+pqiel;,,dkvntegdv/cv,mbkzmbzbhsbha#&$^&(#__enD';

// Configure AWS SDK
AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIARC5P65QCTXPFJGOE', // IMPORTANT: In a real application, never hardcode credentials like this.
    secretAccessKey: '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', // Use environment variables or IAM roles.
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = 'Users';
const EVENTS_TABLE = 'Events'; // This table still holds the master list of events created by admins

// Define a mapping from eventType to the specific club table name for registrations
const CLUB_REGISTRATION_TABLES = {
    'Drama': 'DramaClubEvents',
    'Coding': 'CodingClubEvents',
    'Kruthi': 'KruthiClubEvents',
    'Prakruthi': 'PrakruthiClubEvents',
    'Spoorthi': 'SpoorthiClubEvents'
};

// Middleware setup
app.use(cors()); // Enable CORS for all origins

// IMPORTANT: Use express.json() and express.urlencoded() for parsing request bodies
// Place these before bodyParser.json() if you are using both, or remove bodyParser if not needed.
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
app.use(bodyParser.json()); // Keep if other parts of your app explicitly rely on it, otherwise consider removing.


// Serve static files from the 'static' directory
app.use('/static', express.static(path.join(__dirname, 'static')));

// Handle favicon.ico requests to prevent 404s
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Serve specific static HTML pages
const pages = [
    'home', 'Login', 'Signup', 'EventRegister', 'userhome', 'LeaderBoard',
    'developers', 'data', 'Submissions', 'adminDashboard',
    'coding-club', 'spoorthi-club', 'Kruthi-club', 'drama-club', 'prakruthi-club',
    'Eventprakruthi-club', 'Eventspoorthi-club', 'Eventkruthi-club', 'Eventdrama-club', 'Eventcoding-club'
];
pages.forEach(page => {
    app.get(`/${page}.html`, (req, res) => res.sendFile(path.join(__dirname, `${page}.html`)));
});

// Explicitly serve other static HTML routes and assets
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));
app.get('/Login', (req, res) => res.sendFile(path.join(__dirname, 'Login.html')));
app.get('/Signup', (req, res) => res.sendFile(path.join(__dirname, 'Signup.html')));
app.get('/Event', (req, res) => res.sendFile(path.join(__dirname, 'EventRegister.html'))); // This is likely the admin event creation page
app.get('/Home', (req, res) => res.sendFile(path.join(__dirname, 'userhome.html')));
app.get('/Leaderboard', (req, res) => res.sendFile(path.join(__dirname, 'LeaderBoard.html')));
app.get('/developers', (req, res) => res.sendFile(path.join(__dirname, 'developers.html')));
app.get('/data', (req, res) => res.sendFile(path.join(__dirname, 'data.html')));
app.get('/Submissions', (req, res) => res.sendFile(path.join(__dirname, 'Submissions.html')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
app.get('/banner.jpg', (req, res) => res.sendFile(path.join(__dirname, 'banner.jpg')));
app.get('/coding-club', (req, res) => res.sendFile(path.join(__dirname, 'coding-club.html')));
app.get('/spoorthi-club', (req, res) => res.sendFile(path.join(__dirname, 'spoorthi-club.html')));
app.get('/Kruthi-club', (req, res) => res.sendFile(path.join(__dirname, 'Kruthi-club.html')));
app.get('/drama-club', (req, res) => res.sendFile(path.join(__dirname, 'drama-club.html')));
app.get('/prakruthi-club', (req, res) => res.sendFile(path.join(__dirname, 'prakruthi-club.html')));
app.get('/userhome', (req, res) => res.sendFile(path.join(__dirname, 'userhome.html')));
app.get('/Eventprakruthi-club', (req, res) => res.sendFile(path.join(__dirname, 'Eventprakruthi-club.html')));
app.get('/Eventspoorthi-club', (req, res) => res.sendFile(path.join(__dirname, 'Eventspoorthi-club.html')));
app.get('/Eventkruthi-club', (req, res) => res.sendFile(path.join(__dirname, 'Eventkruthi-club.html')));
app.get('/Eventdrama-club', (req, res) => res.sendFile(path.join(__dirname, 'Eventdrama-club.html')));
app.get('/Eventcoding-club', (req, res) => res.sendFile(path.join(__dirname, 'Eventcoding-club.html')));
app.get('/adminDashboard', (req, res) => res.sendFile(path.join(__dirname, 'adminDashboard.html')));

// Routes for the student event registration pages (5 different ones)
app.get('/DramaEventRegistration', (req, res) => res.sendFile(path.join(__dirname, 'DramaEventRegistration.html')));
app.get('/CodingEventRegistration', (req, res) => res.sendFile(path.join(__dirname, 'CodingEventRegistration.html')));
app.get('/KruthiEventRegistration', (req, res) => res.sendFile(path.join(__dirname, 'KruthiEventRegistration.html')));
app.get('/PrakruthiEventRegistration', (req, res) => res.sendFile(path.join(__dirname, 'PrakruthiEventRegistration.html')));
app.get('/SpoorthiEventRegistration', (req, res) => res.sendFile(path.join(__dirname, 'SpoorthiEventRegistration.html')));


// =====================
// User Signup Route
// =====================
app.post('/signup', async (req, res) => {
    const { email, password, username, mobile } = req.body;
    if (!email || !password || !username || !mobile) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    try {
        // Check if username already exists
        const usernameExists = await dynamodb.query({
            TableName: USERS_TABLE,
            IndexName: 'username-index', // Ensure this GSI exists in DynamoDB
            KeyConditionExpression: 'username = :username',
            ExpressionAttributeValues: { ':username': username.toLowerCase() },
        }).promise();

        if (usernameExists.Items.length > 0) {
            return res.status(400).json({ message: 'Username already in use' });
        }

        // Check if email already exists
        const emailExists = await dynamodb.query({
            TableName: USERS_TABLE,
            IndexName: 'email-index', // Ensure this GSI exists in DynamoDB
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': email },
        }).promise();

        if (emailExists.Items.length > 0) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Check if mobile number already exists
        const mobileExists = await dynamodb.query({
            TableName: USERS_TABLE,
            IndexName: 'mobile-index', // Ensure this GSI exists in DynamoDB
            KeyConditionExpression: 'mobile = :mobile',
            ExpressionAttributeValues: { ':mobile': mobile },
        }).promise();

        if (mobileExists.Items.length > 0) {
            return res.status(400).json({ message: 'Mobile no already in use' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user item
        const newUser = {
            userId: uuidv4(), // Generate a unique ID for the user
            email,
            mobile,
            password: hashedPassword,
            username: username.toLowerCase(), // Store username in lowercase for consistency
            createdAt: new Date().toISOString(), // Timestamp for creation
        };

        // Put the new user into DynamoDB
        await dynamodb.put({
            TableName: USERS_TABLE,
            Item: newUser,
        }).promise();

        return res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        console.error('Signup error:', err);
        return res.status(500).json({ message: 'Server error: ' + err.message });
    }
});


// =====================
// User Login Route
// =====================
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }

    try {
        // Query user by email
        const userQuery = await dynamodb.query({
            TableName: USERS_TABLE,
            IndexName: 'email-index', // Ensure this GSI exists in DynamoDB
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': email },
        }).promise();

        if (userQuery.Items.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' }); // User not found
        }

        const user = userQuery.Items[0];
        // Compare provided password with hashed password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid credentials' }); // Incorrect password
        }

        // Generate JWT token for user
        const token = jwt.sign(
            { id: user.userId, username: user.username, email: user.email },
            SECRET_KEY,
            { expiresIn: '1h', algorithm: 'HS512' } // Token expires in 1 hour
        );

        return res.status(200).json({ token }); // Send token back to client
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// =====================
// Token Validation Route
// =====================
app.post('/valid', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Token missing' });

    // Extract token from 'Bearer <token>' format
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        // Verify the token using the secret key and algorithm
        const decoded = jwt.verify(token, SECRET_KEY, { algorithms: ['HS512'] });
        // Return user ID and username from the decoded token
        res.status(200).json({ userId: decoded.id, username: decoded.username });
    } catch (err) {
        // Handle token expiration or invalid token errors
        res.status(401).json({
            message: err instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token',
        });
    }
});

// =====================
// Event Registration Route (for Admins to POST new events)
// Requires eventType in the request body (e.g., 'Drama', 'Coding', 'Kruthi', 'Prakruthi', 'Spoorthi')
// =====================
app.post('/registerEvent', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'Authentication token missing' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        const decoded = jwt.verify(token, SECRET_KEY, { algorithms: ['HS512'] });

        const { eventName, eventDate, eventTime, eligibility, eventType } = req.body;
        if (!eventName || !eventDate || !eventTime || !eligibility || !eventType) {
            return res.status(400).json({ message: 'Please provide all required event details including event type' });
        }

        if (!CLUB_REGISTRATION_TABLES.hasOwnProperty(eventType)) {
            return res.status(400).json({ message: 'Invalid event type' });
        }

        const newEvent = {
            eventId: uuidv4(),
            eventName,
            eventDate: new Date(eventDate).toISOString(),
            eventTime,
            eligibility,
            registeredBy: decoded.id,
            userEmail: decoded.email,
            createdAt: new Date().toISOString(),
            eventType,
        };

        await dynamodb.put({
            TableName: EVENTS_TABLE,
            Item: newEvent,
        }).promise();

        console.log(`Event registered: ${eventName} by ${decoded.username} for ${eventType}`);
        return res.status(201).json({ message: 'Event registered successfully' });

    } catch (err) {
        console.error('Event registration error:', err);
        if (err instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// Helper function to fetch events by type
const fetchEventsByType = async (eventType, token) => {
    if (!token) {
        // Corrected: Removed redundant 'new' keyword
        throw new Error('Authentication token missing');
    }
    jwt.verify(token, SECRET_KEY, { algorithms: ['HS512'] }); // Verify token

    const params = {
        TableName: EVENTS_TABLE, // Always fetch events from the main EVENTS_TABLE
        FilterExpression: 'eventType = :type',
        ExpressionAttributeValues: {
            ':type': eventType
        }
    };
    const result = await dynamodb.scan(params).promise();

    // Sort events by date and time
    return result.Items.sort((a, b) => {
        const dateA = new Date(`${a.eventDate}T${a.eventTime}`);
        const dateB = new Date(`${b.eventDate}T${b.eventTime}`);
        return dateA - dateB;
    });
};

// Helper function for student event registration
const registerStudentForEvent = async (req, res, expectedEventType) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'Authentication token missing' });
    }
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        const decoded = jwt.verify(token, SECRET_KEY, { algorithms: ['HS512'] });
        const registeringUserId = decoded.id;

        const { eventId, studentName, studentEmail, studentMobile, studentId } = req.body;

        if (!eventId || !studentName || !studentEmail || !studentMobile || !studentId) {
            return res.status(400).json({ message: 'Please provide all required student registration details.' });
        }

        // Determine the target table name for registration
        const targetRegistrationTable = CLUB_REGISTRATION_TABLES[expectedEventType];
        if (!targetRegistrationTable) {
            return res.status(400).json({ message: 'Invalid event type for registration table lookup.' });
        }

        // Check if the eventId actually exists in the master EVENTS_TABLE and matches the expected event type
        const eventParams = {
            TableName: EVENTS_TABLE,
            Key: {
                'eventId': eventId
            }
        };
        const eventCheck = await dynamodb.get(eventParams).promise();
        if (!eventCheck.Item) {
            return res.status(404).json({ message: 'Selected event not found in master list.' });
        }
        if (eventCheck.Item.eventType !== expectedEventType) {
            return res.status(400).json({ message: `Selected event is not a ${expectedEventType} event.` });
        }

        // Retrieve eventName and include it in newRegistration
        const eventName = eventCheck.Item.eventName;
        if (!eventName) {
            // This case should ideally not happen if event creation is robust, but good for safety
            return res.status(500).json({ message: 'Event name not found for the selected event in the Events table.' });
        }

        // Check if this student is already registered for this event IN THE SPECIFIC CLUB TABLE
        const existingRegistration = await dynamodb.query({
            TableName: targetRegistrationTable, // Query the club-specific table for duplicates
            IndexName: 'eventId-studentId-index', // This GSI MUST exist on all *ClubEvents tables
            KeyConditionExpression: 'eventId = :eventId AND studentId = :studentId',
            ExpressionAttributeValues: {
                ':eventId': eventId,
                ':studentId': studentId
            }
        }).promise();

        if (existingRegistration.Items.length > 0) {
            return res.status(409).json({ message: 'Student already registered for this event in this club.' });
        }

        const newRegistration = {
            registrationId: uuidv4(), // Unique ID for this registration
            eventId,
            eventName, // ADDED: Include eventName here
            studentName,
            studentEmail,
            studentMobile,
            studentId,
            registeredByUserId: registeringUserId, // Link to the logged-in user
            registeredAt: new Date().toISOString(),
            eventType: expectedEventType // Store the event type with the registration
        };

        await dynamodb.put({
            TableName: targetRegistrationTable, // Put the registration into the club-specific table
            Item: newRegistration,
        }).promise();

        res.status(201).json({ message: `Student successfully registered for the ${expectedEventType} event!` });

    } catch (err) {
        console.error(`Student ${expectedEventType} event registration error:`, err);
        if (err instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: 'Token expired' });
        }
        res.status(500).json({ message: `Server error during student ${expectedEventType} event registration: ` + err.message });
    }
};


// ===================================
// GET Routes to fetch Events by Type
// These still fetch from the main EVENTS_TABLE
// ===================================

app.get('/events/drama', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) : null;
        const events = await fetchEventsByType('Drama', token);
        res.status(200).json(events);
    } catch (err) {
        console.error('Error fetching drama events:', err);
        if (err.message === 'Authentication token missing' || err.message === 'Invalid or expired token.') {
            return res.status(401).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error fetching events: ' + err.message });
    }
});

app.get('/events/coding', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) : null;
        const events = await fetchEventsByType('Coding', token);
        res.status(200).json(events);
    } catch (err) {
        console.error('Error fetching coding events:', err);
        if (err.message === 'Authentication token missing' || err.message === 'Invalid or expired token.') {
            return res.status(401).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error fetching events: ' + err.message });
    }
});

app.get('/events/kruthi', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) : null;
        console.log("Attempting to fetch Kruthi events from DynamoDB..."); // Debug log
        const events = await fetchEventsByType('Kruthi', token);
        console.log("Successfully fetched Kruthi events:", events.length, "items found."); // Debug log
        res.status(200).json(events);
    } catch (err) {
        console.error('Error fetching Kruthi events:', err);
        if (err.message === 'Authentication token missing' || err.message === 'Invalid or expired token.') {
            return res.status(401).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error fetching events: ' + err.message });
    }
});

app.get('/events/prakruthi', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) : null;
        console.log("Attempting to fetch Prakruthi events from DynamoDB...");
        const events = await fetchEventsByType('Prakruthi', token);
        console.log("Successfully fetched Prakruthi events:", events.length, "items found.");
        res.status(200).json(events);
    } catch (err) {
        console.error('Error fetching Prakruthi events:', err);
        if (err.message === 'Authentication token missing' || err.message === 'Invalid or expired token.') {
            return res.status(401).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error fetching events: ' + err.message });
    }
});

app.get('/events/spoorthi', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) : null;
        console.log("Attempting to fetch Spoorthi events from DynamoDB...");
        const events = await fetchEventsByType('Spoorthi', token);
        console.log("Successfully fetched Spoorthi events:", events.length, "items found.");
        res.status(200).json(events);
    } catch (err) {
        console.error('Error fetching Spoorthi events:', err);
        if (err.message === 'Authentication token missing' || err.message === 'Invalid or expired token.') {
            return res.status(401).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error fetching events: ' + err.message });
    }
});

// ==========================================
// POST Routes for Student Event Registration
// Registrations now go to specific club tables
// ==========================================

app.post('/registerStudentForDramaEvent', async (req, res) => {
    await registerStudentForEvent(req, res, 'Drama');
});

app.post('/registerStudentForCodingEvent', async (req, res) => {
    await registerStudentForEvent(req, res, 'Coding');
});

app.post('/registerStudentForKruthiEvent', async (req, res) => {
    await registerStudentForEvent(req, res, 'Kruthi');
});

app.post('/registerStudentForPrakruthiEvent', async (req, res) => {
    await registerStudentForEvent(req, res, 'Prakruthi');
});

app.post('/registerStudentForSpoorthiEvent', async (req, res) => {
    await registerStudentForEvent(req, res, 'Spoorthi');
});


// =====================
// Catch-all 404 handler
// =====================
app.use((req, res, next) => {
    console.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ message: 'Requested resource not found.' });
});

// Start the server
//app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
app.listen(5000, '0.0.0.0', () => {
   console.log('Server running at http://0.0.0.0:5000');
});
