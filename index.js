require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json();
const mongoose = require('mongoose');
const Token = require('./token'); // Adjust the path as necessary


const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB'))
  .catch(err => console.error('Connection error', err));

const app = express();
app.use(express.static('public'));
app.use(cors());
// Configure session middleware





app.get('/oauth-callback', async (req, res) => {
    const requestToken = req.query.code; // Get the code from the query parameter
    const user=req.query.user;
    console.log(user);
    axios({
        method: 'post',
        url: `https://github.com/login/oauth/access_token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${requestToken}`,
        headers: {
            accept: 'application/json'
        }
    }).then(async (response) => {
        // Store the access token in session data
        const accessToken = response.data.access_token;
        const userResponse = await axios({
            method: 'get',
            url: `https://api.github.com/user`,
            headers: {
                Authorization: `token ${accessToken}`
            }
        });
        const username = userResponse.data.login;

        // Save or update the user's token in the database
        const userData = await Token.findOneAndUpdate({ name: username }, {
            name: username,
            token: accessToken
        }, { new: true, upsert: true });
        
        res.redirect(`https://git-api-nu.vercel.app/${user}`); 
    }).catch(error => {
        res.send("Error during token exchange: " + error);
    });
});


app.post('/get-repos', jsonParser, async (req, res) => {
    // Extract username from request body
    const username = req.body.user;
    console.log(username);
    if (!username) {
        return res.status(400).send("Username is required");
    }

    try {
        // Find the user in the database
        const userToken = await Token.findOne({ name: username });
        if (!userToken || !userToken.token) {
            return res.status(404).send("User not found or no access token available");
        }
        console.log(userToken);
        const accessToken = userToken.token;
        // Use the access token to fetch repositories from GitHub
        const reposResponse = await axios.get('https://api.github.com/user/repos', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        res.json(reposResponse.data); // Send the repositories back to the client
    } catch (error) {
        console.error("Error fetching repositories", error);
        res.status(500).send("Error fetching repositories");
    }
});


app.post('/save-file', jsonParser, async (req, res) => {
    const owner = req.body.owner; // The GitHub username
    const repo = req.body.repo; // The repository name
    const path = '.github/FUNDING.yml';
    const content = req.body.content;
    const contentBase64 = Buffer.from(content).toString('base64');
    const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    if (!owner) {
        return res.status(400).send("Owner username is required");
    }

    try {
        // Find the user's access token in the database
        const userToken = await Token.findOne({ name: owner });
        if (!userToken || !userToken.token) {
            return res.status(404).send("User not found or no access token available");
        }
        const accessToken = userToken.token;

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
                payload.sha = sha; // Include SHA if updating the file
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
    } catch (error) {
        console.error("Database or GitHub API error", error);
        res.status(500).send("Internal Server Error");
    }
});



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/index.html')); // Adjust with the actual path to your HTML file
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
