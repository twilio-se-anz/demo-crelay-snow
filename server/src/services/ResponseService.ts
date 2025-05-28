/**
 * Base service class for handling LLM API interactions and managing conversation flow.
 * This service orchestrates:
 * 
 * 1. Message Management:
 *    - Maintains conversation history
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
 * @property {Array} messages - Conversation history
 * @property {string} promptContext - Initial context from context.md
 * @property {Object} toolManifest - Tool definitions from toolManifest.json
 * @property {boolean} isInterrupted - Flag for interrupting response generation
 * @property {Object} loadedTools - Map of loaded tool functions
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
 * Interface for OpenAI tool definition (legacy, for manifest parsing only)
 */
export interface OpenAIFunctionDefinition {
    type: "function";
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, {
            type: string;
            description: string;
        }>;
        required: string[];
        additionalProperties?: boolean;
    };
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
 * Interface for OpenAI tool call
 */
interface OpenAIToolCall {
    id?: string;
    type?: string;
    function?: {
        name?: string;
        arguments?: string;
    };
}

/**
 * Interface for our internal tool call representation
 */
interface ToolCall {
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
}

/**
 * Service for handling LLM API interactions and managing conversation flow.
 * @class
 */
class ResponseService extends EventEmitter {
    protected openai: OpenAI;
    protected model: string;
    protected promptInputArray: Array<OpenAI.Responses.ResponseInputItem>;
    protected isInterrupted: boolean;
    /**
     * Tool manifest loaded from file, containing tool definitions.
     */
    protected toolManifest: { tools: OpenAIFunctionDefinition[] };
    /**
     * Array of API function definitions.
     */
    protected toolDefinitions: OpenAI.Responses.FunctionTool[];
    /**
     * Map of loaded tool functions.
     */
    protected loadedTools: Record<string, ToolFunction>;

    /**
     * Creates a new ResponseService instance.
     * Initializes client, loads tools from manifest, and sets up initial state.
     * 
     * @throws {Error} If tool loading fails
     */
    constructor() {
        super();
        this.openai = new OpenAI();
        this.model = "";
        this.promptInputArray = [];
        this.isInterrupted = false;
        this.toolManifest = { tools: [] };
        this.toolDefinitions = [];
        this.loadedTools = {};

        // Which Context, Tool Manifest to use for this call (or the default)
        const contextFile = process.env.LLM_CONTEXT || 'defaultContext.md';
        const toolManifestFile = process.env.LLM_MANIFEST || 'defaultToolManifest.json';

        // Initialize context and tools using updateContext
        this.updateContextAndManifest(contextFile, toolManifestFile);
    }

    /**
     * Executes a tool call based on function calling feature.
     * 
     * @param {ToolCall} tool - Tool call object
     * @returns {Promise<ToolResult|null>} Tool execution result or null if execution fails
     */
    async executeToolCall(tool: ToolCall): Promise<ToolResult | null> {
        logOut('ResponseService', `Executing tool call with tool being: ${JSON.stringify(tool, null, 4)} `);

        try {
            let calledTool = this.loadedTools[tool.function.name];
            let calledToolArgs = JSON.parse(tool.function.arguments);
            logOut('ResponseService', `Executing tool call: ${tool.function.name} with args: ${JSON.stringify(calledToolArgs, null, 4)}`);

            // Now run the loaded tool
            let toolResponse = await calledTool(calledToolArgs);

            return toolResponse;
        } catch (error) {
            console.error(`ResponseService executeToolCall, Error executing tool ${tool.function.name}:`, error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    /**
     * Retrieves the current conversation history.
     * 
     * @returns {Array<OpenAI.Responses.ResponseInputItem>} Array of message objects
     */
    getMessages(): Array<OpenAI.Responses.ResponseInputItem> {
        return this.promptInputArray;
    }

    /**
     * Clears conversation history except for the initial system message.
     */
    clearMessages(): void {
        if (this.promptInputArray.length > 0) {
            const systemMessage = this.promptInputArray[0];
            this.promptInputArray = [systemMessage];
        } else {
            this.promptInputArray = [];
        }
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
     * interrupt lengthy responses or redirect the conversation.
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
     * Used for live agent handling when an agent interjects in the conversation.
     * 
     * @param {string} role - Message role ('system' or 'user')
     * @param {string} message - Message content to add to context
     */
    /**
     * Inserts a message into conversation context without generating a response.
     * Used for live agent handling when an agent interjects in the conversation.
     * 
     * @param {string} role - Message role ('system', 'user', 'assistant', or 'tool')
     * @param {string} message - Message content to add to context
     */
    async insertMessageIntoContext(role: 'system' | 'user' | 'assistant' | 'tool' = 'system', message: string): Promise<void> {
        logOut('ResponseService', `Inserting message into context: ${role}: ${message}`);

        // In the updated API structure, 'tool' role messages are handled as 'assistant' messages
        if (role === 'tool') {
            // For tool messages, convert to assistant role to match how tool results are handled in generateResponse
            this.promptInputArray.push({
                role: 'assistant',
                content: message
            });
        } else {
            // For other roles (system, user, assistant), add them directly
            this.promptInputArray.push({
                role,
                content: message
            });
        }
    }

    /**
     * Updates the context and tool manifest files used by the service dynamically. The name passed in will be used to load the context and tool manifest files.
     * The convention is that the context and manifest filles will be stored in the assets directory.
     * 
     * @param {string} contextFile - Path to the new context.md file
     * @param {string} toolManifestFile - Path to the new toolManifest.json file
     * @throws {Error} If file loading fails
     */
    /**
     * Updates the context and tool manifest files used by the service dynamically.
     * Loads the context and manifest from the assets directory, and updates tool definitions.
     * @param {string} contextFile - Path to the new context.md file
     * @param {string} toolManifestFile - Path to the new toolManifest.json file
     * @throws {Error} If file loading fails
     */
    async updateContextAndManifest(contextFile: string, toolManifestFile: string): Promise<void> {
        logOut('ResponseService', `Updating context with new files: ${contextFile}, ${toolManifestFile}`);

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);

        try {
            // Load new context and tool manifest from provided file paths
            const assetsDir = path.join(__dirname, '..', '..', 'assets');
            logOut('ResponseService', `Loading context and tool manifest from: ${assetsDir}`);
            const toolManifestPath = path.join(assetsDir, toolManifestFile);
            logOut('ResponseService', `Loading tool manifest from: ${toolManifestPath}`);

            const context = fs.readFileSync(path.join(assetsDir, contextFile), 'utf8');
            // Load tool manifest as the new OpenAIToolDefinition structure
            const toolManifestJSON = JSON.parse(fs.readFileSync(toolManifestPath, 'utf8')) as { tools: OpenAIFunctionDefinition[] };

            // Reset conversation history and initialize with new system context
            this.promptInputArray = [{
                role: 'system',
                content: context
            }];

            // Update tool definitions and reload tools
            this.toolManifest = toolManifestJSON;

            // load the OpenAI API function definitions from the manifest

            // Convert manifest tools to OpenAI SDK FunctionTool format
            this.toolDefinitions = toolManifestJSON.tools.map(tool => ({
                type: "function",
                name: tool.name,
                parameters: tool.parameters,
                strict: false // Default to false; adjust if your manifest supports strict
            }));
            this.loadedTools = {};

            logOut('ResponseService', `Reloading tools...`);
            for (const tool of this.toolDefinitions) {
                let functionName = tool.name;
                try {
                    // Dynamic import for ES modules
                    const toolsDir = path.join(__dirname, '..', 'tools');
                    const toolModule = await import(path.join(toolsDir, `${functionName}.js`));
                    this.loadedTools[functionName] = toolModule.default;
                    logOut('ResponseService', `Loaded function: ${functionName}`);
                } catch (error) {
                    logError('ResponseService', `Error loading tool ${functionName}: ${error instanceof Error ? error.message : String(error)}`);
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
     * Generates a streaming response using the OpenAI Response API.
     * Handles tool calls, manages conversation history, and emits response chunks.
     * 
     *  == Streaming and Tool Calls ==
     * The service handles streaming responses that may include both content and tool calls:
     *      1. Content chunks are emitted directly via 'responseService.content' events
     *      2. Tool call chunks are accumulated until complete, as they may span multiple chunks
     *      3. When a complete tool call is received:
     *          - The tool is executed with the assembled arguments
     *          - The result is added to conversation history
     *          - A new stream is created to continue the conversation with the tool result
     * This chunked approach ensures reliable tool execution even with complex arguments while maintaining a responsive streaming experience.
     * 
     * == Tool Execution Flow ==
     * When the LLM suggests a tool call, the executeToolCall method processes it by:
     *      1. Retrieving the tool function from the loadedTools map using the tool name
     *      2. Parsing the JSON string arguments into an object
     *      3. Executing the tool with the parsed arguments
     *      4. Returning the tool's response for inclusion in the conversation
     * 
     * == Interrupt Handling ==
     * The method supports graceful interruption during response generation:
     *      1. The isInterrupted flag is reset to false at the start of each response
     *      2. During streaming, each event checks if isInterrupted has been set to true
     *      3. If an interruption is detected, the streaming loop breaks immediately
     *      4. This allows the system to quickly respond to user interruptions
     *      5. The same interrupt check is applied to both initial and follow-up streams
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
        let fullResponse = '';
        let toolCallCollector: ToolCall | null = null;
        this.isInterrupted = false;
        logOut('ResponseService', `Generating response for ${role}: ${prompt}`);

        try {
            // Add the prompt message to history
            this.promptInputArray.push({ role, content: prompt });

            const stream = await this.openai.responses.create({
                model: this.model,
                input: this.promptInputArray,
                tools: this.toolDefinitions,
                stream: true
            });

            logOut('ResponseService', `Stream created`);

            for await (const event of stream) {
                if (this.isInterrupted) {
                    break;
                }

                // Handle different event types based on the semantic events structure
                if (event.type === 'response.created') {
                    logOut('ResponseService', `Response created with ID: ${(event as OpenAI.Responses.ResponseCreatedEvent).response.id}`);
                }
                else if (event.type === 'response.output_text.delta') {
                    // Handle text output
                    const textEvent = event as OpenAI.Responses.ResponseTextDeltaEvent;
                    fullResponse += textEvent.delta;
                    this.emit('responseService.content', {
                        type: "text",
                        token: textEvent.delta,
                        last: false
                    } as ContentResponse);
                }
                else if (event.type === 'response.function_call_arguments.delta') {
                    // Accumulate function call arguments
                    const argsEvent = event as OpenAI.Responses.ResponseFunctionCallArgumentsDeltaEvent;

                    // Initialize collector if this is the first function call chunk
                    if (!toolCallCollector) {
                        toolCallCollector = {
                            id: argsEvent.item_id,
                            type: "function",
                            function: {
                                name: '', // Will be filled in later
                                arguments: ''
                            }
                        };
                    }

                    // Accumulate arguments
                    if (toolCallCollector) {
                        toolCallCollector.function.arguments += argsEvent.delta;
                    }
                }
                else if (event.type === 'response.function_call_arguments.done') {
                    // Function call arguments are complete, execute the tool
                    const doneEvent = event as OpenAI.Responses.ResponseFunctionCallArgumentsDoneEvent;

                    if (toolCallCollector) {
                        // Update with the complete arguments
                        toolCallCollector.function.arguments = doneEvent.arguments;

                        // At this point we need to get the function name
                        // Since we don't have a direct event for it, we'll use the existing name or try to parse it
                        // This is a simplification - in a real implementation, you might need to track this differently
                        if (!toolCallCollector.function.name) {
                            try {
                                // Try to extract function name from arguments if possible
                                const argsObj = JSON.parse(toolCallCollector.function.arguments);
                                if (argsObj && argsObj._function_name) {
                                    toolCallCollector.function.name = argsObj._function_name;
                                }
                            } catch (e) {
                                // If parsing fails, we'll need to handle this case
                                logError('ResponseService', `Failed to parse function arguments: ${e}`);
                            }
                        }

                        const toolCallObj: ToolCall = {
                            id: toolCallCollector.id,
                            type: "function",
                            function: {
                                name: toolCallCollector.function.name,
                                arguments: toolCallCollector.function.arguments
                            }
                        };

                        let toolResult: ToolResult | null = null;
                        try {
                            let calledTool = this.loadedTools[toolCallObj.function.name];
                            let calledToolArgs = JSON.parse(toolCallObj.function.arguments);

                            toolResult = await calledTool(calledToolArgs);
                            logOut('ResponseService', `Conversational tool call result: ${JSON.stringify(toolResult, null, 4)}`);

                            // Add assistant response and tool result to history
                            this.promptInputArray.push({
                                role: "assistant",
                                content: fullResponse
                                // Note: tool_calls is not included here as it's not part of the new API structure
                            });

                            /**
                             * There are different types of responses that can come back from the tools to indicate what needs to be done:
                             * 
                             * - tool: normal tool call that returns a result that is then consumed by the LLM to produce conversational content.
                             * - error: error message also consumed by the LLM to produce conversational content.
                             * - crelay: Conversation Relay specific response format that is not sent back as conversational content
                             * - llm: LLM Controller specific response format that is not sent back as conversational content, but used to change the LLM.
                             * {
                             *       tool: "tool-type",
                             *       response: "response text",
                             * } 
                             * 
                             */
                            if (toolResult) {
                                switch (toolResult.toolType) {
                                    case "tool":
                                        // Add the tool result to the conversation history
                                        logOut('ResponseService', `Tool selected data: ${JSON.stringify(toolResult)}`);
                                        this.promptInputArray.push({
                                            role: "assistant",
                                            content: JSON.stringify(toolResult.toolData)
                                            // Note: tool_call_id is not included as it's not part of the new API structure
                                        });
                                        break;
                                    case "crelay":
                                        // Emit the tool result so CR can use it
                                        logOut('ResponseService', `Tool selected: crelay`);
                                        this.emit('responseService.toolResult', toolResult);
                                        break;
                                    case "error":
                                        // Add the error to the conversation history
                                        logOut('ResponseService', `Tool selected: error`);
                                        this.promptInputArray.push({
                                            role: "system",
                                            content: toolResult.toolData
                                        });
                                        break;
                                    default:
                                        logOut('ResponseService', `No tool type selected. Using default processor`);
                                }
                            }

                            // Continue the conversation with tool results
                            const followUpResponse = await this.openai.responses.create({
                                model: this.model,
                                input: this.promptInputArray,
                                stream: true
                            });

                            for await (const followUpEvent of followUpResponse) {
                                if (this.isInterrupted) {
                                    break;
                                }

                                // Handle text output from follow-up response
                                if (followUpEvent.type === 'response.output_text.delta') {
                                    const textEvent = followUpEvent as OpenAI.Responses.ResponseTextDeltaEvent;
                                    fullResponse += textEvent.delta;
                                    this.emit('responseService.content', {
                                        type: "text",
                                        token: textEvent.delta,
                                        last: false
                                    } as ContentResponse);
                                }
                            }
                        } catch (error) {
                            logError('ResponseService', `GenerateResponse, Error executing tool ${toolCallObj.function.name}: ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                }
                else if (event.type === 'response.completed') {
                    // Response is complete
                    logOut('ResponseService', `Response completed`);

                    // Add final assistant response to history if no tool was called
                    if (!toolCallCollector) {
                        this.promptInputArray.push({
                            role: "assistant",
                            content: fullResponse
                        });
                    }

                    // Emit the final content with last=true
                    this.emit('responseService.content', {
                        type: "text",
                        token: '',
                        last: true
                    } as ContentResponse);
                }
                else if (event.type === 'error') {
                    // Handle error events
                    const errorEvent = event as OpenAI.Responses.ResponseErrorEvent;
                    logError('ResponseService', `Error in stream: ${errorEvent.message}`);
                    this.emit('responseService.error', errorEvent);
                }
            }

        } catch (error) {
            this.emit('responseService.error', error);
            throw error;
        }
    }
}

export { ResponseService };
