# Simple Conversation Relay

A WebSocket-based conversation relay system that integrates with Twilio for voice calls and OpenAI for natural language processing. The system provides real-time communication handling, silence detection, and automated conversation management.

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
