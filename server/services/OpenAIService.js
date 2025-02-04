const OpenAI = require('openai');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const { TWILIO_FUNCTIONS_URL } = process.env;
const { OPENAI_API_KEY } = process.env;
const { OPENAI_MODEL } = process.env;

class OpenAIService extends EventEmitter {
    constructor() {
        super();
        this.openai = new OpenAI();
        this.model = OPENAI_MODEL;
        this.messages = [];
        this.toolManifest = [];
        this.isInterrupted = false;
        this.promptContext = '';
    }

    // Static method to create and initialize an OpenAIService instance
    static async initialize() {
        const instance = new OpenAIService();
        await instance.loadContextAndManifest();
        return instance;
    }

    // Load context and manifest from local files
    async loadContextAndManifest() {
        try {
            this.promptContext = await fs.readFile(path.join(__dirname, '..', 'assets', 'context.md'), 'utf8');
            const toolManifestData = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'assets', 'toolManifest.json'), 'utf8'));

            this.messages = [
                { role: "system", content: this.promptContext },
            ];
            this.toolManifest = toolManifestData.tools || [];

            console.log(`[OpenAIService] Loaded context and manifest from local files`);
        } catch (error) {
            console.error(`[OpenAIService] Error loading context or manifest: ${error}`);
            throw error;
        }
    }

    setCallParameters(to, from, callSid) {
        this.twilioNumber = to;
        this.customerNumber = from;
        this.callSid = callSid;

        console.log(`[OpenAIService] Call to: ${this.twilioNumber} from: ${this.customerNumber} with call SID: ${this.callSid}`);
        this.messages.push({
            role: 'system',
            content: `The customer phone number or "from" number is ${this.customerNumber}, the callSid is ${this.callSid} and the number to send SMSs from is: ${this.twilioNumber}. Use this information throughout as the reference when calling any of the tools. Specifically use the callSid when you use the "transfer-to-agent" tool to transfer the call to the agent`
        });
    }

    async executeToolCall(toolCall) {
        console.log(`[OpenAIService] Executing tool call: ${JSON.stringify(toolCall, null, 4)}`);
        const { name, arguments: args } = toolCall.function;
        console.log(`[OpenAIService] Executing tool call: ${name} with args: ${args}`);

        switch (name) {
            case "live-agent-handoff":
                const handoffData = {
                    type: "end",
                    handoffData: JSON.stringify({
                        reasonCode: "live-agent-handoff",
                        reason: "Reason for the handoff",
                        conversationSummary: "handing over to agent TODO: Summary of the conversation",
                    })
                };
                this.emit('llm.live-agent-handoff', handoffData);
                return handoffData;

            case "send-dtmf":
                const dtmfData = {
                    type: "dtmf",
                    digits: JSON.parse(args).digits
                };
                this.emit('llm.send-dtmf', dtmfData);
                return dtmfData;

            case "end-call":
                const endCallData = {
                    type: "end",
                    handoffData: JSON.stringify({
                        reasonCode: "end-call",
                        reason: "Call ended by assistant"
                    })
                };
                this.emit('llm.end-call', endCallData);
                return endCallData;
        }

        try {
            // console.log(`[OpenAIService] Executing tool ${name} with args: ${args} to path: ${TWILIO_FUNCTIONS_URL}/tools/${name}`);
            const functionResponse = await fetch(`${TWILIO_FUNCTIONS_URL}/tools/${name}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: args,
            });

            return await functionResponse.json();
        } catch (error) {
            console.error(`[OpenAIService] Error executing tool ${name}:`, error);
            throw error;
        }
    }

    async generateResponse(role = 'user', prompt) {
        let fullResponse = '';
        let toolCallCollector = '';

        try {
            // Add the prompt message to history
            this.messages.push({ role: role, content: prompt });

            const stream = await this.openai.chat.completions.create({
                model: this.model,
                messages: this.messages,
                tools: this.toolManifest,
                stream: true
            });

            for await (const chunk of stream) {
                if (this.isInterrupted) {
                    break;
                }

                const content = chunk.choices[0]?.delta?.content || '';
                const toolCalls = chunk.choices[0]?.delta?.tool_calls;

                if (content) {
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
                        function: {
                            name: toolCallCollector.function.name,
                            arguments: toolCallCollector.function.arguments
                        }
                    };

                    // Execute the tool
                    const toolResult = await this.executeToolCall(toolCallObj);

                    // If it's a handoff, we don't continue the conversation
                    if (toolResult.type === "end") {
                        return toolResult;
                    }

                    // Add assistant response and tool result to history
                    this.messages.push({
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

            // Emit the final content with last=true
            this.emit('llm.content', {
                type: "text",
                token: '',
                last: true
            });

            this.emit('llm.done', fullResponse);
            return {
                type: "text",
                token: fullResponse,
                last: true
            };

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
}

module.exports = { OpenAIService };
