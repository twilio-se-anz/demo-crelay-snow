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

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { logOut, logError } = require('../utils/logger');

class ResponseService extends EventEmitter {
    /**
     * Creates a new ResponseService instance.
     * Initializes client, loads tools from manifest, and sets up initial state.
     * 
     * @param {string} contextFile - Path to the context.md file
     * @param {string} toolManifestFile - Path to the toolManifest.json file
     * @throws {Error} If tool loading fails
     */
    constructor() {
        super();
        this.promptMessagesArray = [];
        this.isInterrupted = false;

        // Which Context, Tool Manifest to use for this call (or the default)
        const contextFile = process.env.LLM_CONTEXT || 'defaultContext.md'
        const toolManifestFile = process.env.LLM_MANIFEST || 'defaultToolManifest.json'

        // Initialize context and tools using updateContext
        this.updateContextAndManifest(contextFile, toolManifestFile);
    }

    /**
     * Executes a tool call based on function calling feature.
     * 
     * @param {Object} tool - Tool call object
     * @param {Object} tool.function - Function details
     * @param {string} tool.function.name - Name of the tool to execute
     * @param {string} tool.function.arguments - JSON string of arguments
     * @returns {Promise<Object|null>} Tool execution result or null if execution fails
     */
    async executeToolCall(tool) {
        logOut('ResponseService', `Executing tool call with tool being: ${JSON.stringify(tool, null, 4)} `);

        try {
            let calledTool = this.loadedTools[tool.function.name];
            let calledToolArgs = JSON.parse(tool.function.arguments);
            logOut('ResponseService', `Executing tool call: ${tool.function.name} with args: ${JSON.stringify(calledToolArgs, null, 4)}`);

            // Now run the loaded tool
            let toolResponse = calledTool(calledToolArgs);

            return toolResponse;
        } catch (error) {
            console.error(`ResponseService executeToolCall, Error executing tool ${tool.function.name}:`, error);
            return null;
        }
    }

    /**
     * Retrieves the current conversation history.
     * 
     * @returns {Array} Array of message objects
     */
    getMessages() {
        return this.promptMessagesArray;
    }

    /**
     * Clears conversation history except for the initial system message.
     */
    clearMessages() {
        const systemMessage = this.promptMessagesArray[0];
        this.promptMessagesArray = [systemMessage];
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
    interrupt() {
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
    resetInterrupt() {
        this.isInterrupted = false;
    }

    /**
     * Inserts a message into conversation context without generating a response.
     * Used for live agent handling when an agent interjects in the conversation.
     * 
     * @param {string} role - Message role ('system' or 'user')
     * @param {string} message - Message content to add to context
     */
    async insertMessageIntoContext(role = 'system', message) {
        logOut('ResponseService', `Inserting message into context: ${role}: ${message}`);
        this.promptMessagesArray.push({ role, content: message });
    }

    /**
     * Updates the context and tool manifest files used by the service dynamically. The name passed in will be used to load the context and tool manifest files.
     * The convention is that the context and manifest filles will be stored in the assets directory.
     * 
     * @param {string} contextFile - Path to the new context.md file
     * @param {string} toolManifestFile - Path to the new toolManifest.json file
     * @throws {Error} If file loading fails
     */
    updateContextAndManifest(contextFile, toolManifestFile) {
        logOut('ResponseService', `Updating context with new files: ${contextFile}, ${toolManifestFile}`);

        try {
            // Load new context and tool manifest from provided file paths
            const context = fs.readFileSync(path.join(__dirname, `../assets/${contextFile}`), 'utf8');
            const toolManifest = require(path.join(__dirname, `../assets/${toolManifestFile}`));

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
            this.toolDefinitions.forEach((tool) => {
                let functionName = tool.function.name;
                this.loadedTools[functionName] = require(`../tools/${functionName}`);
                logOut('ResponseService', `Loaded function: ${functionName}`);
            });
            logOut('ResponseService', `Loaded ${this.toolDefinitions.length} tools`);

        } catch (error) {
            logError('ResponseService', `Error updating context. Please ensure the files are in the /assets directory:`, error);
            throw error;
        }
    }

    /**
     * Performs cleanup of service resources.
     * Removes all event listeners to prevent memory leaks.
     */
    cleanup() {
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
    async generateResponse(role = 'user', prompt) {
        let fullResponse = '';
        let toolCallCollector = null;
        this.isInterrupted = false;
        logOut('ResponseService', `Generating response for ${role}: ${prompt}`);

        try {
            // Add the prompt message to history
            this.promptMessagesArray.push({ role: role, content: prompt });

            const stream = await this.openai.chat.completions.create({
                model: this.model,
                messages: this.promptMessagesArray,
                tools: this.toolManifest.tools,
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

                    const toolCallObj = {
                        id: toolCallCollector.id,
                        type: "function",
                        function: {
                            name: toolCallCollector.function.name,
                            arguments: toolCallCollector.function.arguments
                        }
                    };

                    logOut('ResponseService', `Tool call collected: ${JSON.stringify(toolCallObj, null, 4)}`);

                    let toolResult = null;
                    try {
                        logOut('ResponseService', `Executing tool start`);
                        logOut('ResponseService', `Executing tool call: ${toolCallObj.function.name} with args: ${toolCallObj.function.arguments}`);
                        let calledTool = this.loadedTools[toolCallObj.function.name];
                        let calledToolArgs = JSON.parse(toolCallObj.function.arguments);

                        toolResult = await calledTool(calledToolArgs);
                        logOut('ResponseService', `Conversational tool call result: ${JSON.stringify(toolResult, null, 4)}`);

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
                        switch (toolResult.toolType) {
                            case "tool":
                                // Add the tool result to the conversation history
                                logOut('ResponseService', `Tool selected: tool`);
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
                    } catch (error) {
                        logError('ResponseService', `GenerateResponse, Error executing tool ${toolCallObj.function.name}:`, error);
                    }

                    // Add assistant response and tool result to history
                    this.promptMessagesArray.push({
                        role: "assistant",
                        content: fullResponse,
                        tool_calls: [toolCallObj]
                    });

                    this.promptMessagesArray.push({
                        role: "tool",
                        content: JSON.stringify(toolResult),
                        tool_call_id: toolCallObj.id
                    });

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

module.exports = { ResponseService };
