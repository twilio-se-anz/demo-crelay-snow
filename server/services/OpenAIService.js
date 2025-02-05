const OpenAI = require('openai');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load the context & tool manifest
let context = fs.readFileSync(path.join(__dirname, '../assets/context.md'), 'utf8');
const toolManifest = require('../assets/toolManifest.json');
const { logOut, logError } = require('../utils/logger');
const { OPENAI_API_KEY } = process.env;
const { OPENAI_MODEL } = process.env;

class OpenAIService extends EventEmitter {
    constructor() {
        super();
        this.openai = new OpenAI();
        this.model = OPENAI_MODEL;
        this.messages = [];
        this.promptContext = context
        this.toolManifest = toolManifest
        this.isInterrupted = false;

        // Load tools from tool manifest and ../tools folder
        this.toolDefinitions = toolManifest.tools;
        this.loadedTools = {};
        logOut(`[OpenAIService]`, `Loading tools...`);

        this.toolDefinitions.forEach((tool) => {
            let functionName = tool.function.name;
            // Dynamically load all tool files
            this.loadedTools[functionName] = require(`../tools/${functionName}`);
            logOut(`[OpenAIService]`, `Loaded function: ${functionName}`);
        });
        logOut(`[OpenAIService]`, `Loaded ${this.toolDefinitions.length} tools`);

    }

    setCallParameters(to, from, callSid) {
        this.twilioNumber = to;
        this.customerNumber = from;
        this.callSid = callSid;

        logOut(`[OpenAIService]`, `Call to: ${this.twilioNumber} from: ${this.customerNumber} with call SID: ${this.callSid}`);
        this.messages.push({
            role: 'system',
            content: `The customer phone number or "from" number is ${this.customerNumber}, the callSid is ${this.callSid} and the number to send SMSs from is: ${this.twilioNumber}. Use this information throughout as the reference when calling any of the tools. Specifically use the callSid when you use the "transfer-to-agent" tool to transfer the call to the agent`
        });
    }

    async executeToolCall(tool) {

        try {
            let calledTool = this.loadedTools[tool.function.name];
            let calledToolArgs = JSON.parse(tool.function.arguments);
            logOut(`[OpenAIService]`, `Executing tool call: ${calledTool} with args: ${calledToolArgs}`);

            // Now run the loaded tool
            let toolResponse = calledTool.calledTool(calledToolArgs);

            return toolResponse;
        } catch (error) {
            console.error(`[OpenAIService] Error executing tool ${calledTool}:`, error);
            return null;
        }
    }

    async generateResponse(role = 'user', prompt) {
        let fullResponse = '';
        let toolCallCollector = '';
        logOut(`[OpenAIService]`, `Generating response for ${role}: ${prompt}`);

        try {
            // Add the prompt message to history
            this.messages.push({ role: role, content: prompt });

            const stream = await this.openai.chat.completions.create({
                model: this.model,
                messages: this.messages,
                tools: this.toolManifest.tools,
                stream: true
            });

            logOut(`[OpenAIService]`, `Stream created`);

            for await (const chunk of stream) {
                if (this.isInterrupted) {
                    break;
                }

                const content = chunk.choices[0]?.delta?.content || '';
                const toolCalls = chunk.choices[0]?.delta?.tool_calls;

                if (content) {
                    logOut(`[OpenAIService]`, `Content: ${content}`);
                    fullResponse += content;
                    this.emit('llm.content', {
                        type: "text",
                        token: content,
                        last: false
                    });
                }

                if (toolCalls) {
                    for (const toolCall of toolCalls) {
                        if (toolCall.index === 0) {  // Initialize collector for first chunk
                            toolCallCollector = {
                                id: toolCall.id || '',
                                function: {
                                    name: '',
                                    arguments: ''
                                }
                            };
                        }
                        if (toolCall.function?.name) {
                            toolCallCollector.function.name = toolCall.function.name;
                        }
                        if (toolCall.function?.arguments) {
                            toolCallCollector.function.arguments += toolCall.function.arguments;
                        }
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

                    // Execute the tool
                    // const toolResult = await this.executeToolCall(toolCallObj);
                    let toolResult = null;
                    try {
                        let calledTool = this.loadedTools[toolCallObj.function.name];
                        let calledToolArgs = JSON.parse(toolCallObj.function.arguments);
                        logOut(`[OpenAIService]`, `Executing tool call: ${calledTool} with args: ${calledToolArgs}`);
                        toolResult = await calledTool.calledTool(calledToolArgs);

                        // Emit the tool result
                        this.emit('llm.toolResult', toolResult);

                    } catch (error) {
                        logError(`[OpenAIService]`, `Error executing tool ${toolCallObj.function.name}:`, error);
                    }

                    // If it's a handoff, we don't continue the conversation TODO: Should this break on end?
                    // if (toolResult.type === "end") {
                    //     return toolResult;
                    // }

                    // Add assistant response and tool result to history
                    this.messages.push({
                        role: "assistant",
                        content: fullResponse,
                        tool_calls: [toolCallObj]
                    });

                    this.messages.push({
                        role: "tool",
                        content: JSON.stringify(toolResult),
                        tool_call_id: toolCallObj.id
                    });

                    // Continue the conversation with tool results
                    const followUpStream = await this.openai.chat.completions.create({
                        model: this.model,
                        messages: this.messages,
                        stream: true
                    });

                    for await (const chunk of followUpStream) {
                        if (this.isInterrupted) {
                            break;
                        }
                        const content = chunk.choices[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            this.emit('llm.content', {
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
                this.messages.push({
                    role: "assistant",
                    content: fullResponse
                });
            }

            logOut(`[OpenAIService]`, `emitting last`);
            // Emit the final content with last=true
            this.emit('llm.content', {
                type: "text",
                token: '',
                last: true
            });

        } catch (error) {
            this.emit('llm.error', error);
            throw error;
        }
    }

    // Get current message history
    getMessages() {
        return this.messages;
    }

    // Clear message history
    clearMessages() {
        const systemMessage = this.messages[0];
        this.messages = [systemMessage];
    }

    // Interrupt the current stream processing
    interrupt() {
        this.isInterrupted = true;
    }

    // Reset the interruption flag
    resetInterrupt() {
        this.isInterrupted = false;
    }

    /**
     * Insert message into Context only. No immediate response required. Used for live agent handling.
     * This would be used when an agent interjects on the conversation and the LLM needs to be updated with the new context.
     */
    async insertMessageIntoContext(role = 'system', message) {
        this.messages.push({ role, content: message });
    }

    cleanup() {
        // Remove all event listeners
        this.removeAllListeners();
    }
}

module.exports = { OpenAIService };
