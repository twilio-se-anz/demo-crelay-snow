require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');

const app = express();
const initialPort = process.env.PORT || 3000;

// Initialize express-ws
ExpressWs(app);

// WebSocket endpoint
app.ws('/', (ws, req) => {
    console.log('New client connected');

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connection', message: 'Connected to server' }));

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
app.listen(initialPort, () => {
    console.log(`Server is running on port ${initialPort}`);
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${initialPort} is already in use`);
    } else {
        console.error('Failed to start server:', error);
    }
    process.exit(1);
});
