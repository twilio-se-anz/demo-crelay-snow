require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');

const app = express();
const PORT = process.env.PORT || 3000;
// Extract all the .env variables here
const { SERVER_URL } = process.env;
const { TWILIO_FUNCTIONS_URL } = process.env;
const { OPENAI_API_KEY } = process.env;
const { OPENAI_MODEL } = process.env;

// Initialize express-ws
ExpressWs(app);

// WebSocket endpoint
app.ws('/', (ws) => {
    console.log('New websocket established');

    // Handle incoming messages
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('Received:', message);

        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

////////// SERVER BASICS //////////

// Basic HTTP endpoint
app.get('/', (req, res) => {
    res.send('WebSocket Server Running');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
    } else {
        console.error('Failed to start server:', error);
    }
    process.exit(1);
});
