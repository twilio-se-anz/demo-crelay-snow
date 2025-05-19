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

// import { MCPClient } from '../mcp/McpClient';
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

class ResponseService extends EventEmitter {
    protected openai: OpenAI;
    protected model: string;
    protected promptMessagesArray: OpenAI.ChatCompletionMessageParam[];
    protected isInterrupted: boolean;
    protected toolManifest: { tools: OpenAI.ChatCompletionTool[] };
    protected toolDefinitions: OpenAI.ChatCompletionTool[];
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
        this.promptMessagesArray = [];
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
     * @returns {Array<OpenAI.ChatCompletionMessageParam>} Array of message objects
     */
    getMessages(): OpenAI.ChatCompletionMessageParam[] {
        return this.promptMessagesArray;
    }

    /**
     * Clears conversation history except for the initial system message.
     */
    clearMessages(): void {
        if (this.promptMessagesArray.length > 0) {
            const systemMessage = this.promptMessagesArray[0];
            this.promptMessagesArray = [systemMessage];
        } else {
            this.promptMessagesArray = [];
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
    async insertMessageIntoContext(role: 'system' | 'user' | 'assistant' | 'tool' = 'system', message: string): Promise<void> {
        logOut('ResponseService', `Inserting message into context: ${role}: ${message}`);

        if (role === 'tool') {
            this.promptMessagesArray.push({
                role,
                content: message,
                tool_call_id: 'unknown' // Required for tool messages
            });
        } else {
            this.promptMessagesArray.push({
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
    async updateContextAndManifest(contextFile: string, toolManifestFile: string): Promise<void> {
        logOut('ResponseService', `Updating context with new files: ${contextFile}, ${toolManifestFile}`);

        try {
            // Load new context and tool manifest from provided file paths
            const assetsDir = path.join(process.cwd(), 'server', 'assets');
            const context = fs.readFileSync(path.join(assetsDir, contextFile), 'utf8');
            const toolManifestPath = path.join(assetsDir, toolManifestFile);
            const toolManifest = JSON.parse(fs.readFileSync(toolManifestPath, 'utf8')) as { tools: OpenAI.ChatCompletionTool[] };

            // Reset conversation history and initialize with new system context
            this.promptMessagesArray = [{
                role: 'system',
                content: context
            }];

            // Update tool definitions and reload tools
            this.toolManifest = toolManifest;

            // Update tool definitions and reload tools
            this.toolDefinitions = toolManifest.tools;
            this.loadedTools = {};

            logOut('ResponseService', `Reloading tools...`);
            for (const tool of this.toolDefinitions) {
                let functionName = tool.function.name;
                try {
                    // Dynamic import for ES modules
                    const toolsDir = path.join(process.cwd(), 'server', 'tools');
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
     * Generates a streaming response using the LLM API.
     * Handles tool calls, manages conversation history, and emits response chunks.
     * 
     *  == Streaming and Tool Calls ==
     * The service handles streaming responses that may include both content and tool calls:
     *      1. Content chunks are emitted directly via 'responseService.content' events
     *      2. Tool call chunks are accumulated until complete, as they may span multiple chunks
     *      3. When a complete tool call is received (finish_reason='tool_calls'):
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
     *      2. During streaming, each chunk checks if isInterrupted has been set to true
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
            this.promptMessagesArray.push({ role, content: prompt });

            const stream = await this.openai.chat.completions.create({
                model: this.model,
                messages: this.promptMessagesArray,
                tools: this.toolDefinitions,
                stream: true
            });

            logOut('ResponseService', `Stream created`);

            for await (const chunk of stream) {
                if (this.isInterrupted) {
                    break;
                }

                const content = chunk.choices[0]?.delta?.content || '';
                const toolCalls = chunk.choices[0]?.delta?.tool_calls;

                if (content) {
                    fullResponse += content;
                    this.emit('responseService.content', {
                        type: "text",
                        token: content,
                        last: false
                    } as ContentResponse);
                }

                if (toolCalls && toolCalls.length > 0) {
                    const toolCall = toolCalls[0] as OpenAIToolCall;

                    // Initialize collector if this is the first tool call chunk
                    if (!toolCallCollector) {
                        toolCallCollector = {
                            id: toolCall.id || '',
                            type: "function",
                            function: {
                                name: '',
                                arguments: ''
                            }
                        };
                    }

                    // Store the ID if it's present
                    if (toolCall.id) {
                        toolCallCollector.id = toolCall.id;
                    }

                    // Store the name if it's present
                    if (toolCall.function?.name) {
                        toolCallCollector.function.name = toolCall.function.name;
                    }

                    // Accumulate arguments if they're present
                    if (toolCall.function?.arguments) {
                        toolCallCollector.function.arguments += toolCall.function.arguments;
                    }
                }

                if (chunk.choices[0]?.finish_reason === 'tool_calls' && toolCallCollector) {

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
                        this.promptMessagesArray.push({
                            role: "assistant",
                            content: fullResponse,
                            tool_calls: [{
                                id: toolCallObj.id,
                                type: "function",
                                function: {
                                    name: toolCallObj.function.name,
                                    arguments: toolCallObj.function.arguments
                                }
                            }]
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
                                    this.promptMessagesArray.push({
                                        role: "tool",
                                        content: JSON.stringify(toolResult.toolData),
                                        tool_call_id: toolCallObj.id
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
                                    this.promptMessagesArray.push({
                                        role: "system",
                                        content: toolResult.toolData
                                    });
                                    break;
                                default:
                                    logOut('ResponseService', `No tool type selected. Using default processor`);
                            }
                        }
                    } catch (error) {
                        logError('ResponseService', `GenerateResponse, Error executing tool ${toolCallObj.function.name}: ${error instanceof Error ? error.message : String(error)}`);
                    }

                    // Continue the conversation with tool results
                    const followUpStream = await this.openai.chat.completions.create({
                        model: this.model,
                        messages: this.promptMessagesArray,
                        stream: true
                    });

                    for await (const chunk of followUpStream) {
                        if (this.isInterrupted) {
                            break;
                        }
                        const content = chunk.choices[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            this.emit('responseService.content', {
                                type: "text",
                                token: content,
                                last: false
                            } as ContentResponse);
                        }
                    }
                }
            }

            // Add final assistant response to history if no tool was called
            if (!toolCallCollector) {
                this.promptMessagesArray.push({
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

        } catch (error) {
            this.emit('responseService.error', error);
            throw error;
        }
    }
}

export { ResponseService };
