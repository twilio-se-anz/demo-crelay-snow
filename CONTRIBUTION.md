# Contributing to Conversation Relay

This guide outlines how to extend the Conversation Relay system with new services and tools while maintaining the established Dependency Injection (DI) architecture patterns.

## Architecture Overview

The system follows a clear separation of concerns:
- **Services** (`src/services/`) - Handle API integrations and business logic
- **Tools** (`src/tools/`) - Provide LLM-accessible functions that call service methods
- **Server** (`src/server.ts`) - Manages WebSocket connections and HTTP endpoints
- **Interfaces** (`src/interfaces/`) - Define TypeScript contracts

## Adding New API Services

### Step 1: Create the Service Class

Create a new service following the established pattern in `src/services/MyService.ts`:

```typescript
import { logOut, logError } from '../utils/logger.js';

/**
 * Interface for API request data
 */
interface MyServiceRequest {
    field1: string;
    field2?: string;
    [key: string]: any;
}

/**
 * Interface for API response data
 */
interface MyServiceResponse {
    result: {
        id: string;
        status: string;
        data: any;
        [key: string]: any;
    };
}

/**
 * Service class for handling My API operations
 * Note: Only extend EventEmitter if your service needs to emit events
 */
class MyService {
    private apiUrl: string;
    private apiKey: string;
    private authHeader: string;

    constructor() {
        this.apiUrl = process.env.MY_API_URL || '';
        this.apiKey = process.env.MY_API_KEY || '';
        this.authHeader = `Bearer ${this.apiKey}`;
    }

    /**
     * Creates a new resource via the API
     */
    async createResource(data: MyServiceRequest): Promise<MyServiceResponse | null> {
        try {
            logOut('MyService', `Creating resource with data: ${JSON.stringify(data)}`);

            const response = await fetch(`${this.apiUrl}/api/resources`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authHeader,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const result: MyServiceResponse = await response.json();
            logOut('MyService', `Resource created: ${result.result.id}`);
            return result;

        } catch (error) {
            logError('MyService', `Create resource error: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Retrieves a resource by ID
     */
    async getResource(id: string): Promise<MyServiceResponse | null> {
        try {
            logOut('MyService', `Getting resource: ${id}`);

            const response = await fetch(`${this.apiUrl}/api/resources/${id}`, {
                headers: {
                    'Authorization': this.authHeader,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const result: MyServiceResponse = await response.json();
            logOut('MyService', `Resource retrieved: ${result.result.id}`);
            return result;

        } catch (error) {
            logError('MyService', `Get resource error: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Updates a resource
     */
    async updateResource(id: string, data: Partial<MyServiceRequest>): Promise<MyServiceResponse | null> {
        try {
            logOut('MyService', `Updating resource ${id} with data: ${JSON.stringify(data)}`);

            const response = await fetch(`${this.apiUrl}/api/resources/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authHeader,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const result: MyServiceResponse = await response.json();
            logOut('MyService', `Resource updated: ${result.result.id}`);
            return result;

        } catch (error) {
            logError('MyService', `Update resource error: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
}

export { MyService, MyServiceRequest, MyServiceResponse };
```

### Step 2: Service Architecture Guidelines

**Key Requirements:**
- Use environment variables for configuration
- Implement comprehensive error handling with try/catch
- Use the logger utility (`logOut`, `logError`)
- Return `null` on errors to maintain consistent API
- Export TypeScript interfaces for use in tools
- Follow async/await pattern (no `.then()` chains)
- **DO NOT extend EventEmitter** - Services should be pure API wrappers

**Event vs Callback Architecture:**

The system uses **callback-based dependency injection**, NOT EventEmitter patterns:

- **Services**: Pure classes that return data or accept callback handlers
- **WebSocket Layer** (`server.ts`): ONLY place for actual events (`ws.on()`, `ws.send()`)
- **Response Services**: Use `ResponseHandler` interface with method callbacks (not events)
- **Tools**: Call service methods directly and return data
- **Timers**: Use `setInterval`/`clearInterval` for timing (SilenceHandler), not events

```typescript
// ✅ CORRECT - Pure API service
class MyService {
    constructor() {
        this.apiUrl = process.env.MY_API_URL || '';
    }
    
    async getData() {
        return await fetch(this.apiUrl);
    }
}

// ✅ CORRECT - Callback-based service (like ResponseService pattern)
class MyLLMService implements ResponseService {
    private responseHandler!: ResponseHandler;
    
    createResponseHandler(handler: ResponseHandler): void {
        this.responseHandler = handler; // Store callback, don't emit events
    }
    
    async generateResponse(prompt: string): Promise<void> {
        const result = await this.processPrompt(prompt);
        this.responseHandler.content(result); // Call method, don't emit
    }
}

// ✅ CORRECT - Timer-based pattern (like SilenceHandler)
class MyTimerService {
    private timer: NodeJS.Timeout | null = null;
    
    startMonitoring(callback: (data: any) => void) {
        this.timer = setInterval(() => {
            callback({ type: 'check' }); // Use callback, not emit
        }, 1000);
    }
    
    cleanup() {
        if (this.timer) clearInterval(this.timer);
    }
}

// ❌ INCORRECT - Don't use EventEmitter in services
class MyService extends EventEmitter {
    constructor() {
        super(); // Not needed in this architecture!
    }
}
```

**Event Handling Hierarchy:**
1. **WebSocket Events** (`server.ts`): Connection lifecycle only
2. **HTTP Server Events** (`server.ts`): Server startup/error handling only  
3. **Method Callbacks**: All service communication via interfaces
4. **Timers**: Use `setInterval` for time-based operations, not events

## Dependency Injection Patterns

### Callback Handler Pattern (Response Services)

The system uses **callback handlers** instead of event emission for service communication:

```typescript
// Interface definition
interface ResponseHandler {
    content(response: ContentResponse): void;
    toolResult(toolResult: ToolResultEvent): void;
    error(error: Error): void;
    callSid(callSid: string, responseMessage: any): void;
}

// Service implementation
class MyLLMService implements ResponseService {
    private responseHandler!: ResponseHandler;
    
    // Dependency injection: store callback handler
    createResponseHandler(handler: ResponseHandler): void {
        this.responseHandler = handler;
    }
    
    async processData() {
        try {
            const result = await this.apiCall();
            // Call handler method (not emit event)
            this.responseHandler.content({ type: 'response', token: result });
        } catch (error) {
            this.responseHandler.error(error);
        }
    }
    
    cleanup(): void {
        // No event listeners to remove - just clear references
        // Handler cleanup is managed by calling code
    }
}

// Usage in orchestrator service
class ConversationRelayService {
    private createResponseHandler(): ResponseHandler {
        return {
            content: (response) => this.handleContent(response),
            toolResult: (result) => this.handleTool(result),
            error: (error) => this.handleError(error),
            callSid: (callSid, msg) => this.handleCallSid(callSid, msg)
        };
    }
    
    async setupService() {
        const handler = this.createResponseHandler();
        this.responseService.createResponseHandler(handler);
    }
}
```

### Service Instantiation Pattern (Tools)

Tools instantiate services directly (no global singletons):

```typescript
// ✅ CORRECT - Instantiate service in tool
export default async function myTool(args: MyToolArgs): Promise<MyToolResponse> {
    const myService = new MyService(); // New instance per tool call
    
    try {
        const result = await myService.performAction(args);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// ❌ INCORRECT - Don't use global service instances
const globalService = new MyService(); // Avoid this
export default async function myTool(args: MyToolArgs) {
    return await globalService.performAction(args);
}
```

### Timer-Based Service Pattern

For time-based operations, use callback pattern with timers:

```typescript
class TimerService {
    private timer: NodeJS.Timeout | null = null;
    private callback: ((data: any) => void) | null = null;
    
    startMonitoring(callback: (data: any) => void): void {
        this.callback = callback;
        this.timer = setInterval(() => {
            if (this.callback) {
                this.callback({ timestamp: Date.now() });
            }
        }, 1000);
    }
    
    cleanup(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.callback = null;
    }
}
```

## Adding Tools

### Step 3: Create Tool Functions

Tools should be lightweight wrappers that call service methods. Create `src/tools/my-tool-action.ts`:

```typescript
/**
 * My Tool Action function - returns standard responses for conversation context.
 * This is a generic LLM tool that OpenAI processes normally.
 */
import { logOut, logError } from '../utils/logger.js';
import { MyService } from '../services/MyService.js';

/**
 * Interface for the function arguments
 */
interface MyToolActionArguments {
    field1: string;
    field2?: string;
    [key: string]: any;
}

/**
 * Interface for the response object - simplified
 */
interface MyToolActionResponse {
    success: boolean;
    message: string;
    resource_id?: string;
    data?: any;
}

/**
 * Performs an action using the My API service
 * Returns a simple response that gets inserted into conversation context
 * 
 * @param functionArguments - The arguments for the tool function
 * @returns A simple response object for conversation context
 */
export default async function (functionArguments: MyToolActionArguments): Promise<MyToolActionResponse> {
    const log = (msg: string) => logOut('MyToolAction', msg);
    const logError_ = (msg: string) => logError('MyToolAction', msg);

    log(`My tool action function called with arguments: ${JSON.stringify(functionArguments)}`);

    const myService = new MyService();

    try {
        // Call the service method
        const result = await myService.createResource(functionArguments);

        if (!result) {
            logError_(`Failed to create resource`);
            return {
                success: false,
                message: `Failed to create resource`
            };
        }

        const response: MyToolActionResponse = {
            success: true,
            message: `Resource created successfully`,
            resource_id: result.result.id,
            data: result.result.data
        };

        log(`Resource created successfully: ${JSON.stringify(response)}`);
        return response;

    } catch (error) {
        const errorMessage = `Resource creation failed: ${error instanceof Error ? error.message : String(error)}`;
        logError_(errorMessage);

        return {
            success: false,
            message: errorMessage
        };
    }
}
```

### Step 4: Tool Architecture Guidelines

**Key Requirements:**
- Export a default async function with typed arguments
- Import and instantiate the service class within the tool
- Use descriptive logging with tool-specific prefixes
- Return simple, conversation-friendly response objects
- Include `success: boolean` and `message: string` in all responses
- Keep tool logic minimal - delegate to service methods
- Handle service errors gracefully and return user-friendly messages

## Adding Twilio Services to TwilioService.ts

### Step 5: Extending TwilioService

Add new Twilio API methods to the existing `TwilioService` class:

```typescript
/**
 * Sends a message using Twilio Programmable Messaging
 */
async sendMessage(to: string, body: string, mediaUrl?: string[]): Promise<string | null> {
    try {
        logOut('TwilioService', `Sending message to: ${to}`);

        const messageOptions: any = {
            body: body,
            from: this.fromNumber,
            to: to
        };

        if (mediaUrl && mediaUrl.length > 0) {
            messageOptions.mediaUrl = mediaUrl;
        }

        const message = await this.twilioClient.messages.create(messageOptions);
        logOut('TwilioService', `Message sent with SID: ${message.sid}`);
        return message.sid;

    } catch (error) {
        logError('TwilioService', `Error sending message: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}
```

### Step 6: Creating Twilio Tools

Create corresponding tools in `src/tools/` that call the TwilioService methods:

```typescript
/**
 * Send Message Tool - calls TwilioService.sendMessage()
 */
import { logOut, logError } from '../utils/logger.js';
import { TwilioService } from '../services/TwilioService.js';

interface SendMessageArguments {
    to: string;
    body: string;
    media_urls?: string[];
}

interface SendMessageResponse {
    success: boolean;
    message: string;
    message_sid?: string;
}

export default async function (functionArguments: SendMessageArguments): Promise<SendMessageResponse> {
    const twilioService = new TwilioService();
    
    try {
        const messageSid = await twilioService.sendMessage(
            functionArguments.to, 
            functionArguments.body,
            functionArguments.media_urls
        );

        if (!messageSid) {
            return {
                success: false,
                message: `Failed to send message to ${functionArguments.to}`
            };
        }

        return {
            success: true,
            message: `Message sent successfully`,
            message_sid: messageSid
        };

    } catch (error) {
        return {
            success: false,
            message: `Message send failed: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
```

## Specialized Twilio Integrations

### Verify API Integration

The Verify API requires a different approach due to its two-step nature:

1. **Service Methods**: Add to TwilioService.ts
```typescript
async sendVerification(to: string, channel: string = 'sms'): Promise<string | null> {
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    // Implementation details...
}

async checkVerification(to: string, code: string): Promise<boolean> {
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    // Implementation details...
}
```

2. **Separate Tools**: Create `send-verification.ts` and `check-verification.ts`
   - `send-verification.ts` - Initiates verification process
   - `check-verification.ts` - Validates submitted codes

3. **Environment Variables**: Requires `TWILIO_VERIFY_SERVICE_SID`

### Flex Integration

Flex integration involves TaskRouter and requires additional setup:

1. **Service Methods**: Add to TwilioService.ts
```typescript
async createFlexTask(attributes: object, workflowSid: string): Promise<any> {
    // TaskRouter task creation
}

async updateTaskAttributes(taskSid: string, attributes: object): Promise<any> {
    // Task attribute updates
}
```

2. **Environment Variables**:
   - `TWILIO_WORKSPACE_SID`
   - `TWILIO_WORKFLOW_SID`
   - `TWILIO_TASK_QUEUE_SID`

### Voice Intelligence Integration

Voice Intelligence requires webhook endpoint handling:

1. **Service Method**: Add webhook processing to TwilioService.ts
```typescript
async processVoiceIntelligenceWebhook(webhookData: any): Promise<any> {
    // Extract and process webhook data
    // Return structured analysis data
}
```

2. **Server Endpoint**: Add to server.ts
```typescript
app.post('/voiceIntelligenceWebhook', async (req, res) => {
    const processedData = await twilioService.processVoiceIntelligenceWebhook(req.body);
    // Insert into active conversation sessions
});
```

3. **Configuration**: Set webhook URL in Twilio Console to point to your endpoint

## Context Configuration

### Step 7: Update Context Files

Add tool descriptions to context files in `assets/`:

```markdown
## Tool handling
If the customer needs a new resource created, use the "my-tool-action" tool
If the customer wants to retrieve resource information, use the "get-my-resource" tool
```

### Step 8: Update Tool Manifests

Add tool definitions to `assets/defaultToolManifest.json`:

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "my-tool-action",
        "description": "Creates a new resource using My API service",
        "parameters": {
          "type": "object",
          "properties": {
            "field1": {
              "type": "string",
              "description": "Required field for resource creation"
            },
            "field2": {
              "type": "string", 
              "description": "Optional field for additional data"
            }
          },
          "required": ["field1"]
        }
      }
    }
  ]
}
```

## Environment Variables

### Step 9: Document Required Variables

Add environment variable documentation:

```bash
# My API Service Configuration
MY_API_URL=https://api.myservice.com
MY_API_KEY=your-api-key-here

# Twilio Verify (if using verification)
TWILIO_VERIFY_SERVICE_SID=VA...

# Twilio Flex (if using Flex integration)  
TWILIO_WORKSPACE_SID=WS...
TWILIO_WORKFLOW_SID=WW...
```

## Testing and Validation

### Step 10: Build and Runtime Testing

1. **TypeScript Compilation**:
   ```bash
   npm run build
   ```

2. **Runtime Validation**:
   ```bash
   npm start
   ```

3. **Integration Testing**:
   - Test service methods directly
   - Test tools via conversation flows
   - Verify webhook endpoints (if applicable)

## Best Practices

### Code Quality
- Use TypeScript interfaces for all data structures
- Implement comprehensive error handling
- Follow async/await patterns consistently
- Use environment variables for configuration
- Add detailed JSDoc comments

### Architecture Patterns
- Services handle API integration logic
- Tools provide LLM-accessible interfaces
- Maintain clear separation of concerns
- Follow the established DI patterns
- Keep tools lightweight and focused

### Error Handling
- Services return `null` on errors
- Tools return `{ success: false, message: string }`
- Log errors with descriptive context
- Provide user-friendly error messages

### Performance Considerations
- Instantiate services within tools (not globally)
- Use appropriate HTTP timeouts
- Implement rate limiting if needed
- Cache authentication tokens when possible

## Plugin Architecture

### Step 11: Creating Plugins (Optional)

For complex integrations, create plugin directories:

```
plugin-my-service/
├── README.md
├── package.json
├── src/
│   ├── components/
│   └── config/
└── assets/
```

This provides a structured way to organize related tools, configurations, and documentation for specific service integrations.