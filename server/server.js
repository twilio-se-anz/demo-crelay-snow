/**
 * Main server file that sets up Express with WebSocket support and defines API endpoints.
 * @module server
 * @requires dotenv
 * @requires express
 * @requires express-ws
 */

require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');
const app = express();
const PORT = process.env.PORT || 3000;
ExpressWs(app);     // Initialize express-ws

app.use(express.urlencoded({ extended: true }));    // For Twilio url encoded body
app.use(express.json());    // For JSON payloads

const { logOut, logError } = require('./utils/logger');

// Import the services
const { ConversationRelayService } = require('./services/ConversationRelayService');
const { OpenAIService } = require('./services/OpenAIService');
const { TwilioService } = require('./services/twilioService');




/****************************************************
 * 
 * Web Socket Endpoints
 * 
 ****************************************************/

/**
 * WebSocket endpoint for real-time conversation relay.
 * Handles the lifecycle of a conversation session including setup, message processing, and cleanup.
 * 
 * @name ws/conversation-relay
 * @function
 * @param {WebSocket} ws - The WebSocket connection object
 * 
 * @listens message
 * Expects JSON messages with the following structure:
 * - First message must be a setup message containing initial configuration
 * - Subsequent messages should follow the conversation relay protocol
 * 
 * @listens close
 * Handles client disconnection by cleaning up resources
 * 
 * @listens error
 * Handles WebSocket errors and performs cleanup
 * 
 * @emits message
 * Sends JSON messages back to the client with conversation updates and responses
 */
app.ws('/conversation-relay', (ws) => {

    let sessionConversationRelay = null;
    let sessionData = {};

    // Handle incoming messages fro this WS session.
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            // logOut('WS', `Received message of type: ${message.type}`);
            // If the sessionConversationRelay does not exist, initialise it else handle the incoming message
            if (!sessionConversationRelay) {
                logOut('WS', `Session Conversation Relay being initialised`);

                // Since this is the first message from CR, it will be a setup message, so add the Conversation Relay "setup" message data to the sessionCData
                logOut('WS', `Adding setup CR setup message data to sessionData. Message type: ${message.type}`);
                sessionData.setupData = message;
                sessionData.customerData = {};  // Add any Customer data here

                // Create new response Service.
                logOut('WS', `Creating Response Service`);
                const sessionResponseService = new OpenAIService();

                logOut('WS', `Creating ConversationRelayService`);
                sessionConversationRelay = new ConversationRelayService(sessionResponseService, sessionData);

                // Attach the Event listener to send event messages from the Conversation Relay back to the WS client
                sessionConversationRelay.on('conversationRelay.outgoingMessage', (outgoingMessage) => {
                    // logOut('WS', `Sending message out: ${JSON.stringify(outgoingMessage)}`);
                    ws.send(JSON.stringify(outgoingMessage));
                });
            }

            sessionConversationRelay.incomingMessage(message);

        } catch (error) {
            logError('WS', `Error in websocket message handling: ${error}`);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        logOut('WS', 'Client ws disconnected');
        // Clean up ConversationRelay and its listeners
        if (sessionConversationRelay) {
            sessionConversationRelay.cleanup();
        }
        // Remove WebSocket listeners
        ws.removeAllListeners();
    });

    // Handle errors
    ws.on('error', (error) => {
        logError('WS', `WebSocket error: ${error}`);
        // Clean up ConversationRelay and its listeners
        if (sessionConversationRelay) {
            sessionConversationRelay.cleanup();
        }
        // Remove WebSocket listeners
        ws.removeAllListeners();
    });
});

/****************************************************
 * 
 * Web Server Endpoints
 * 
 ****************************************************/

/**
 * Basic health check endpoint to verify server status.
 * 
 * @name GET /
 * @function
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {string} Simple text response indicating server is running
 */
app.get('/', (req, res) => {
    res.send('WebSocket Server Running');
});

/**
 * Initiates a connection to the Conversation Relay service.
 * 
 * @name POST /connectConversationRelay
 * @function
 * @async
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {Object} req.body - Request body
 * @param {string} req.body.customerReference - Customer reference identifier
 * @param {string} req.body.serverBaseUrl - Base URL of the server
 * @returns {string} TwiML response for establishing the connection
 */
app.post('/connectConversationRelay', async (req, res) => {
    // Extract and use this body:  body: {customerReference, serverBaseUrl}

    logOut('Server', `Received request to connect to Conversation Relay`);
    const twilioService = new TwilioService();
    const serverBaseUrl = process.env.SERVER_BASE_URL;
    const twiml = twilioService.connectConversationRelay("customerReference123", serverBaseUrl);
    res.send(twiml.toString());
});

/****************************************************
 * 
 * Web Server
 * 
 ****************************************************/

/**
 * Server initialization and port management.
 * Attempts to start the server on the configured port (from environment or default 3000).
 * If the port is in use, incrementally tries the next port number.
 * 
 * @function startServer
 * @returns {http.Server} Express server instance
 * @throws {Error} If server fails to start for reasons other than port in use
 */
let currentPort = PORT;

const startServer = () => {
    try {
        const server = app.listen(currentPort, async () => {
            try {
                logOut('Server', `Server is running on port ${currentPort}`);
            } catch (error) {
                logError('Server', `Failed to load initial context and manifest: ${error}`);
                process.exit(1);
            }
        });
    } catch (error) {
        if (error.code === 'EADDRINUSE') {
            logOut('Server', `Port ${currentPort} is in use, trying ${currentPort + 1}`);
            currentPort++;
            startServer();
        } else {
            logError('Server', `Failed to start server: ${error}`);
            process.exit(1);
        }
    }
};

startServer();
