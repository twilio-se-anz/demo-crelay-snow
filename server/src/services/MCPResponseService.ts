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
 * "/tools/send-sms.ts". This naming convention is critical for the dynamic loading system
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
import { fileURLToPath } from 'url';

import { MCPClient } from '../mcp/McpClient.js';
import { logOut, logError } from '../utils/logger.js';

import OpenAI from 'openai';

dotenv.config();

const { OPENAI_API_KEY, OPENAI_MODEL } = process.env;

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

interface Message {
    role: MessageRole;
    content: string;
    tool_calls?: any[];
    tool_call_id?: string;
}

interface ToolFunction {
    name: string;
    arguments: string;
}

interface ToolCall {
    id: string;
    type: string;
    function: ToolFunction;
}

interface ToolResult {
    toolType: string;
    toolData: any;
}

interface ToolDefinition {
    function: {
        name: string;
        arguments: string;
    };
    [key: string]: any;
}

interface ToolManifest {
    tools: ToolDefinition[];
}

type LoadedTools = {
    [key: string]: (args: any) => Promise<any> | any;
};

export class MCPResponseService extends EventEmitter {
    public openai: OpenAI;
    public model: string | undefined;
    public promptMessagesArray: Message[];
    public toolManifest: ToolManifest | undefined;
    public isInterrupted: boolean;
    public loadedTools: LoadedTools = {};
    public toolDefinitions: ToolDefinition[] | undefined;

    /**
     * Creates a new ResponseService instance.
     * Initializes client, loads tools from manifest, and sets up initial state.
     * 
     * @throws {Error} If tool loading fails
     */
    constructor() {
        super();
        this.promptMessagesArray = [];
        this.isInterrupted = false;

        // Which Context, Tool Manifest to use for this call (or the default)
        const contextFile = process.env.LLM_CONTEXT || 'defaultContext.md';
        const toolManifestFile = process.env.LLM_MANIFEST || 'defaultToolManifest.json';

        // Initialize context and tools using updateContext
        this.updateContextAndManifest(contextFile, toolManifestFile);

        this.openai = new OpenAI();
        this.model = OPENAI_MODEL;
        logOut('OpenAIService', 'Initialized');
    }

    /**
     * Executes a tool call based on function calling feature.
     * 
     * @param tool - Tool call object
     * @returns Tool execution result or null if execution fails
     */
    public async executeToolCall(tool: ToolCall): Promise<any | null> {
        logOut('ResponseService', `Executing tool call with tool being: ${JSON.stringify(tool, null, 4)} `);

        try {
            const calledTool = this.loadedTools[tool.function.name];
            const calledToolArgs = JSON.parse(tool.function.arguments);
            logOut('ResponseService', `Executing tool call: ${tool.function.name} with args: ${JSON.stringify(calledToolArgs, null, 4)}`);

            // Now run the loaded tool
            const toolResponse = await calledTool(calledToolArgs);

            return toolResponse;
        } catch (error) {
            console.error(`ResponseService executeToolCall, Error executing tool ${tool.function.name}:`, error);
            return null;
        }
    }

    /**
     * Retrieves the current conversation history.
     * 
     * @returns Array of message objects
     */
    public getMessages(): Message[] {
        return this.promptMessagesArray;
    }

    /**
     * Clears conversation history except for the initial system message.
     */
    public clearMessages(): void {
        const systemMessage = this.promptMessagesArray[0];
        this.promptMessagesArray = [systemMessage];
    }

    /**
     * Interrupts current response generation.
     * Sets isInterrupted flag to true to stop streaming immediately.
     * This method is called when a user interrupts the AI during a response,
     * allowing the system to stop the current response and process the new input.
     */
    public interrupt(): void {
        this.isInterrupted = true;
    }

    /**
     * Resets the interruption flag.
     * Allows new responses to be generated after an interruption.
     * This method is called automatically at the beginning of generateResponse
     * to ensure each new response starts with a clean interrupt state.
     */
    public resetInterrupt(): void {
        this.isInterrupted = false;
    }

    /**
     * Inserts a message into conversation context without generating a response.
     * Used for live agent handling when an agent interjects in the conversation.
     * 
     * @param role - Message role ('system' or 'user')
     * @param message - Message content to add to context
     */
    public async insertMessageIntoContext(role: MessageRole = 'system', message: string): Promise<void> {
        logOut('ResponseService', `Inserting message into context: ${role}: ${message}`);
        this.promptMessagesArray.push({ role, content: message });
    }

    /**
     * Updates the context and tool manifest files used by the service dynamically. The name passed in will be used to load the context and tool manifest files.
     * The convention is that the context and manifest files will be stored in the assets directory.
     * 
     * @param contextFile - Path to the new context.md file
     * @param toolManifestFile - Path to the new toolManifest.json file
     * @throws {Error} If file loading fails
     */
    public async updateContextAndManifest(contextFile: string, toolManifestFile: string): Promise<void> {
        logOut('ResponseService', `Updating context with new files: ${contextFile}, ${toolManifestFile}`);

        try {
            // MCP Server loading
            const mcpClient = new MCPClient();
            try {
                logOut('ResponseService', `Connecting to MCP server...`);
                await mcpClient.connectToMcpServer();
                const mcpToolExecutor = mcpClient.getToolExecutor();
                if (!mcpToolExecutor) {
                    logError('ResponseService', `Tool executor not initialized. Please ensure MCP server is connected and tools are loaded.`);
                    return;
                }
                const tools = mcpClient.convertToOpenAiTools();
                if (!tools) {
                    logError('ResponseService', `No tools available or failed to convert. Please ensure MCP server is connected and tools are loaded.`);
                    return;
                }

                const toolManifest: ToolManifest = {
                    tools: tools
                };
                logOut('ResponseService', `Loaded ${toolManifest.tools.length} tools from MCP server`);

                // Reset conversation history and initialize with new system context
                // For now, context is not loaded from file, but could be added here
                this.promptMessagesArray = [{
                    role: 'system',
                    content: '' // context could be loaded from file if needed
                }];

                // Update tool definitions and reload tools
                this.toolManifest = toolManifest;
                this.toolDefinitions = toolManifest.tools;
                this.loadedTools = {};

                logOut('ResponseService', `Reloading tools...`);
                for (const tool of this.toolDefinitions) {
                    const functionName = tool.function.name;
                    // Dynamic import for ES modules
                    try {
                        const toolModule = await import(`../tools/${functionName}.js`);
                        this.loadedTools[functionName] = toolModule.default;
                        logOut('ResponseService', `Loaded function: ${functionName}`);
                    } catch (err) {
                        logError('ResponseService', `Failed to load tool module: ${functionName}`, err);
                    }
                }
                logOut('ResponseService', `Loaded ${this.toolDefinitions.length} tools`);
            } catch (error) {
                logError('ResponseService', `Error connecting to MCP server:`, error);
                return;
            }
        } catch (error) {
            logError('ResponseService', `Error updating context. Please ensure the files are in the /assets directory:`, error);
            throw error;
        }
    }

    /**
     * Performs cleanup of service resources.
     * Removes all event listeners to prevent memory leaks.
     */
    public cleanup(): void {
        this.removeAllListeners();
    }

    /**
     * Generates a streaming response using the LLM API.
     * Handles tool calls, manages conversation history, and emits response chunks.
     * 
     * @param role - Message role ('user' or 'system')
     * @param prompt - Input message content
     * @throws {Error} If response generation fails
     * @emits responseService.content
     * @emits responseService.toolResult
     * @emits responseService.error
     */
    public async generateResponse(role: MessageRole = 'user', prompt: string): Promise<void> {
        let fullResponse = '';
        let toolCallCollector: ToolCall | null = null;
        this.isInterrupted = false;
        logOut('ResponseService', `Generating response for ${role}: ${prompt}`);

        try {
            // Add the prompt message to history
            this.promptMessagesArray.push({ role: role, content: prompt });

            const stream = await this.openai.chat.completions.create({
                model: this.model!,
                messages: this.promptMessagesArray,
                tools: this.toolManifest?.tools,
                stream: true
            });

            logOut('ResponseService', `Stream created`);

            for await (const chunk of stream as any) {
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
                    });
                }

                if (toolCalls && toolCalls.length > 0) {
                    const toolCall = toolCalls[0];

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
                        const calledTool = this.loadedTools[toolCallObj.function.name];
                        const calledToolArgs = JSON.parse(toolCallObj.function.arguments);

                        toolResult = await calledTool(calledToolArgs);
                        logOut('ResponseService', `Conversational tool call result: ${JSON.stringify(toolResult, null, 4)}`);

                        // Add assistant response and tool result to history
                        this.promptMessagesArray.push({
                            role: "assistant",
                            content: fullResponse,
                            tool_calls: [toolCallObj]
                        });

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
                                    this.emit('responseService.toolResult', toolResult.toolData);
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
                        logError('ResponseService', `GenerateResponse, Error executing tool ${toolCallObj.function.name}:`, error);
                    }

                    // Continue the conversation with tool results
                    const followUpStream = await this.openai.chat.completions.create({
                        model: this.model!,
                        messages: this.promptMessagesArray,
                        stream: true
                    });

                    for await (const chunk of followUpStream as any) {
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
                            });
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
            });

        } catch (error) {
            this.emit('responseService.error', error);
            throw error;
        }
    }
}
