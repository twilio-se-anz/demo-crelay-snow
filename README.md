# Simple Conversation Relay

This is a reference implementation aimed at introducing the key concepts of Conversation Relay. The key here is to ensure it is a workable environment that can be used to understand the basic concepts of Conversation Relay. It is intentionally simple and only the minimum has been done to ensure the understanding is focussed on the core concepts.

## Release v4.3.1

This release adds complete CRelay method support by implementing the remaining Twilio WebSocket message types. The system now supports all official Twilio Conversation Relay WebSocket messages including `switch-language` for dynamic language switching and `play-media` for audio playback from URLs. These additions provide full coverage of Twilio's Conversation Relay capabilities with proper type safety and consistent tool patterns. See the [CHANGELOG.md](./CHANGELOG.md) for detailed release history.

## Prerequisites

- Node.js v18
- pnpm
- ngrok
- TypeScript

## Server

### Project Structure

```
.
├── server/                # WebSocket server for conversation relay
│   ├── .env.example      # Example environment configuration
│   ├── package.json      # Server dependencies and scripts
│   ├── tsconfig.json     # TypeScript configuration
│   ├── assets/           # Configuration assets
│   │   ├── defaultContext.md    # Default GPT conversation context
│   │   ├── defaultToolManifest.json # Default available tools configuration
│   │   ├── MyContext.md        # Specific context
│   │   └── MyToolManifest.json # Specific tools
│   ├── src/              # Source code directory
│   │   ├── server.ts     # Main server implementation
│   │   ├── interfaces/   # TypeScript interface definitions
│   │   │   ├── ResponseService.d.ts # ResponseService interface with DI handlers
│   │   │   └── ConversationRelay.d.ts # Conversation Relay interfaces with Twilio message types
│   │   ├── services/     # Core service implementations
│   │   │   ├── ConversationRelayService.ts # Implements DI pattern
│   │   │   ├── OpenAIResponseService.ts # Implements ResponseService interface with DI
│   │   │   ├── FlowiseResponseService.ts # Alternative ResponseService implementation
│   │   │   ├── SilenceHandler.ts
│   │   │   └── TwilioService.ts
│   │   ├── tools/        # Tool implementations
│   │   │   ├── end-call.ts
│   │   │   ├── live-agent-handoff.ts
│   │   │   ├── send-dtmf.ts
│   │   │   ├── send-sms.ts
│   │   │   ├── switch-language.ts
│   │   │   └── play-media.ts
│   │   └── utils/        # Utility functions
│   │       └── logger.ts
```

The server handles WebSocket connections and manages conversation relay functionality. It includes GPT service integration for natural language processing and Twilio integration for voice call handling.

### Running the Server

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

3. For development, start the development server:
```bash
# Using pnpm
pnpm dev

# Or using npm
npm run dev
```

For production, build and start the server:
```bash
# Using pnpm
pnpm build
pnpm start

# Or using npm
npm run build
npm start
```

4. Ensure the server is running on port 3001 (or configured port in `.env`).

5. Optionally, expose the server using ngrok:
```bash
ngrok http --domain server-yourdomain.ngrok.dev 3001
```

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

Configure your Conversation Relay parameters in server/src/services/TwilioService.ts:

```typescript
// Generate the Twiml we will need once the call is connected
const response = new twilio.twiml.VoiceResponse();
const connect = response.connect();
const conversationRelay = connect.conversationRelay({
      url: `wss://${serverBaseUrl}/conversation-relay`,
      transcriptionProvider: "deepgram",
      speechModel: "nova-3-general",
      interruptible: "any",
      ttsProvider: "Elevenlabs",
      voice: "Charlie-flash_v2_5",
      dtmfDetection: true,
} as any);

conversationRelay.parameter({
      name: 'callReference',
      value: callReference
});
```

### WebSocket Connection Flow

1. When a call is received, Twilio initiates a WebSocket connection to `wss://server-yourdomain.ngrok.dev/conversation-relay`
2. The server receives a 'setup' message containing call details and custom parameters
3. The server creates service instances and begins processing incoming messages
4. Each WebSocket connection maintains its own isolated session in a wsSessionsMap

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

Located in `server/assets/toolManifest.json`, this file defines the tools available to the OpenAI service. Available tools:

1. `end-call` - Gracefully terminates the current call
2. `live-agent-handoff` - Transfers the call to a human agent
3. `send-dtmf` - Sends DTMF tones during the call
4. `send-sms` - Sends SMS messages during the call
5. `switch-language` - Changes TTS and/or transcription languages
6. `play-media` - Plays audio media from URLs

### Dynamic Context System

The system supports dynamic context loading through environment variables:

- `defaultContext.md` and `defaultToolManifest.json` - Used when no specific context is configured
- `MyContext.md` and `MyToolManifest.json` - Specialized context and tools for specific use cases

To use a specific context:
1. Add the context and tool manifest files to the `server/assets` directory
2. Configure the environment variables in your `.env` file:
   ```bash
   LLM_CONTEXT=YourContext.md
   LLM_MANIFEST=YourToolManifest.json
   ```

## Environment Configuration

Create a `.env` file in the server directory with the following variables:

```bash
PORT=3001                                    # Server port number
SERVER_BASE_URL=your_server_url              # Base URL for your server (e.g., ngrok URL)
OPENAI_API_KEY=your_openai_api_key          # OpenAI API key for GPT integration
OPENAI_MODEL=gpt-4-1106-preview             # OpenAI model to use for conversations

# Dynamic Context Configuration
LLM_CONTEXT=MyContext.md                   # Specify which context file to use (defaults to defaultContext.md)
LLM_MANIFEST=MyToolManifest.json      # Specify which tool manifest to use (defaults to defaultToolManifest.json)
```

## Fly.io Deployment

To deploy the server to Fly.io:

1. Navigate to the server directory:
```bash
cd server
```

2. For new deployments, use the `--no-deploy` option:
```bash
fly launch --no-deploy
```

3. Ensure your `fly.toml` file has the correct port configuration:
```toml
[http]
  internal_port = 3001
```

4. Add the volume mount configuration:
```toml
[mounts]
  source = "assets"
  destination = "/assets"
```

5. Import your environment variables as secrets:
```bash
fly secrets import < .env
```

6. Deploy your application:
```bash
fly deploy
```

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

1. `end-call` - Gracefully terminates the current call
2. `live-agent-handoff` - Transfers the call to a human agent  
3. `send-dtmf` - Sends DTMF tones during the call
4. `send-sms` - Sends SMS messages during the call
5. `switch-language` - Changes TTS and/or transcription languages
6. `play-media` - Plays audio media from URLs

## Outbound Calling

The system supports initiating outbound calls via an API endpoint:

```
POST /outboundCall
```

### Request Format

```typescript
interface RequestData {
  properties: {
    phoneNumber: string;      // [REQUIRED] Destination phone number in E.164 format
    callReference: string;    // [OPTIONAL] Unique reference to associate with the call
    firstname?: string;       // [OPTIONAL] Additional parameter data
    lastname?: string;        // [OPTIONAL] Additional parameter data
    [key: string]: any;       // Other optional parameters
  }
}
```

### Example Usage

```bash
curl -X POST \
  'https://server-yourdomain.ngrok.dev/outboundCall' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "properties": {
      "phoneNumber": "+1234567890",
      "callReference": "abc123",
      "firstname": "Bob",
      "lastname": "Jones"
    }
  }'
```

---

# Architecture

## Service Architecture

The server uses dependency inversion for multi LLM operators and a clean dependency injection architecture with handler interfaces for service communication.

### Server Services

The server is organized into modular services:

1. **ConversationRelayService** - Manages the core conversation flow and WebSocket communication
2. **OpenAIResponseService** - Implements the ResponseService interface for OpenAI integration
3. **SilenceHandler** - Manages silence detection and response with configurable thresholds
4. **TwilioService** - Manages Twilio-specific functionality and call control operations

### Handler Interfaces

**ResponseHandler** - Handles LLM service responses:
```typescript
export interface ResponseHandler {
    content(response: ContentResponse): void;
    toolResult(toolResult: ToolResultEvent): void;
    error(error: Error): void;
    callSid(callSid: string, responseMessage: any): void;
}
```

**ConversationRelayHandler** - Handles conversation relay events:
```typescript
export interface ConversationRelayHandler {
    outgoingMessage(message: OutgoingMessage): void;
    callSid(callSid: string, responseMessage: any): void;
    silence(message: OutgoingMessage): void;
}
```

### Service Setup

Services use unified handler creation methods:

```typescript
// Create service instances
const responseService = await OpenAIResponseService.create(contextFile, toolManifest);
const conversationRelay = new ConversationRelayService(responseService, sessionData);

// Set up response handler
const responseHandler = {
    content: (response) => { /* handle content */ },
    toolResult: (toolResult) => { /* handle tool results */ },
    error: (error) => { /* handle errors */ },
    callSid: (callSid, responseMessage) => { /* handle call events */ }
};
responseService.createResponseHandler(responseHandler);

// Set up conversation relay handler
const conversationRelayHandler = {
    outgoingMessage: (message) => ws.send(JSON.stringify(message)),
    callSid: (callSid, responseMessage) => { /* handle call events */ },
    silence: (silenceMessage) => ws.send(JSON.stringify(silenceMessage))
};
conversationRelay.createConversationRelayHandler(conversationRelayHandler);
```

### Handler Implementation

Services communicate through unified handler interfaces:

```typescript
// ResponseService using unified handler
this.responseHandler.content(response);
this.responseHandler.toolResult(toolResult);
this.responseHandler.error(error);
```

### Architecture Benefits

#### 🚀 Performance
- **Direct Function Calls**: Fast, direct handler invocation with minimal overhead
- **Optimized Memory Usage**: Lightweight handler objects
- **Low Latency**: Immediate function calls for responsive service communication

#### 🛡️ Type Safety & Developer Experience
- **Compile-Time Validation**: TypeScript enforces correct handler signatures
- **IntelliSense Support**: Full IDE autocompletion and documentation
- **Strong Type Contracts**: Clear, enforceable contracts between services

#### 🧪 Testing & Maintainability
- **Easy Mocking**: Simple function mocking for unit tests
- **Clear Dependencies**: Explicit handler dependencies make service relationships transparent
- **Better Debugging**: Direct call stacks make debugging straightforward

#### 🏗️ Clean Architecture
- **Single Responsibility**: Each handler focuses on one specific communication channel
- **Interface Segregation**: Services only implement handlers they actually need
- **Dependency Inversion**: Services depend on handler abstractions, not concrete implementations

### TypeScript Interface Enforcement

The system includes comprehensive TypeScript interfaces for all Twilio WebSocket message types:

#### Outgoing Message Types
- **`TextTokensMessage`**: For sending text to be converted to speech
- **`PlayMediaMessage`**: For playing audio from URLs
- **`SendDigitsMessage`**: For sending DTMF digits
- **`SwitchLanguageMessage`**: For changing TTS and transcription languages
- **`EndSessionMessage`**: For terminating conversation sessions

These are unified under the `OutgoingMessage` union type, ensuring compile-time validation:

```typescript
const textMessage: TextTokensMessage = {
    type: 'text',
    token: 'Hello, how can I help you?',
    last: true,
    interruptible: true
};

await conversationRelaySession.outgoingMessage(textMessage);
```

### Tool Type-Driven Architecture

The system implements a pure tool type-driven architecture using OutgoingMessage types for routing:

#### Tool Categories

1. **Generic LLM Tools** - Standard tools processed by OpenAI (e.g., `send-sms`)
2. **CRelay Tools with Immediate Delivery** - WebSocket tools sent immediately (e.g., `send-dtmf`)  
3. **CRelay Tools with Delayed Delivery** - Terminal tools sent after OpenAI response (e.g., `end-call`, `live-agent-handoff`)

#### Tool Response Patterns

**Generic LLM Tool (send-sms.ts):**
```typescript
export default async function (functionArguments: SendSMSFunctionArguments): Promise<SendSMSResponse> {
    // Tool logic here
    const result = await twilioService.sendSMS(args.to, args.message);
    
    // Return simple response for OpenAI to process
    return {
        success: true,
        message: `SMS sent successfully`,
        recipient: args.to
    };
}
```

**CRelay Tool with Immediate Delivery (send-dtmf.ts):**
```typescript
import { SendDigitsMessage } from '../interfaces/ConversationRelay.js';

export default function (functionArguments: SendDTMFFunctionArguments): SendDTMFResponse {
    return {
        success: true,
        message: `DTMF digits sent successfully`,
        digits: functionArguments.dtmfDigit,
        outgoingMessage: {
            type: "sendDigits",
            digits: functionArguments.dtmfDigit
        } as SendDigitsMessage
    };
}
```

**CRelay Tool with Delayed Delivery (end-call.ts):**
```typescript
import { EndSessionMessage } from '../interfaces/ConversationRelay.js';

export default function (functionArguments: EndCallFunctionArguments): EndCallResponse {
    return {
        success: true,
        message: `Call ended successfully`,
        summary: functionArguments.summary,
        outgoingMessage: {
            type: "end",
            handoffData: JSON.stringify({
                reasonCode: "end-call",
                reason: "Ending the call",
                conversationSummary: functionArguments.summary
            })
        } as EndSessionMessage
    };
}
```

#### Type-Driven Routing

ConversationRelayService routes based on `outgoingMessage.type`:
- **`sendDigits`, `play`, `language`** - Immediate WebSocket delivery
- **`end`** - Stored and sent after OpenAI response completion
- **`text`** or no outgoingMessage - Standard OpenAI processing

### Interrupt Handling

The ResponseService supports interrupting ongoing AI responses using a boolean flag approach for simplicity:

```typescript
interrupt(): void {
    this.isInterrupted = true;
}

private async processStream(stream: any): Promise<void> {
    for await (const event of stream) {
        if (this.isInterrupted) {
            break;  // Exit when interrupted
        }
        // Process events...
    }
}
```

