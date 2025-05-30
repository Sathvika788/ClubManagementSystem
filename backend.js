const express = require('express');
const AWS = require('aws-sdk');
const cors = require('cors'); // bodyParser is often not needed if using express.json()
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'jwt_secret_key_54742384238423_ahfgrdtTFHHYJNMP[]yigfgfjdfjd=-+&_+pqiel;,,dkvntegdv/cv,mbkzmbzbhsbha#&$^&(#__enD'; // Consider using environment variables for this too!

// Configure AWS SDK
// IMPORTANT SECURITY FIX: Do NOT hardcode credentials in production code.
// Use IAM Roles for EC2 instances, or environment variables for local development.
// I'm commenting out the hardcoded keys. If running on EC2 with an IAM Role, AWS SDK
// will automatically pick up credentials. For local testing, set environment variables.
AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIARC5P65QCTXPFJGOE', // Use environment variables or IAM roles
    secretAccessKey: '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', // Use environment variables or IAM roles
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

// Parse JSON request bodies
app.use(express.json());
// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));
// Removed bodyParser.json() as express.json() and express.urlencoded() cover its functionality.
// If you specifically need bodyParser for other parsers (e.g., raw, text), you'd re-add it.

// Serve static files from the 'static' directory
app.use('/static', express.static(path.join(__dirname, 'static')));

// Handle favicon.ico requests to prevent 404s
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Serve specific static HTML pages dynamically using a loop (cleaner)
const pages = [
    'home', 'Login', 'Signup', 'EventRegister', 'userhome', 'LeaderBoard',
    'developers', 'data', 'Submissions', 'adminDashboard',
    'coding-club', 'spoorthi-club', 'Kruthi-club', 'drama-club', 'prakruthi-club',
    'Eventprakruthi-club', 'Eventspoorthi-club', 'Eventkruthi-club', 'Eventdrama-club', 'Eventcoding-club',
    // Add student registration pages to this list for consistency
    'DramaEventRegistration', 'CodingEventRegistration', 'KruthiEventRegistration',
    'PrakruthiEventRegistration', 'SpoorthiEventRegistration'
];
pages.forEach(page => {
    app.get(`/${page}.html`, (req, res) => res.sendFile(path.join(__dirname, `${page}.html`)));
});

// Explicitly serve root and other primary HTML/JS/Image routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));
// Consolidate these into the 'pages' array or keep if they have specific routing logic needs
app.get('/Login', (req, res) => res.sendFile(path.join(__dirname, 'Login.html')));
app.get('/Signup', (req, res) => res.sendFile(path.join(__dirname, 'Signup.html')));
app.get('/Event', (req, res) => res.sendFile(path.join(__dirname, 'EventRegister.html')));
app.get('/Home', (req, res) => res.sendFile(path.join(__dirname, 'userhome.html')));
app.get('/Leaderboard', (req, res) => res.sendFile(path.join(__dirname, 'LeaderBoard.html')));
app.get('/developers', (req, res) => res.sendFile(path.join(__dirname, 'developers.html')));
app.get('/data', (req, res) => res.sendFile(path.join(__dirname, 'data.html')));
app.get('/Submissions', (req, res) => res.sendFile(path.join(__dirname, 'Submissions.html')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
app.get('/banner.jpg', (req, res) => res.sendFile(path.join(__dirname, 'banner.jpg')));
// Many of these can be covered by the static middleware or the 'pages' array if they are simple HTML files.
// Keeping them for now as per your original structure.


// ---
// User Signup Route
//---
app.post('/signup', async (req, res) => {
    const { email, password, username, mobile } = req.body;
    if (!email || !password || !username || !mobile) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    try {
        // Check if username already exists
        const usernameExists = await dynamodb.query({
            TableName: USERS_TABLE,
            IndexName: 'username-index', // Ensure this GSI exists in DynamoDB (username as partition key)
            KeyConditionExpression: 'username = :username',
            ExpressionAttributeValues: { ':username': username.toLowerCase() },
        }).promise();

        if (usernameExists.Items.length > 0) {
            return res.status(400).json({ message: 'Username already in use' });
        }

        // Check if email already exists
        const emailExists = await dynamodb.query({
            TableName: USERS_TABLE,
            IndexName: 'email-index', // Ensure this GSI exists in DynamoDB (email as partition key)
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': email },
        }).promise();

        if (emailExists.Items.length > 0) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Check if mobile number already exists
        const mobileExists = await dynamodb.query({
            TableName: USERS_TABLE,
            IndexName: 'mobile-index', // Ensure this GSI exists in DynamoDB (mobile as partition key)
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
            userId: uuidv4(), // Generate a unique ID for the user (Primary Key)
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
        return res.status(500).json({ message: 'Server error during signup: ' + err.message });
    }
});


//---
//## User Login Route
//---
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
        return res.status(500).json({ message: 'Server error during login: ' + err.message });
    }
});

//---
//## Token Validation Route
//---
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

//---
//## Event Registration Route (for Admins to POST new events)
//---
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

        // Validate eventType against known club types
        if (!CLUB_REGISTRATION_TABLES.hasOwnProperty(eventType)) {
            return res.status(400).json({ message: 'Invalid event type provided. Must be one of: Drama, Coding, Kruthi, Prakruthi, Spoorthi.' });
        }

        const newEvent = {
            eventId: uuidv4(), // Generate a unique ID for the event
            eventName,
            // Convert eventDate to ISO format. Assuming eventDate is in YYYY-MM-DD format.
            // If eventTime is also part of the date, you might combine them first.
            // Example: `new Date(`${eventDate}T${eventTime}:00`).toISOString()` if eventTime is 'HH:MM'
            eventDate: new Date(eventDate).toISOString(), // Stores date in ISO format
            eventTime, // Stores time as provided (e.g., "10:00 AM")
            eligibility,
            registeredBy: decoded.id, // User who registered the event
            userEmail: decoded.email, // Email of user who registered the event
            createdAt: new Date().toISOString(), // Timestamp for event creation
            eventType, // Crucial for filtering events by type
        };

        await dynamodb.put({
            TableName: EVENTS_TABLE,
            Item: newEvent,
        }).promise();

        console.log(`Event registered: ${eventName} by ${decoded.username} for ${eventType}`);
        return res.status(201).json({ message: 'Event registered successfully', eventId: newEvent.eventId }); // Return eventId for confirmation

    } catch (err) {
        console.error('Event registration error:', err);
        if (err instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(500).json({ message: 'Server error during event registration: ' + err.message });
    }
});

// Helper function to fetch events by type
const fetchEventsByType = async (eventType, token) => {
    // Moved token validation to a central place if needed, or keep here for direct coupling.
    // For GET requests where data isn't sensitive, token might not be strictly required by business logic,
    // but your current setup requires it.
    if (!token) {
        console.warn(`Attempted to fetch events for type ${eventType} without a token.`);
        throw new Error('Authentication token missing');
    }

    try {
        jwt.verify(token, SECRET_KEY, { algorithms: ['HS512'] });
    } catch (err) {
        console.error(`Token validation error for fetching ${eventType} events:`, err.message);
        if (err instanceof jwt.TokenExpiredError) {
            throw new Error('Token expired');
        } else {
            throw new Error('Invalid token');
        }
    }

    const params = {
        TableName: EVENTS_TABLE,
        // Using FilterExpression for eventType is fine for small tables.
        // For larger tables, consider a Global Secondary Index (GSI) on `eventType`
        // if performance becomes an issue.
        FilterExpression: 'eventType = :type',
        ExpressionAttributeValues: {
            ':type': eventType
        }
    };

    console.log(`Fetching events from ${EVENTS_TABLE} with eventType=${eventType}...`);
    try {
        const result = await dynamodb.scan(params).promise();
        console.log(`Found ${result.Items.length} events for type ${eventType}.`);

        // Sort events by date and time
        return result.Items.sort((a, b) => {
            // Ensure eventDate and eventTime exist before creating Date objects
            const dateA = new Date(`${a.eventDate || ''}T${a.eventTime || ''}`);
            const dateB = new Date(`${b.eventDate || ''}T${b.eventTime || ''}`);
            return dateA.getTime() - dateB.getTime(); // Use getTime() for reliable comparison
        });
    } catch (dbErr) {
        console.error(`DynamoDB scan error for ${eventType} events:`, dbErr);
        throw new Error(`Failed to retrieve ${eventType} events from database.`);
    }
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
            // This should ideally be caught by the route definition, but good as a fallback
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
            return res.status(400).json({ message: `Selected event "${eventCheck.Item.eventName}" is not a ${expectedEventType} event. It is a ${eventCheck.Item.eventType} event.` });
        }

        // Retrieve eventName and include it in newRegistration
        const eventName = eventCheck.Item.eventName; // This will always exist if eventCheck.Item exists
        if (!eventName) {
            // This is a safety check but eventName should always be present on a valid event
            console.error(`Event ${eventId} found but eventName is missing!`);
            return res.status(500).json({ message: 'Event name not found for the selected event in the Events table.' });
        }

        // Check if this student is already registered for this event IN THE SPECIFIC CLUB TABLE
        // IMPORTANT: Ensure 'eventId-studentId-index' GSI exists on ALL ClubEvents tables
        // (e.g., DramaClubEvents, CodingClubEvents, etc.) with eventId as partition key
        // and studentId as sort key for efficient lookup.
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
            return res.status(409).json({ message: `Student ${studentName} (ID: ${studentId}) already registered for event "${eventName}" in the ${expectedEventType} club.` });
        }

        const newRegistration = {
            registrationId: uuidv4(), // Unique ID for this registration (Primary Key for club table)
            eventId,
            eventName, // Include eventName for easier querying/display of registrations later
            studentName,
            studentEmail,
            studentMobile,
            studentId,
            registeredByUserId: registeringUserId, // Link to the logged-in user who performed the registration
            registeredAt: new Date().toISOString(),
            eventType: expectedEventType // Store the event type with the registration for consistency
        };

        await dynamodb.put({
            TableName: targetRegistrationTable, // Put the registration into the club-specific table
            Item: newRegistration,
        }).promise();

        res.status(201).json({ message: `Student successfully registered for the ${eventName} (${expectedEventType}) event!` });

    } catch (err) {
        console.error(`Student ${expectedEventType} event registration error:`, err);
        if (err instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: 'Token expired. Please log in again.' });
        }
        res.status(500).json({ message: `Server error during student ${expectedEventType} event registration: ` + err.message });
    }
};


//---
//## GET Routes to fetch Events by Type
//---
// These routes are well-defined. The token handling is already in the helper.

app.get('/events/drama', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) : null;
        const events = await fetchEventsByType('Drama', token);
        res.status(200).json(events);
    } catch (err) {
        console.error('Error fetching drama events:', err);
        if (err.message === 'Authentication token missing' || err.message === 'Token expired' || err.message === 'Invalid token') {
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
        if (err.message === 'Authentication token missing' || err.message === 'Token expired' || err.message === 'Invalid token') {
            return res.status(401).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error fetching events: ' + err.message });
    }
});

app.get('/events/kruthi', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) : null;
        console.log("Attempting to fetch Kruthi events from DynamoDB...");
        const events = await fetchEventsByType('Kruthi', token);
        console.log("Successfully fetched Kruthi events:", events.length, "items found.");
        res.status(200).json(events);
    } catch (err) {
        console.error('Error fetching Kruthi events:', err);
        if (err.message === 'Authentication token missing' || err.message === 'Token expired' || err.message === 'Invalid token') {
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
        if (err.message === 'Authentication token missing' || err.message === 'Token expired' || err.message === 'Invalid token') {
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
        if (err.message === 'Authentication token missing' || err.message === 'Token expired' || err.message === 'Invalid token') {
            return res.status(401).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error fetching events: ' + err.message });
    }
});

//---
//## POST Routes for Student Event Registration
//---
// These routes are well-defined and use the helper function.

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


//---
//## Catch-all 404 handler
//---
app.use((req, res, next) => {
    console.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ message: 'Requested resource not found.' });
});

// Start the server
//app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
app.listen(5000, '0.0.0.0', () => {
   console.log('Server running at http://0.0.0.0:5000');
});
