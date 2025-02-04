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
    console.log('New Conversation Relay websocket established');
    let OpenAIService = null;
    let silenceHandler = null;

    // Handle incoming messages
    ws.on('message', async (data) => {
        let gptResponse = "";
        let OpenAIService = null;

        try {
            const message = JSON.parse(data);
            // console.log(`[Conversation Relay] Message received: ${JSON.stringify(message, null, 4)}`);

            // Reset silence timer based on message type if handler exists
            if (silenceHandler) {
                silenceHandler.resetTimer(message.type);
            }

            switch (message.type) {
                case 'info':
                    // console.debug(`[Conversation Relay] INFO: ${JSON.stringify(message, null, 4)}`);
                    break;
                case 'prompt':
                    console.info(`[Conversation Relay:] PROMPT >>>>>>: ${message.voicePrompt}`);
                    OpenAIService.generateResponse('user', message.voicePrompt);
                    // event emitter established in "setup" will send the response back to the WebSocket client
                    break;
                case 'interrupt':
                    // Handle interrupt message
                    console.info(`[Conversation Relay] INTERRUPT ...... : ${message.utteranceUntilInterrupt}`);
                    break;
                case 'dtmf':
                    // Handle DTMF digits. We are just logging them out for now.
                    console.debug(`[Conversation Relay] DTMF: ${message.digit}`);
                    break;
                case 'setup':
                    /**
                     * Handle setup message. Just logging sessionId out for now.
                     * This is the object received from Twilio:
                     * {
                            "type": "setup",
                            "sessionId": "VXxxxx",
                            "callSid": "CAxxxx",
                            "parentCallSid": "",
                            "from": "+614nnnn",
                            "to": "+612nnnn",
                            "forwardedFrom": "+612nnnnn",
                            "callerName": "",
                            "direction": "inbound",
                            "callType": "PSTN",
                            "callStatus": "RINGING",
                            "accountSid": "ACxxxxxx",
                            "applicationSid": null
                        }
                     */
                    // console.debug(`[Conversation Relay] Setup message received: ${JSON.stringify(message, null, 4)}`);
                    // Log out the to and from phone numbers
                    console.log(`4) [Conversation Relay] SETUP. Call from: ${message.from} to: ${message.to} with call SID: ${message.callSid}`);

                    // Initialize OpenAIService
                    OpenAIService = await OpenAIService.initialize();
                    console.log('OpenAIService initialized');

                    // extract the "from" value and pass it to OpenAIService
                    OpenAIService.setCallParameters(message.to, message.from, message.callSid);

                    // Call the get-customer service via fetch
                    const getCustomerResponse = await fetch(`${TWILIO_FUNCTIONS_URL}/tools/get-customer`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ from: message.from }),    // Temp hack for alignment.
                    });

                    console.log(`[Conversation Relay] Get Customer Response: ${JSON.stringify(getCustomerResponse, null, 4)}`);

                    // Create a greeting message using the person's name
                    const customerData = await getCustomerResponse.json();
                    const customerName = customerData.firstName;

                    // console.log(`[Conversation Relay] Customer name: ${customerName}`);
                    const greetingText = `Greet the customer with name ${customerName} in a friendly manner. Do not constantly use their name, but drop it in occasionally. Tell them that you have to fist verify their details before you can proceed to ensure confidentiality of the conversation.`;

                    OpenAIService.generateResponse('system', greetingText);

                    // When receiving the emitted event send the response back to the WebSocket client
                    OpenAIService.on('llm.content', (data) => {
                        ws.send(JSON.stringify(data));
                    });

                    // Initialize and start silence monitoring after setup is complete
                    silenceHandler = new SilenceHandler(SILENCE_SECONDS_THRESHOLD, SILENCE_RETRY_THRESHOLD);
                    silenceHandler.startMonitoring((silenceMessage) => {
                        console.log(`[Conversation Relay] Sending silence breaker message: ${JSON.stringify(silenceMessage)}`);
                        ws.send(JSON.stringify(silenceMessage));
                    });
                    break;
                default:
                    console.log(`[Conversation Relay] Unknown message type: ${message.type}`);
            };
        } catch (error) {
            console.error('[Conversation Relay] Error in message handling:', error);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        // Clean up the silence handler if it exists
        if (silenceHandler) {
            silenceHandler.cleanup();
        }
        // Remove the event listener
        this.OpenAIService.removeAllListeners('llm.content');
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
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
