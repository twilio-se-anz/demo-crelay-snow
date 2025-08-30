# ITSM ServiceNow Bot using Twilio Conversation Relay

This is an ITSM (IT Service Management) bot implementation that integrates ServiceNow with Twilio's Conversation Relay API to provide automated customer support through voice calls. The bot can authenticate customers, manage ServiceNow tickets, and provide real-time assistance for IT support issues.

## Key Features

- **ServiceNow Integration**: Full CRUD operations for incident tickets
- **Customer Authentication**: OTP-based verification system  
- **Voice-Driven Support**: Natural conversation interface using AI
- **Real-time Ticket Management**: Create, update, and query tickets during calls
- **Security First**: Mandatory verification before sensitive operations
- **Dependency Injection Architecture**: Clean, modular service design with handler interfaces

## ServiceNow Tools

The bot includes comprehensive ServiceNow integration tools for incident management:

### 1. `lookup-customer`
- **Purpose**: Identifies customers and retrieves their ServiceNow profile
- **Functionality**: 
  - Searches for users by phone number
  - Returns customer details (name, email, sys_id)
  - Lists open tickets for the customer
- **Usage**: Automatically called at the start of conversations for customer identification

### 2. `create-servicenow-ticket`
- **Purpose**: Creates new incident tickets in ServiceNow
- **Requirements**: 
  - Customer sys_id (obtained from lookup-customer)
  - Mandatory verification before creation
- **Features**:
  - Full incident field support (priority, urgency, category)
  - Parent-child ticket relationships
  - Work notes and detailed descriptions
  - Automatic caller assignment

### 3. `get-servicenow-ticket`
- **Purpose**: Retrieves detailed information about existing tickets
- **Functionality**:
  - Fetches ticket status, priority, and assignment details
  - Provides complete ticket history
  - Shows resolution information
- **Usage**: Query ticket status by ticket number

### 4. `update-servicenow-ticket`
- **Purpose**: Updates existing incident tickets
- **Features**:
  - State transitions (New, In Progress, Resolved, Closed)
  - Priority and urgency adjustments
  - Work notes documentation
  - Resolution with close codes
  - Assignment to users/groups
- **Close Codes**: 
  - Duplicate
  - Known error
  - No resolution provided
  - Resolved by caller
  - Resolved by change
  - Resolved by problem
  - Resolved by request
  - Solution provided
  - Workaround provided
  - User error

## Verification Tools

The system implements a robust OTP-based verification system for security:

### 1. `send-verification`
- **Purpose**: Sends one-time passwords for customer authentication
- **Channels**:
  - SMS verification
  - Voice call verification
- **Features**:
  - 6-digit OTP generation
  - Configurable delivery channel
  - E.164 phone number format support

### 2. `check-verification`
- **Purpose**: Validates OTP codes entered by customers
- **Security**:
  - Time-limited codes
  - Single-use validation
  - Automatic retry handling
- **Integration**: Required before any ServiceNow write operations

## Prerequisites

- Node.js v18
- pnpm
- ngrok
- TypeScript
- ServiceNow instance with REST API access
- Twilio account with:
  - Phone number
  - Verify service (for OTP)
  - Conversation Relay enabled

## Project Structure

```
.
├── server/                # WebSocket server for conversation relay
│   ├── .env.example      # Example environment configuration
│   ├── package.json      # Server dependencies and scripts
│   ├── tsconfig.json     # TypeScript configuration
│   ├── assets/           # Configuration assets
│   │   ├── defaultContext.md    # Default GPT conversation context
│   │   ├── defaultToolManifest.json # Default available tools configuration
│   │   ├── Data3Context.md        # ITSM ServiceNow context
│   │   └── Data3ToolManifest.json # ServiceNow tools manifest
│   ├── src/              # Source code directory
│   │   ├── server.ts     # Main server implementation
│   │   ├── interfaces/   # TypeScript interface definitions
│   │   │   ├── ResponseService.d.ts # ResponseService interface with DI handlers
│   │   │   └── ConversationRelay.d.ts # Conversation Relay interfaces with Twilio message types
│   │   ├── services/     # Core service implementations
│   │   │   ├── ConversationRelayService.ts # Implements DI pattern
│   │   │   ├── OpenAIResponseService.ts # Implements ResponseService interface with DI
│   │   │   ├── SilenceHandler.ts
│   │   │   └── TwilioService.ts
│   │   ├── tools/        # Tool implementations
│   │   │   ├── end-call.ts
│   │   │   ├── live-agent-handoff.ts
│   │   │   ├── send-dtmf.ts
│   │   │   ├── send-sms.ts
│   │   │   ├── lookup-customer.ts
│   │   │   ├── create-servicenow-ticket.ts
│   │   │   ├── get-servicenow-ticket.ts
│   │   │   ├── update-servicenow-ticket.ts
│   │   │   ├── send-verification.ts
│   │   │   └── check-verification.ts
│   │   └── utils/        # Utility functions
│   │       └── logger.ts
```

## Architecture

### Dependency Injection Design

The system uses a clean dependency injection architecture with handler interfaces for service communication, following the principles outlined in the contribution guidelines:

#### Handler Interfaces

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

#### Service Architecture

**Key Services:**

1. **ConversationRelayService** - Manages the core conversation flow and WebSocket communication
2. **OpenAIResponseService** - Implements the ResponseService interface for OpenAI integration
3. **SilenceHandler** - Manages silence detection and response with configurable thresholds
4. **TwilioService** - Manages Twilio-specific functionality and call control operations

**Service Setup Pattern:**
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

#### Architecture Benefits

🚀 **Performance**
- **Direct Function Calls**: Fast, direct handler invocation with minimal overhead
- **Optimized Memory Usage**: Lightweight handler objects
- **Low Latency**: Immediate function calls for responsive service communication

🛡️ **Type Safety & Developer Experience**
- **Compile-Time Validation**: TypeScript enforces correct handler signatures
- **IntelliSense Support**: Full IDE autocompletion and documentation
- **Strong Type Contracts**: Clear, enforceable contracts between services

🧪 **Testing & Maintainability**
- **Easy Mocking**: Simple function mocking for unit tests
- **Clear Dependencies**: Explicit handler dependencies make service relationships transparent
- **Better Debugging**: Direct call stacks make debugging straightforward

🏗️ **Clean Architecture**
- **Single Responsibility**: Each handler focuses on one specific communication channel
- **Interface Segregation**: Services only implement handlers they actually need
- **Dependency Inversion**: Services depend on handler abstractions, not concrete implementations

## Server Component

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

## Silence Handling

The system includes a robust silence detection mechanism to manage periods of inactivity during conversations. This functionality is implemented in the `SilenceHandler` class and operates based on two key thresholds:

- `SILENCE_SECONDS_THRESHOLD` (5 seconds): The duration of silence before triggering a reminder
- `SILENCE_RETRY_THRESHOLD` (3 attempts): Maximum number of reminders before ending the call

The silence handling is modular and follows separation of concerns:
- `SilenceHandler` class manages the logic independently
- Messages are passed back to the server via callbacks
- The server maintains control of WebSocket communication
- Thresholds are configurable through constants in server.ts

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

### WebSocket Connection Flow

1. When a call is received, Twilio initiates a WebSocket connection to `wss://server-yourdomain.ngrok.dev/conversation-relay`
2. The server receives a 'setup' message containing call details and custom parameters
3. The server creates service instances and begins processing incoming messages
4. Each WebSocket connection maintains its own isolated session in a wsSessionsMap

⚠️ **Important WebSocket Implementation Note**: When implementing async/await with WebSocket connections, be careful about where you place your await statements. Do not use await in the main WebSocket connection handler (app.ws part). Instead, ensure all async operations are handled within the message event handler (ws.on("message")).

## GPT Context Configuration

The server uses two key files to configure the GPT conversation context:

### context.md

Located in `server/assets/Data3Context.md`, this file defines:
- The AI assistant's persona as an ITSM support agent
- Conversation style guidelines for technical support
- Response formatting rules for ServiceNow interactions
- Authentication process steps for verification
- Customer validation requirements for ticket operations

Key sections to configure:
1. Objective - Define the AI's role as ITSM support agent
2. Style Guardrails - Set professional support tone and behavior rules
3. Response Guidelines - Specify formatting for ticket information
4. Instructions - Detail ServiceNow process steps and verification requirements

### toolManifest.json

Located in `server/assets/Data3ToolManifest.json`, this file defines the tools available to the OpenAI service, specifically configured for ITSM operations:

**Core ServiceNow Tools:**
1. `lookup-customer` - Customer identification and profile retrieval
2. `create-servicenow-ticket` - New incident ticket creation
3. `get-servicenow-ticket` - Ticket information retrieval
4. `update-servicenow-ticket` - Ticket updates and state changes

**Verification Tools:**
1. `send-verification` - OTP delivery via SMS or voice
2. `check-verification` - OTP validation

**Call Management Tools:**
1. `end-call` - Graceful call termination
2. `live-agent-handoff` - Human agent escalation
3. `send-dtmf` - DTMF tone transmission
4. `send-sms` - SMS messaging

### Dynamic Context System

The system supports dynamic context loading through environment variables:

- `Data3Context.md` and `Data3ToolManifest.json` - ITSM-specific context and tools
- `defaultContext.md` and `defaultToolManifest.json` - Fallback configurations

To use specific contexts:
1. Configure environment variables in your `.env` file:
   ```bash
   LLM_CONTEXT=Data3Context.md
   LLM_MANIFEST=Data3ToolManifest.json
   ```

## Environment Configuration

Create a `.env` file in the server directory with the following variables:

```bash
# Server Configuration
PORT=3001                                    # Server port number
SERVER_BASE_URL=your_server_url              # Base URL for your server (e.g., ngrok URL)

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key          # OpenAI API key for GPT integration
OPENAI_MODEL=gpt-4o                         # OpenAI model to use for conversations

# ServiceNow Configuration
SERVICENOW_INSTANCE=your_instance           # ServiceNow instance name or full URL
SERVICENOW_USERNAME=your_username           # ServiceNow API username
SERVICENOW_PASSWORD=your_password           # ServiceNow API password

# Twilio Configuration (for verification)
TWILIO_ACCOUNT_SID=your_account_sid         # Twilio account SID
TWILIO_AUTH_TOKEN=your_auth_token           # Twilio auth token
TWILIO_VERIFY_SERVICE_SID=your_verify_sid   # Twilio Verify service SID
TWILIO_FROM_NUMBER=your_phone_number        # Twilio phone number for SMS

# Dynamic Context Configuration
LLM_CONTEXT=Data3Context.md                 # Context file for ITSM operations
LLM_MANIFEST=Data3ToolManifest.json         # Tool manifest with ServiceNow tools
```

## Quick Start

1. **Clone the repository**:
```bash
git clone https://github.com/twilio-se-anz/demo-crelay-snow.git
cd demo-crelay-snow
```

2. **Install dependencies**:
```bash
cd server
pnpm install
```

3. **Configure environment**:
- Copy `.env.example` to `.env`
- Add your ServiceNow, OpenAI, and Twilio credentials

4. **Start the development server**:
```bash
pnpm dev
```

5. **Expose via ngrok**:
```bash
ngrok http --domain your-domain.ngrok.dev 3001
```

6. **Configure Twilio webhook**:
- Set your phone number webhook to: `https://your-domain.ngrok.dev/connectConversationRelay`

## Security Architecture

The bot implements multiple security layers:

### 1. **Mandatory Verification**
- All ServiceNow write operations require prior OTP verification
- Verification status is tracked per session
- Cannot be bypassed through conversation

### 2. **Secure Credential Management**
- ServiceNow credentials stored as environment variables
- Basic authentication with Base64 encoding
- No credentials exposed in logs

### 3. **Session Isolation**
- Each call maintains its own session state
- No cross-contamination between concurrent calls
- Automatic cleanup on disconnect

### 4. **Data Flow Security**
- Customer sys_id required for ticket creation (no arbitrary caller assignment)
- Verification state validated before sensitive operations
- Comprehensive error handling and logging

## ServiceNow Configuration

### Required ServiceNow Setup

1. **API Access**:
   - Enable REST API access for the incident table
   - Create a service account with appropriate roles:
     - `itil` role for incident management
     - `rest_api_explorer` for API access

2. **Custom Fields** (if applicable):
   - Ensure `close_code` field is configured
   - Set up resolution code choices

3. **Data Policies**:
   - Configure mandatory fields for state transitions
   - Set up resolution requirements for closed/resolved states

### Testing ServiceNow Integration

Test scripts are provided in the server directory:

```bash
# Test customer lookup
node test-customer-lookup.js

# Test ServiceNow connection
node test-servicenow.js
```

## Tool Architecture

### Tool Response Types

The system implements a sophisticated tool handling mechanism that categorizes tool responses by type:

1. **tool** - Standard tools that return results to be consumed by the LLM
2. **crelay** - Conversation Relay specific tools that bypass LLM processing
3. **error** - Error handling responses that provide graceful error handling
4. **llm** - LLM controller responses (reserved for future expansion)

### ServiceNow Tool Pattern

ServiceNow tools follow a consistent pattern for API integration:

```typescript
export default async function (functionArguments: ServiceNowToolArguments): Promise<ServiceNowToolResponse> {
    const serviceNowService = new ServiceNowService();
    
    try {
        const result = await serviceNowService.performOperation(functionArguments);
        return {
            success: true,
            message: "Operation completed successfully",
            data: result
        };
    } catch (error) {
        return {
            success: false,
            message: `Operation failed: ${error.message}`
        };
    }
}
```

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
      "callReference": "itsm_ticket_123",
      "firstname": "Bob",
      "lastname": "Jones"
    }
  }'
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

### ServiceNow Integration
- Built-in fetch API for ServiceNow REST API calls
- Base64 authentication for ServiceNow credentials
- JSON parsing for ServiceNow responses

### Twilio Integration
- Twilio Node.js SDK for Verify API
- WebSocket support for Conversation Relay
- SMS and voice calling capabilities

## Contributing

When adding new ServiceNow integrations or tools, follow the established patterns:

1. **Services** - Handle API integrations and business logic in `src/services/`
2. **Tools** - Provide LLM-accessible functions that call service methods in `src/tools/`
3. **Interfaces** - Define TypeScript contracts in `src/interfaces/`
4. **Handler Pattern** - Use callback-based dependency injection, not EventEmitter patterns
5. **Error Handling** - Services return `null` on errors, tools return `{ success: false, message: string }`

For detailed contribution guidelines, see [CONTRIBUTION.md](./CONTRIBUTION.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.