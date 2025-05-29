/**
 * Base service class for handling LLM API interactions using OpenAI's Responses API and managing conversation flow.
 * This service orchestrates:
 * 
 * 1. Message Management:
 *    - Utilizes OpenAI's stateful conversation history management
 *    - Processes incoming messages
 *    - Handles tool calls and responses
 *    - Manages streaming responses
 * 
 * 2. Tool Integration:
 *    - Dynamically loads tools from manifest
 *    - Executes tool calls
 *    - Handles tool responses
 * 
 * 3. Event Management:
 *    - Emits content events for responses
 *    - Emits tool result events
 *    - Handles errors and interruptions
 * 
 * 4. Interrupt Handling:
 *    - Provides methods to interrupt ongoing responses
 *    - Manages interruption state through isInterrupted flag
 *    - Gracefully stops streaming when interrupted
 *    - Enables natural conversation flow with interruptions
 * 
 * Tool Loading and Execution:
 * The service implements a dynamic tool loading system where tools are loaded based on their
 * names defined in the toolManifest.json file. Each tool's filename in the /tools directory
 * must exactly match its corresponding name in the manifest. For example, if the manifest
 * defines a tool with name "send-sms", the service will attempt to load it from
 * "/tools/send-sms.js". This naming convention is critical for the dynamic loading system
 * to work correctly.
 * 
 * @class
 * @extends EventEmitter
 * @property {OpenAI} openai - OpenAI API client instance
 * @property {string} model - Model to use (from environment variables)
 * @property {string} currentResponseId - Current response ID for conversation continuity
 * @property {string} instructions - System instructions/context from context.md
 * @property {Object} toolManifest - Tool definitions from toolManifest.json
 * @property {boolean} isInterrupted - Flag for interrupting response generation
 * @property {Object} loadedTools - Map of loaded tool functions
 * @property {Array} inputMessages - Message history for Responses API
 * 
 * Events Emitted:
 * - responseService.content: Response content chunks
 * - responseService.toolResult: Results from tool executions
 * - responseService.error: Error events
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import proper OpenAI types 
// Note: ResponseInput is not yet exported in main OpenAI namespace (see issue #1378)
// Using direct import as recommended workaround until it's properly exported
import type { ResponseInput } from 'openai/resources/responses/responses.mjs';

import { logOut, logError } from '../utils/logger.js';

dotenv.config();

/**
 * Interface for content response
 */
interface ContentResponse {
    type: string;
    token: string;
    last: boolean;
}

/**
 * Interface for tool result
 */
interface ToolResult {
    toolType: string;
    toolData: any;
}

/**
 * Type for loaded tool function
 */
type ToolFunction = (args: any) => Promise<ToolResult> | ToolResult;

/**
 * Interface for tool call from streaming events
 */
interface ResponsesAPIToolCall {
    id: string;
    type: 'function_call';
    call_id: string;
    name: string;
    arguments: string;
}

/**
 * Interface for streaming events from Responses API
 */
interface ResponsesAPIEvent {
    type: string;
    delta?: string;
    data?: any;
    id?: string;
    response_id?: string;
    item_id?: string;
    output_index?: number;
    item?: any;
    arguments?: string;
}

class ResponseService extends EventEmitter {
    protected openai: OpenAI;
    protected model: string;
    protected currentResponseId: string | null;
    protected instructions: string;
    protected isInterrupted: boolean;
    protected toolManifest: { tools: any[] };
    protected toolDefinitions: any[];
    protected loadedTools: Record<string, ToolFunction>;
    protected inputMessages: ResponseInput;

    /**
     * Creates a new ResponseService instance.
     * Initializes client, loads tools from manifest, and sets up initial state.
     * 
     * @throws {Error} If tool loading fails
     */
    constructor() {
        super();
        this.openai = new OpenAI();
        this.model = process.env.OPENAI_MODEL || "gpt-4o";
        this.currentResponseId = null;
        this.instructions = '';
        this.isInterrupted = false;
        this.toolManifest = { tools: [] };
        this.toolDefinitions = [];
        this.loadedTools = {};
        this.inputMessages = [];

        // Which Context, Tool Manifest to use for this call (or the default)
        const contextFile = process.env.LLM_CONTEXT || 'defaultContext.md';
        const toolManifestFile = process.env.LLM_MANIFEST || 'defaultToolManifest.json';

        // Initialize context and tools using updateContext
        this.updateContextAndManifest(contextFile, toolManifestFile);
    }

    /**
     * Executes a tool call based on function calling feature.
     * 
     * @param {ResponsesAPIToolCall} tool - Tool call object
     * @returns {Promise<ToolResult|null>} Tool execution result or null if execution fails
     */
    async executeToolCall(tool: ResponsesAPIToolCall): Promise<ToolResult | null> {
        logOut('ResponseService', `Executing tool call with tool being: ${JSON.stringify(tool, null, 4)} `);

        try {
            let calledTool = this.loadedTools[tool.name];
            let calledToolArgs = JSON.parse(tool.arguments);
            logOut('ResponseService', `Executing tool call: ${tool.name} with args: ${JSON.stringify(calledToolArgs, null, 4)}`);

            // Now run the loaded tool
            let toolResponse = await calledTool(calledToolArgs);

            return toolResponse;
        } catch (error) {
            console.error(`ResponseService executeToolCall, Error executing tool ${tool.name}:`, error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    /**
     * Retrieves the current conversation ID for state management.
     * 
     * @returns {string|null} Current response ID or null if no active conversation
     */
    getCurrentResponseId(): string | null {
        return this.currentResponseId;
    }

    /**
     * Clears conversation history by resetting the response ID and input messages.
     * This will start a new conversation thread with the Responses API.
     */
    clearMessages(): void {
        this.currentResponseId = null;
        this.inputMessages = [];
        logOut('ResponseService', 'Cleared conversation history - will start new thread');
    }

    /**
     * Interrupts current response generation.
     * Sets isInterrupted flag to true to stop streaming immediately.
     * This method is called when a user interrupts the AI during a response,
     * allowing the system to stop the current response and process the new input.
     * 
     * The interrupt mechanism works by:
     * 1. Setting the isInterrupted flag to true
     * 2. Breaking out of the streaming loop in generateResponse
     * 3. Allowing the system to process the new user input
     * 
     * This enables more natural conversation flow by letting users
     * interrupt lengthy responses without waiting for completion.
     */
    interrupt(): void {
        this.isInterrupted = true;
    }

    /**
     * Resets the interruption flag.
     * Allows new responses to be generated after an interruption.
     * This method is called automatically at the beginning of generateResponse
     * to ensure each new response starts with a clean interrupt state.
     * 
     * The reset mechanism ensures that:
     * 1. Previous interruptions don't affect new responses
     * 2. Each response generation starts with isInterrupted = false
     * 3. The system is ready to handle new potential interruptions
     */
    resetInterrupt(): void {
        this.isInterrupted = false;
    }

    /**
     * Inserts a message into conversation context without generating a response.
     * With the Responses API, this is handled by adding to the input messages array.
     * 
     * @param {string} role - Message role ('system', 'user', or 'assistant')
     * @param {string} message - Message content to add to context
     */
    async insertMessageIntoContext(role: 'system' | 'user' | 'assistant' = 'system', message: string): Promise<void> {
        logOut('ResponseService', `Inserting message into context: ${role}: ${message}`);

        try {
            if (role === 'system') {
                // System messages can be added as instructions updates
                this.instructions += `\n\n${message}`;
            } else if (role === 'user' || role === 'assistant') {
                // For user/assistant messages, add to input messages
                this.inputMessages.push({
                    role: role,
                    content: message
                });
            }
        } catch (error) {
            logError('ResponseService', `Error inserting message into context: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Updates the context and tool manifest files used by the service dynamically. The name passed in will be used to load the context and tool manifest files.
     * The convention is that the context and manifest files will be stored in the assets directory.
     * 
     * @param {string} contextFile - Path to the new context.md file
     * @param {string} toolManifestFile - Path to the new toolManifest.json file
     * @throws {Error} If file loading fails
     */
    async updateContextAndManifest(contextFile: string, toolManifestFile: string): Promise<void> {
        logOut('ResponseService', `Updating context with new files: ${contextFile}, ${toolManifestFile}`);

        const __filename = fileURLToPath(import.meta.url);
        logOut('ResponseService', `Current file: ${__filename}`);
        const __dirname = dirname(__filename);
        logOut('ResponseService', `Current directory: ${__dirname}`);

        try {
            // Load new context and tool manifest from provided file paths
            const assetsDir = path.join(__dirname, '..', '..', 'assets');
            logOut('ResponseService', `Loading context and tool manifest from: ${assetsDir}`);
            const context = fs.readFileSync(path.join(assetsDir, contextFile), 'utf8');
            const toolManifestPath = path.join(assetsDir, toolManifestFile);
            logOut('ResponseService', `Loading tool manifest from: ${toolManifestPath}`);

            const toolManifest = JSON.parse(fs.readFileSync(toolManifestPath, 'utf8')) as { tools: any[] };

            // Update instructions and reset conversation
            this.instructions = context;
            this.currentResponseId = null; // Reset conversation to use new context
            this.inputMessages = []; // Reset input messages

            // Update tool definitions and reload tools
            this.toolManifest = toolManifest;
            this.toolDefinitions = toolManifest.tools;
            this.loadedTools = {};

            logOut('ResponseService', `Reloading tools...`);
            for (const tool of this.toolDefinitions) {
                if (tool.type === 'function') {
                    let functionName = tool.function?.name || tool.name;
                    try {
                        // Dynamic import for ES modules - use same path resolution as ChatCompletions version
                        const toolsDir = path.join(__dirname, '..', 'tools');
                        logOut('ResponseService', `Loading tool: ${functionName} from ${path.join(toolsDir, `${functionName}.js`)}`);
                        const toolModule = await import(path.join(toolsDir, `${functionName}.js`));
                        this.loadedTools[functionName] = toolModule.default;
                        logOut('ResponseService', `Loaded function: ${functionName}`);
                    } catch (error) {
                        logError('ResponseService', `Error loading tool ${functionName}: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
            logOut('ResponseService', `Loaded ${Object.keys(this.loadedTools).length} tools`);

        } catch (error) {
            logError('ResponseService', `Error updating context. Please ensure the files are in the /assets directory: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Performs cleanup of service resources.
     * Removes all event listeners to prevent memory leaks.
     */
    cleanup(): void {
        // Remove all event listeners
        this.removeAllListeners();
    }

    /**
     * Processes a stream and handles tool calls by creating follow-up responses.
     * This is a helper method to reduce code duplication between initial and follow-up streams.
     */
    private async processStream(stream: any): Promise<void> {
        let currentToolCall: ResponsesAPIToolCall | null = null;

        // @ts-ignore - TypeScript doesn't recognize the async iterator on the Responses API stream yet
        for await (const event of stream) {
            if (this.isInterrupted) {
                break;
            }

            const eventData = event as ResponsesAPIEvent;

            // Log all event types for debugging
            logOut('ResponseService', `Stream event type: ${eventData.type}`);

            // Handle different event types from the Responses API
            if (eventData.type === 'response.output_text.delta') {
                // Text content streaming
                const content = eventData.delta || '';
                if (content) {
                    this.emit('responseService.content', {
                        type: "text",
                        token: content,
                        last: false
                    } as ContentResponse);
                }
            }
            else if (eventData.type === 'response.output_item.added') {
                // Check if this is a function call item being added
                logOut('ResponseService', `Output item added: ${JSON.stringify(eventData, null, 4)}`);

                if (eventData.item?.type === 'function_call') {
                    currentToolCall = {
                        id: eventData.item.id || 'unknown',
                        type: 'function_call',
                        call_id: eventData.item.call_id || eventData.item.id || 'unknown',
                        name: eventData.item.name || '',
                        arguments: eventData.item.arguments || ''
                    };
                    logOut('ResponseService', `New function call started: ${currentToolCall.name}`);
                }
            }
            else if (eventData.type === 'response.function_call_arguments.delta') {
                // Function call arguments streaming - accumulate the arguments
                logOut('ResponseService', `Function call arguments delta received: ${JSON.stringify(eventData, null, 4)}`);

                if (currentToolCall && eventData.delta) {
                    currentToolCall.arguments += eventData.delta;
                    logOut('ResponseService', `Function arguments updated: ${currentToolCall.arguments}`);
                }
            }
            else if (eventData.type === 'response.function_call_arguments.done') {
                // Function call completed - execute it and create follow-up response
                logOut('ResponseService', `Function call arguments completed: ${JSON.stringify(eventData, null, 4)}`);
                logOut('ResponseService', `Current tool call state: ${JSON.stringify(currentToolCall, null, 4)}`);

                if (currentToolCall) {
                    logOut('ResponseService', `Executing tool call: ${currentToolCall.name} with args: ${currentToolCall.arguments}`);
                    try {
                        const toolResult = await this.executeToolCall(currentToolCall);
                        logOut('ResponseService', `Tool call result: ${JSON.stringify(toolResult, null, 4)}`);

                        if (toolResult) {
                            logOut('ResponseService', `Tool result type: ${toolResult.toolType}`);
                            switch (toolResult.toolType) {
                                case "tool":
                                    logOut('ResponseService', `Processing tool result for conversation continuation`);

                                    // Add function call to input messages
                                    this.inputMessages.push({
                                        type: 'function_call',
                                        id: currentToolCall.id,
                                        call_id: currentToolCall.call_id,
                                        name: currentToolCall.name,
                                        arguments: currentToolCall.arguments
                                    });

                                    // Add function result to input messages
                                    this.inputMessages.push({
                                        type: 'function_call_output',
                                        call_id: currentToolCall.call_id,
                                        output: JSON.stringify(toolResult.toolData)
                                    });

                                    logOut('ResponseService', `Updated input messages length: ${this.inputMessages.length}`);

                                    // Create follow-up response with tool results
                                    logOut('ResponseService', `Creating follow-up response with tool results`);
                                    const followUpStream = await this.openai.responses.create({
                                        model: this.model,
                                        input: this.inputMessages,
                                        tools: this.toolDefinitions.length > 0 ? this.toolDefinitions : undefined,
                                        previous_response_id: this.currentResponseId,
                                        stream: true,
                                        store: true
                                    });

                                    // Process the follow-up stream recursively
                                    await this.processStream(followUpStream);
                                    break;
                                case "crelay":
                                    // Emit the tool result so CR can use it
                                    logOut('ResponseService', `Tool selected: crelay`);
                                    this.emit('responseService.toolResult', toolResult);
                                    break;
                                case "error":
                                    // Log error - API will handle the error context
                                    logOut('ResponseService', `Tool error: ${toolResult.toolData}`);
                                    break;
                                default:
                                    logOut('ResponseService', `No tool type selected. Using default processor`);
                            }
                        } else {
                            logOut('ResponseService', `Tool execution returned null result`);
                        }
                    } catch (error) {
                        logError('ResponseService', `Error executing tool ${currentToolCall.name}: ${error instanceof Error ? error.message : String(error)}`);
                    }

                    currentToolCall = null;
                } else {
                    logOut('ResponseService', `Function call completed but no currentToolCall available`);
                }
            }

            else if (eventData.type === 'response.done') {
                // Response completed - store the response ID for conversation continuity
                logOut('ResponseService', `Response completed: ${JSON.stringify(eventData, null, 4)}`);
                if (eventData.data?.id) {
                    this.currentResponseId = eventData.data.id;
                    logOut('ResponseService', `Response completed with ID: ${this.currentResponseId}`);
                }

                // Only emit final content marker if this is the end of the conversation
                // (not if we're about to create a follow-up for tool results)
                if (!currentToolCall) {
                    this.emit('responseService.content', {
                        type: "text",
                        token: '',
                        last: true
                    } as ContentResponse);
                }
            }
        }
    }

    /**
     * Generates a streaming response using the OpenAI Responses API.
     * Handles tool calls, manages conversation history, and emits response chunks.
     * 
     * == Streaming and Tool Calls ==
     * The Responses API handles streaming responses that may include both content and tool calls:
     *      1. Content chunks are emitted directly via 'responseService.content' events
     *      2. Tool call events are processed as they arrive
     *      3. When tool calls are detected, they are executed immediately
     *      4. Tool results are added to input messages and a follow-up response is created
     * This approach ensures reliable tool execution while maintaining a responsive streaming experience.
     * 
     * == Tool Execution Flow ==
     * When the LLM suggests a tool call, the executeToolCall method processes it by:
     *      1. Retrieving the tool function from the loadedTools map using the tool name
     *      2. Parsing the JSON string arguments into an object
     *      3. Executing the tool with the parsed arguments
     *      4. Adding both the function call and result to input messages
     *      5. Creating a new response with the updated input for conversation continuity
     * 
     * == Interrupt Handling ==
     * The method supports graceful interruption during response generation:
     *      1. The isInterrupted flag is reset to false at the start of each response
     *      2. During streaming, each event checks if isInterrupted has been set to true
     *      3. If an interruption is detected, the streaming loop breaks immediately
     *      4. This allows the system to quickly respond to user interruptions
     * This approach ensures responsive conversation flow by allowing users to interrupt
     * lengthy responses without waiting for completion.
     * 
     * @param {string} role - Message role ('user' or 'system')
     * @param {string} prompt - Input message content
     * @throws {Error} If response generation fails
     * @emits responseService.content
     * @emits responseService.toolResult
     * @emits responseService.error
     */
    async generateResponse(role: 'user' | 'system' = 'user', prompt: string): Promise<void> {
        this.isInterrupted = false;
        logOut('ResponseService', `Generating response for ${role}: ${prompt}`);

        try {
            // Add the new message to input messages
            this.inputMessages.push({
                role: role === 'system' ? 'user' : role, // Responses API doesn't accept 'system' in input
                content: role === 'system' ? `System: ${prompt}` : prompt
            });

            const tools = this.toolDefinitions.length > 0 ? this.toolDefinitions : undefined;
            logOut('ResponseService', `generateResponse tools: ${JSON.stringify(tools, null, 4)}`);

            // Create the response with streaming enabled
            const createParams: any = {
                model: this.model,
                input: this.inputMessages,
                stream: true,
                store: true, // Enable conversation storage
                tools: tools
            };

            // If we have an existing conversation, continue it
            if (this.currentResponseId) {
                createParams.previous_response_id = this.currentResponseId;
            } else {
                // Only add instructions on new conversations
                createParams.instructions = this.instructions;
            }

            const stream = await this.openai.responses.create(createParams);

            logOut('ResponseService', `Response stream created`);

            // Process the stream using the helper method
            await this.processStream(stream);

        } catch (error) {
            this.emit('responseService.error', error);
            throw error;
        }
    }
}

export { ResponseService };