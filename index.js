require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()
var urlencodedParser = bodyParser.urlencoded({ extended: false })

const app = express();
app.use(express.static('public'));
app.use(cors());
// Configure session middleware
app.use(session({
    secret: 'your secret', // Use a real secret in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: !true } // Set secure to true if using https
}));

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;



app.get('/oauth-callback', async (req, res) => {
    const requestToken = req.query.code; // Get the code from the query parameter
    axios({
        method: 'post',
        url: `https://github.com/login/oauth/access_token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${requestToken}`,
        headers: {
            accept: 'application/json'
        }
    }).then(async (response) => {
        // Store the access token in session data
        req.session.accessToken = response.data.access_token;
    }).catch(error => {
        res.send("Error during token exchange: " + error);
    });
});

app.get('/session-data', (req, res) => {
    // Get the session data
    const accessToken = req.session.accessToken;
    // Send back the data
    res.send({
        accessToken: accessToken,
    });
});

app.post('/get-repos', async (req, res) => {
    // Use the access token from session data
    const accessToken = req.session.accessToken;
    if (accessToken) {
        try {
            const reposResponse = await axios.get('https://api.github.com/user/repos', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            res.json(reposResponse.data);
        } catch (error) {
            console.error("Error fetching repositories", error);
            res.status(500).send("Error fetching repositories");
        }
    } else {
        res.status(401).send("No Access Token");
    }
});


app.post('/save-file', jsonParser,async (req, res) => {
    const accessToken = req.session.accessToken;
    const owner = req.body.owner;  // Replace with the actual username
    const repo = req.body.repo;  // Replace with the actual repo name
    const path = '.github/FUNDING.yml';
    const content = req.body.content;
    const contentBase64 = Buffer.from(content).toString('base64');
    const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    axios.get(fileUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    }).then(response => {
        // File exists, get the SHA to update it
        const existingSha = response.data.sha;
        createOrUpdateFile(existingSha);
    }).catch(error => {
        if (error.response && error.response.status === 404) {
            // File does not exist, create it without SHA
            createOrUpdateFile();
        } else {
            // Some other error occurred
            console.error("Error fetching FUNDING.yml", error);
            res.status(500).send("Error fetching FUNDING.yml");
        }
    });
    function createOrUpdateFile(sha) {
        let payload = {
            message: "Creating or updating FUNDING.yml",
            content: contentBase64
        };
        if (sha) {
            payload.sha = sha; // include SHA if updating the file
        }
        axios.put(fileUrl, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        }).then(response => {
            console.log("File created or updated successfully:", response.data);
            res.send(response.data);
        }).catch(error => {
            console.error("Error creating/updating FUNDING.yml", error);
            res.status(500).send("Error creating/updating FUNDING.yml");
        });
    }
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/index.html')); // Adjust with the actual path to your HTML file
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
