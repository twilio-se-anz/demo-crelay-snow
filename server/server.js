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
let serverBaseUrl = process.env.SERVER_BASE_URL || "localhost"; // Store server URL
ExpressWs(app);     // Initialize express-ws

app.use(express.urlencoded({ extended: true }));    // For Twilio url encoded body
app.use(express.json());    // For JSON payloads

const { logOut, logError } = require('./utils/logger');

// Import the services
const { ConversationRelayService } = require('./services/ConversationRelayService');
const { OpenAIService } = require('./services/OpenAIService');
const { DeepSeekService } = require('./services/DeepSeekService');
const { TwilioService } = require('./services/TwilioService');

/**
 * This customerDataMap illustrates how you would pass data via Conversation Relay Parameters.
 * The intention is to store and get data via this map per WS session
 * TODO: Can this be per WS session?
 */
let customerDataMap = new Map();
const twilioService = new TwilioService();

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

                // Since this is the first message from CR, it will be a setup message, so add the Conversation Relay "setup" message data to the session.
                logOut('WS', `Adding setup CR setup message data to sessionData. Message type: ${message.type} and customerReference: ${message.customParameters?.customerReference}`);

                // This extracts the data from the customerDataMap and adds it to the sessionData
                // sessionCustomerData = customerDataMap.get(message.customParameters.customerReference);

                sessionData.setupData = message;
                sessionData.customerData = customerDataMap.get(message.customParameters.customerReference);

                // Create new response Service.
                logOut('WS', `Creating Response Service`);
                const sessionResponseService = new OpenAIService();
                // const sessionResponseService = new DeepSeekService();

                // Add an event listener for the response service for this particular session based on the call SID. This allows any endpoint to send a message to Session Response Service.
                sessionResponseService.on(`responseService.${message.callSid}`, (responseMessage) => {
                    logOut('WS', `Got a call SID event for the session response service: ${JSON.stringify(responseMessage)}`);
                    // Send the message to the Session Response Service
                    // sessionResponseService.incomingMessage(responseMessage);
                });

                logOut('WS', `Creating ConversationRelayService`);
                sessionConversationRelay = new ConversationRelayService(sessionResponseService, sessionData);

                // Attach the Event listener to send event messages from the Conversation Relay back to the WS client
                sessionConversationRelay.on('conversationRelay.outgoingMessage', (outgoingMessage) => {
                    // logOut('WS', `Sending message out: ${JSON.stringify(outgoingMessage)}`);
                    ws.send(JSON.stringify(outgoingMessage));
                });

                // Now attach an event listener to the twilioService for non-websocket events
                twilioService.on(`twilioService.${message.callSid}`, (statusCallback) => {
                    logOut('WS', `Call SID: ${message.callSid} twilio service sent status callback: ${JSON.stringify(statusCallback)}`);
                    // Send the message to the Session Response Service
                    sessionConversationRelay.incomingMessage(statusCallback);
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
 * Initiates an outbound call and connects it to the Conversation Relay via the Twilio Service service. The intention is to provide any amount of data in this request, but
 * that only the reference will be used to connect to the Conversation Relay. Once the reference is connected via Conversation Relay, it can be used to look up the full data set
 * stored here again. This illustrates how to pass parameters via the Conversation Relay Parameter field.
 * 
 * Call this endpoint with some sample data.
 * 
 * ``` terminal
 * curl  -X POST \
 *  'https://server-des.ngrok.dev/outboundCall' \
 *  --header 'Content-Type: application/json' \
 *  --data-raw '{
 *      "properties": {
 *          "phoneNumber": "+1234567890",
 *          "customerReference": "abc123",
 *          "firstname": "Bob",
 *          "lastname": "Jones"
 *      }
 *   }'
 * ```
 * This data will be stored in a local Map and can be retrieved via the customerReference.
 * 
 * @endpoint POST /outboundCall
 * 
 * @param {Object} req.body.properties - API request data properties
 * @param {string} req.body.properties.phoneNumber - [REQUIRED] Call's outbound phone number to call
 * @param {string} req.body.properties.customerReference - [OPTIONAL] Unique reference to pass along with the call
 * 
 * @returns {Object} response
 * @returns {string} [response.error] - Error message if the call failed
 * 
 */
app.post('/outboundCall', async (req, res) => {

    const requestData = req.body.properties;
    customerDataMap.set(requestData.customerReference, { requestData });

    try {
        logOut('Server', `/outboundCall: Initiating outbound call`);
        // const twilioService = new TwilioService();

        const response = await twilioService.makeOutboundCall(
            serverBaseUrl,
            requestData.phoneNumber,
            requestData.customerReference
        );

        logOut('Server', `/outboundCall: Call initiated with call SID: ${response}`);

        res.json({ success: true, response: response });
    } catch (error) {
        logError('Server', `Error initiating outbound call: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
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
    logOut('Server', `Received request to connect to Conversation Relay`);
    // const twilioService = new TwilioService();

    const twiml = twilioService.connectConversationRelay(serverBaseUrl);
    res.send(twiml.toString());
});

/**
 * Payment status callback endpoint
 * The payment endpoint will send data to this endpoint to indicate the status of the payment. This needs to be now sent to the Conversation Relay to
 * inform it of the progress.
 */
app.post('/twilioStatusCallback', async (req, res) => {
    const statusCallBack = req.body;
    logOut('Server', `Received a Twilio status call back: ${JSON.stringify(statusCallBack)}`);
    // Extract the call SID from the statusCallBack and insert the content into the paymentDataMap overwriting the existing content.
    const callSid = statusCallBack.CallSid;
    // Now that we have the call SID, emit an event to tell the relevant session about the call back received. TODO: For now we will just send the raw data, but might have to create a helper method to massage the message and use the data under Twilio Service.
    // const twilioService = new TwilioService();
    twilioService.evaluateStatusCallback(statusCallBack);
    res.json({ success: true });
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
