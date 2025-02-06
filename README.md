# Simple Conversation Relay

This is a reference implementation aimed at introducing the key concepts of Conversation Relay. The key here is to ensure it is a workable environment that can be used to understand the basic concepts of Conversation Relay. IT is intentionally simple and only the minimum has been done to ensure the understanding is focussed on the core concepts. As an overview here is how the project is put together:

1. There is a main Server that has two functions:
   - It is a WebSocket server - The Websocket server maintains a connection and relays messages between the two parties. It is the core of the conversation relay system.
   - It is a API endpoint - The endpoints are used to execute code for various components, such as connecting Conversation Relay for example.
2. There is a Services collection that ensures we isolate the functionality of Conversation Relay, OpenAI and Twilio for example. The intention is to ensure we have no knowledge "bleed" between the different components.
   **_Conversation Relay_** - This is the core of the conversation relay system. The key part is understanding the different message types, specifically "setup" and "prompt". Event handling is key, since only this service can understand when to send which messages back to the websocket and back to Twilio. An example is "sendDigits" where this service will only emit the event when it directly needs to send this back via the websocket, otherwise it lets the LLM handle it.

   **_OpenAI Service_** - This service is used to interact with the OpenAI API. It is a typical LLM implementation where it sends a prompt and receives a response, along with tools to manage the conversation flow. Some of the tools are query style like send-sms, while others are Conversation Relay specific like send-dtmf, where websocket messages also have to be sent directly. This implementation illustrates both types. A third type not explored would be queries to external websites or APIs, but it would function in a similar way to send-sms in that there are no Conversation Relay specific messages to send back.

   **_Silence Handler_** - This is a utility method to break deadlocks. It is a simple implementation that sends a message after a certain amount of time, and if there is no response after a certain number of messages, it will end the call. This is a simple implementation and can be expanded to include more complex logic.

   **_Twilio Service_** - This service is used to interact with the Twilio API. It abstracts the Twilio API and can be built on to add any Twilio related services, including Conversation Relay itself via the "connectConversationRelay" endpoint. This is where Conversation Relay is configured using the NodeJS helper library. Note, you need at least twilio 5.4.3 library to do so. This is done instead of the usual Twiml config.

   **_Tools_** - The Tools section contains tool definitions that are used by the OpenAI service. The tools are loaded dynamically based on the toolManifest.json file, so ensure these are aligned. This is a simple implementation and can be expanded to include more complex tools and as mentioned there are Conversation Relay specific tools like send-dtmf and generic tools like send-sms included.

## Quick Tip
Configure your Conversation Relay parameters in server/services/twilioService.js

```javascript
      // Generate the Twiml we will need once the call is connected. Note, this could be done in two steps via the server, were we set a url: instead of twiml:, but this just seemed overly complicated.
      const response = new twilio.twiml.VoiceResponse();
      const connect = response.connect();
      const conversationRelay = connect.conversationRelay({
            url: `wss://${serverBaseUrl}/conversation-relay`,
            transcriptionProvider: "deepgram",
            voice: "en-AU-Journey-D",
            ttsProvider: "Elevenlabs",
            voice: "Jessica-flash_v2_5",
            dtmfDetection: "true",
            interruptByDtmf: "true",
      });

      conversationRelay.parameter({
            name: 'customerReference',
            value: customerReference
      });
```

## Prerequisites

- Node.js v18
- pnpm
- ngrok

## Project Structure

```
.
├── server/                # WebSocket server for conversation relay
│   ├── .env.example      # Example environment configuration
│   ├── package.json      # Server dependencies and scripts
│   ├── server.js         # Main server implementation
│   ├── assets/           # Configuration assets
│   │   ├── context.md    # GPT conversation context
│   │   └── toolManifest.json # Available tools configuration
│   ├── services/         # Core service implementations
│   │   ├── ConversationRelayService.js
│   │   ├── OpenAIService.js
│   │   ├── SilenceHandler.js
│   │   └── twilioService.js
│   ├── tools/           # Tool implementations
│   │   ├── end-call.js
│   │   ├── live-agent-handoff.js
│   │   ├── send-dtmf.js
│   │   └── send-sms.js
│   └── utils/           # Utility functions
│       └── logger.js
```

## Server Component

The server handles WebSocket connections and manages conversation relay functionality. It includes GPT service integration for natural language processing and Twilio integration for voice call handling.

### Running the Server

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm dev
```

4. Expose the server using ngrok:
```bash
ngrok http --domain server-yourdomain.ngrok.dev 3001
```

## Silence Handling

The system includes a robust silence detection mechanism to manage periods of inactivity during conversations. This functionality is implemented in the `SilenceHandler` class and operates based on two key thresholds:

- `SILENCE_SECONDS_THRESHOLD` (5 seconds): The duration of silence before triggering a reminder
- `SILENCE_RETRY_THRESHOLD` (3 attempts): Maximum number of reminders before ending the call

### How It Works

1. **Initialization**: Silence monitoring starts after the initial setup message, ensuring the system is ready for conversation.

2. **Message Tracking**:
   - The system tracks the time since the last meaningful message
   - Info-type messages are intentionally ignored to prevent false resets
   - Valid messages (prompt, interrupt, dtmf) reset both the timer and retry counter

3. **Response Sequence**:
   - After 5 seconds of silence: Sends a reminder message ("I'm sorry, I didn't catch that...")
   - Each reminder increments a retry counter
   - After 3 unsuccessful attempts: Ends the call with an "unresponsive" reason code

4. **Cleanup**: The system properly cleans up monitoring resources when the call ends or disconnects.

### Implementation Details

The silence handling is modular and follows separation of concerns:
- `SilenceHandler` class manages the logic independently
- Messages are passed back to the server via callbacks
- The server maintains control of WebSocket communication
- Thresholds are configurable through constants in server.js

This design ensures reliable conversation flow while preventing indefinite silence periods, improving the overall user experience.


## Twilio Configuration

### Twilio Phone Number Configuration

1. Configure your Twilio phone number to point to the "connectConversationRelay" endpoint:
   - Go to your Twilio Console > Phone Numbers > Active Numbers
   - Select your phone number
   - Under "Voice & Fax" > "A Call Comes In"
   - Set it to "Webhook" and enter:
     ```
     https://server-yourdomain.ngrok.dev/connectConversationRelay
     ```
   - Method: HTTP POST

This endpoint will handle incoming calls and establish the WebSocket connection for conversation relay.

### WebSocket Connection Flow

1. When a call is received, Twilio initiates a WebSocket connection to `wss://server-yourdomain.ngrok.dev/conversation-relay`
2. The server receives a 'setup' message containing call details:
   - Caller's phone number (`from`)
   - Called number (`to`)
   - Call SID
   - Other call metadata

3. The server then:
   - Stores the call parameters for the session
   - Initializes the ConversationRelayService with:
     - OpenAI service for natural language processing
     - Silence handler for managing inactivity
   - Sets up event listeners for WebSocket communication
   - Begins processing incoming messages

### Important Note on WebSocket Implementation

⚠️ **Warning**: When implementing async/await with WebSocket connections, be careful about where you place your await statements. Do not use await in the main WebSocket connection handler (app.ws part). Instead, ensure all async operations are handled within the message event handler (ws.on("message")). This is crucial because:

1. WebSocket connections are synchronous by nature
2. Using await in the main connection handler could cause you to miss messages
3. Example of correct implementation:

```javascript
// INCORRECT - Don't do this
app.ws('/conversation-relay', async (ws, req) => {
    await someAsyncOperation(); // This could cause missed messages
    ws.on('message', (msg) => {
        // Handle message
    });
});

// CORRECT - Do this instead
app.ws('/conversation-relay', (ws, req) => {
    ws.on('message', async (msg) => {
        await someAsyncOperation(); // Safe to use await here
        // Handle message
    });
});
```

## GPT Context Configuration

The server uses two key files to configure the GPT conversation context:

### context.md

Located in `server/assets/context.md`, this file defines:
- The AI assistant's persona
- Conversation style guidelines
- Response formatting rules
- Authentication process steps
- Customer validation requirements

Key sections to configure:
1. Objective - Define the AI's role and primary tasks
2. Style Guardrails - Set conversation tone and behavior rules
3. Response Guidelines - Specify formatting and delivery rules
4. Instructions - Detail specific process steps

### toolManifest.json

Located in `server/assets/toolManifest.json`, this file defines the tools available to the OpenAI service. The service implements a dynamic tool loading system where tools are loaded based on their names in the manifest. Each tool's filename in the `/tools` directory must exactly match its name in the manifest.

Available tools:

1. `end-call`
   - Gracefully terminates the current call
   - Used for normal call completion or error scenarios

2. `live-agent-handoff`
   - Transfers the call to a human agent
   - Required parameter: `callSid`

3. `send-dtmf`
   - Sends DTMF tones during the call
   - Useful for automated menu navigation

4. `send-sms`
   - Sends SMS messages during the call
   - Used for verification codes or follow-up information

The OpenAI service loads these tools during initialization and makes them available for use in conversations through OpenAI's function calling feature.

## Environment Configuration

### Server Environment Variables (server/.env)

Create a `.env` file in the server directory with the following variables:

```bash
PORT=3001                                    # Server port number
SERVER_BASE_URL=your_server_url              # Base URL for your server (e.g., ngrok URL)
OPENAI_API_KEY=your_openai_api_key          # OpenAI API key for GPT integration
OPENAI_MODEL=gpt-4-1106-preview             # OpenAI model to use for conversations
```

These variables are used by the server for:
- Configuring the server port
- Setting the server's base URL for Twilio integration
- Authenticating with OpenAI's API
- Specifying the OpenAI model for conversations

## Dependencies

## Outbound Calling

The system supports initiating outbound calls via an API endpoint. This allows external systems to trigger calls that connect to the Conversation Relay service.

### API Endpoint

```
POST /outboundCall
```

#### Request Format

```json
{
  "properties": {
    "phoneNumber": "+1234567890",      // [REQUIRED] Destination phone number in E.164 format
    "customerReference": "abc123",      // [OPTIONAL] Unique reference to associate with the call
    "firstname": "Bob",                 // [OPTIONAL] Additional customer data
    "lastname": "Jones"                 // [OPTIONAL] Additional customer data
  }
}
```

#### Example Usage

```bash
curl -X POST \
  'https://server-yourdomain.ngrok.dev/outboundCall' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "properties": {
      "phoneNumber": "+1234567890",
      "customerReference": "abc123",
      "firstname": "Bob",
      "lastname": "Jones"
    }
  }'
```

### Data Flow and Customer Reference

The system uses a customer reference mechanism to maintain context throughout the call lifecycle:

1. **Initial Storage**: When the outbound call endpoint is hit, all provided data is stored in a `customerDataMap` using the customerReference as the key:
   ```javascript
   customerDataMap.set(requestData.customerReference, { requestData });
   ```

2. **Conversation Relay Parameter**: The customerReference is passed to the Conversation Relay service as a parameter:
   ```javascript
   conversationRelay.parameter({
     name: 'customerReference',
     value: customerReference
   });
   ```

3. **WebSocket Session**: When the Conversation Relay establishes the WebSocket connection:
   - The initial setup message contains the customerReference in customParameters
   - The server retrieves the stored data using this reference
   - The data is attached to the session for use throughout the call

This mechanism allows you to:
- Pass arbitrary data to the call session without size limitations in the Conversation Relay parameters
- Access the full customer context throughout the call lifecycle
- Maintain session-specific data storage

### Implementation Details

1. The endpoint stores the provided customer data in a session map using the customerReference as the key
2. Initiates an outbound call via Twilio using the provided phone number
3. Connects the call to the Conversation Relay service once established
4. The customerReference is passed as a parameter to the Conversation Relay, allowing access to the stored customer data during the call

### Response

Success:
```json
{
  "success": true,
  "response": "CA1234..." // Twilio Call SID
}
```

Error:
```json
{
  "success": false,
  "error": "Error message"
}
```

### Server Dependencies
- express - Web application framework
- express-ws - WebSocket support for Express
- openai - OpenAI API client for GPT integration
- dotenv - Environment configuration
- winston - Logging framework
- uuid - Unique identifier generation

### Server Tools

The server includes several built-in tools for call management:

1. `end-call`
   - Gracefully terminates the current call
   - Used for normal call completion or error scenarios

2. `live-agent-handoff`
   - Transfers the call to a human agent
   - Handles escalation scenarios

3. `send-dtmf`
   - Sends DTMF tones during the call
   - Useful for automated menu navigation

4. `send-sms`
   - Sends SMS messages during the call
   - Used for verification codes or follow-up information

### Server Services

The server is organized into modular services:

1. `ConversationRelayService`
   - Manages the core conversation flow
   - Handles WebSocket communication
   - Coordinates between different services

2. `OpenAIService`
   - Manages GPT integration
   - Handles prompt construction and response processing
   - Implements retry logic and error handling

3. `SilenceHandler`
   - Manages silence detection and response
   - Implements configurable thresholds
   - Handles conversation flow control

4. `twilioService`
   - Manages Twilio-specific functionality
   - Handles call control operations
   - Implements SMS and DTMF features
