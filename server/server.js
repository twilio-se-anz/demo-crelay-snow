require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');

const app = express();
const PORT = process.env.PORT || 3000;
const SILENCE_SECONDS_THRESHOLD = 5; // The maximum time in seconds that the server will wait for user input from Twilio before sending a reminder message
const SILENCE_RETRY_THRESHOLD = 3; // The maximum number of times the server will request user input
// Extract all the .env variables here
const { TWILIO_FUNCTIONS_URL } = process.env;

// Initialize express-ws
ExpressWs(app);

// Import the services
const { GptService } = require('./services/GptService');
const { SilenceHandler } = require('./services/SilenceHandler');

// Function to fetch context and manifest
async function fetchContextAndManifest() {
    try {
        const context = await fetch(`${TWILIO_FUNCTIONS_URL}/context.md`);
        const promptContext = await context.text();
        const manifest = await fetch(`${TWILIO_FUNCTIONS_URL}/toolManifest.json`);
        const toolManifest = await manifest.json(); // Parse JSON response
        console.log(`[Server] Fetched context and manifest from ${TWILIO_FUNCTIONS_URL}`);
        return { promptContext, toolManifest };
    } catch (error) {
        console.error('Error fetching context or manifest:', error);
        throw error;
    }
}

// 
// WebSocket endpoint
//
app.ws('/conversation-relay', (ws) => {
    console.log('New Conversation Relay websocket established');
    let gptService = null;
    let silenceHandler = null;

    // Handle incoming messages
    ws.on('message', async (data) => {
        let gptResponse = "";
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
                    // OpenAI Model
                    console.info(`[Conversation Relay:] PROMPT >>>>>>: ${message.voicePrompt}`);
                    gptResponse = await gptService.generateResponse('user', message.voicePrompt);
                    console.info(`[Conversation Relay] JSON <<<<<<: ${JSON.stringify(gptResponse, null, 4)}`);
                    // Send the response back to the WebSocket client
                    ws.send(JSON.stringify(gptResponse));
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
                    
                    // Initialize GptService with context and manifest
                    const { promptContext, toolManifest } = await fetchContextAndManifest();
                    gptService = new GptService(promptContext, toolManifest);
                    console.log('GptService initialized with Context and Manifest');
                    
                    // extract the "from" value and pass it to gptService
                    gptService.setCallParameters(message.to, message.from, message.callSid);

                    // Call the get-customer service via fetch
                    const getCustomerResponse = await fetch(`${TWILIO_FUNCTIONS_URL}/tools/get-customer`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ from: message.from }),    // Temp hack for alignment.
                    });

                    // console.log(`[Conversation Relay] Get Customer Response: ${getCustomerResponse}`);

                    // Create a greeting message using the person's name
                    const customerData = await getCustomerResponse.json();
                    const customerName = customerData.firstName;

                    // console.log(`[Conversation Relay] Customer name: ${customerName}`);
                    const greetingText = `Greet the customer with name ${customerName} in a friendly manner. Do not constantly use their name, but drop it in occasionally. Tell them that you have to fist verify their details before you can proceed to ensure confidentiality of the conversation.`;
                    gptResponse = await gptService.generateResponse('system', greetingText);
                    console.info(`[Conversation Relay] SETUP <<<<<<: ${JSON.stringify(gptResponse, null, 4)}`);
                    // Send the response back to the WebSocket client
                    ws.send(JSON.stringify(gptResponse));

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
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
    } else {
        console.error('Failed to start server:', error);
    }
    process.exit(1);
});
