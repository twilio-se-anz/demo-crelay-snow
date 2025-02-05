require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');
const fs = require('fs').promises;
const path = require('path');
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

app.ws('/conversation-relay', (ws) => {

    let sessionConversationRelay = null;
    let sessionData = {};

    // Handle incoming messages
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            // logOut('WS', `Received message of type: ${message.type}`);

            // Initialize connection on setup message and strap in the Conversation Relay and associated LLM Service
            if (message.type === 'setup') {
                logOut('WS', `################################ SETUP START ############################################`);

                // Create new response Service.
                logOut('WS', `Creating Response Service`);
                const sessionResponseService = new OpenAIService();

                logOut('WS', `Creating ConversationRelayService`);
                sessionConversationRelay = new ConversationRelayService(sessionResponseService);

                // Add the Conversation Relay "setup" message data to the sessionCData
                sessionData.setupData = message;
                sessionData.customerData = {};  // Add any Customer data here

                // Now handle the setup message in Conversation Relay
                sessionConversationRelay.setupMessage(sessionData);

                // Send event messages from the Conversation Relay back to the WS client
                sessionConversationRelay.on('conversationRelay.outgoingMessage', (outgoingMessage) => {
                    // logOut('WS', `Sending message out: ${JSON.stringify(outgoingMessage)}`);
                    ws.send(JSON.stringify(outgoingMessage));
                });

                logOut('WS', `###########################  SETUP COMPLETE #######################################`);
                return;
            }

            // ALL Other messages are sent to Conversation Relay
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
// Basic HTTP endpoint
app.get('/', (req, res) => {
    res.send('WebSocket Server Running');
});

app.post('/connectConversationRelay', async (req, res) => {
    // Extract and use this body:  body: {customerReference, serverBaseUrl}

    logOut('Server', `Received request to connect to Conversation Relay`);
    const twilioService = new TwilioService();
    const serverBaseUrl = process.env.SERVER_BASE_URL;
    const twiml = twilioService.connectConversationRelay("customerReference123", serverBaseUrl);
    res.send(twiml.toString());
});


app.post('/tool', async (req, res) => {       // TODO: Temp tool route. Remove later 
    // Extract and use this body:  body: {name: toolName,arguments: toolArguments,     }
    const { name, arguments } = req.body;
    logOut('Server', `Received request to run tool: ${name} with arguments: ${arguments}`);
    // TODO: Execute the tools
    switch (name) {
        case 'sendSMS':
            const { to, message } = arguments;
            const twilioServiceSMS = new TwilioService();
            twilioServiceSMS.sendSMS(to, message);
        default:
            res.status(404).send('Tool not found');
    }
});


/****************************************************
 * 
 * Web Server
 * 
 ****************************************************/
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
