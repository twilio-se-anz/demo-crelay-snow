/**
 * @class ConversationRelayService
 * @extends EventEmitter
 * @description Manages conversation relay between users and an LLM (Language Learning Model) service.
 * This service orchestrates:
 * 
 * 1. Message Flow Management:
 *    - Handles incoming messages from users
 *    - Processes outgoing messages from agents
 *    - Manages LLM service responses
 *    - Controls conversation context
 *    - Handles user interruptions
 * 
 * 2. Event Management:
 *    - Emits events for responses, silence, prompts
 *    - Handles DTMF (touch-tone) signals
 *    - Manages live agent handoff events
 *    - Controls conversation termination
 *    - Processes interrupt signals
 * 
 * 3. Silence Detection:
 *    - Monitors for conversation inactivity
 *    - Sends reminder messages
 *    - Handles call termination on extended silence
 * 
 * 4. Interrupt Handling:
 *    - Detects when users interrupt the AI's response
 *    - Stops the current response stream
 *    - Processes the new user input immediately
 *    - Enables more natural conversation flow
 * 
 * The service integrates with a Response Service (LLM) to process messages and
 * maintain conversation context, while managing timeouts and cleanup.
 * 
 * @property {Object} responseService - LLM service for processing responses
 * @property {SilenceHandler} silenceHandler - Handles silence detection
 * @property {string|null} logMessage - Utility log message with call SID
 * 
 * Events Emitted:
 * - conversationRelay.response: LLM response received
 * - conversationRelay.end: Conversation ended
 * - conversationRelay.dtmf: DTMF signal received
 * - conversationRelay.handoff: Live agent handoff requested
 * - conversationRelay.silence: Silence detected
 * - conversationRelay.prompt: Voice prompt received
 * - conversationRelay.agentMessage: Direct agent message
 * 
 * @example
 * // Initialize the service
 * const responseService = new LlmService();
 * const relayService = new ConversationRelayService(responseService);
 * 
 * // Set up event handlers
 * relayService.on('conversationRelay.response', (response) => {
 *   console.log('LLM Response:', response);
 * });
 * 
 * // Start conversation
 * await relayService.setup(sessionData);
 * 
 * // Handle incoming message
 * await relayService.incomingMessage({
 *   type: 'prompt',
 *   voicePrompt: 'Hello, how can I help?'
 * });
 * 
 * // Cleanup when done
 * relayService.cleanup();
 */

import { EventEmitter } from 'events';
import { SilenceHandler } from './SilenceHandler.js';
import { logOut, logError } from '../utils/logger.js';
import { ResponseService } from '../interfaces/ResponseService.js';
import { OpenAIService } from './OpenAIService.js';
import type { SessionData, IncomingMessage, OutgoingMessage, ConversationRelayService as IConversationRelayService } from '../interfaces/ConversationRelayService.js';

class ConversationRelayService extends EventEmitter implements IConversationRelayService {
    private responseService: ResponseService;
    private sessionData: SessionData;
    private silenceHandler: SilenceHandler | null;
    private logMessage: string | null;
    private accumulatedTokens: string;

    /**
     * Creates a new ConversationRelayService instance using the factory method.
     * Use ConversationRelayService.create() instead of constructor directly.
     * 
     * @param {ResponseService} responseService - LLM service for processing responses
     * @param {SessionData} sessionData - Session data for the conversation
     * @throws {Error} If responseService is not provided
     */
    private constructor(responseService: ResponseService, sessionData: SessionData) {
        super();
        if (!responseService) {
            throw new Error('LLM service is required');
        }
        this.responseService = responseService;
        this.sessionData = sessionData;
        this.silenceHandler = new SilenceHandler();
        this.logMessage = null;     // Utility log message
        this.accumulatedTokens = '';

        // Set up response handler for LLM responses. These are proxied to separate from Web Server
        this.responseService.on('responseService.content', (response) => {
            if (!response.last) {
                // Accumulate tokens while last is false
                this.accumulatedTokens += response.token || '';
            } else {
                // Display complete accumulated message when last becomes true
                logOut(`Conversation Relay`, `Complete response: "${this.accumulatedTokens}"`);

                // Reset accumulated tokens for next response
                this.accumulatedTokens = '';
            }
            this.emit('conversationRelay.outgoingMessage', response);
        });

        // Check the tool call result if for CR specific tool calls, as these need to be sent to the WS server
        this.responseService.on('responseService.toolResult', (toolResult) => {
            logOut(`Conversation Relay`, `Tool result received: ${JSON.stringify(toolResult)}`);
            // Check if the tool result is for the conversation relay
            if (toolResult.toolType === "crelay") {
                // Send the tool result to the WS server
                this.emit('conversationRelay.outgoingMessage', toolResult.toolData);
            }
        });
        logOut(`Conversation Relay`, `Service constructed`);
    }

    /**
     * Factory method to create a ConversationRelayService instance.
     * Handles async OpenAI service creation internally.
     * 
     * @param {SessionData} sessionData - Session data for the conversation
     * @param {string} contextFile - Context file path or environment variable fallback
     * @param {string} toolManifestFile - Tool manifest file path or environment variable fallback
     * @param {string} [callSid] - Optional call SID for event handling
     * @returns {Promise<ConversationRelayService>} Initialized service instance
     */
    static async create(
        sessionData: SessionData, 
        contextFile: string, 
        toolManifestFile: string,
        callSid?: string
    ): Promise<ConversationRelayService> {
        logOut('Conversation Relay', 'Creating OpenAI Response Service');
        const responseService = await OpenAIService.create(contextFile, toolManifestFile);

        // Add call SID event listener if provided
        if (callSid) {
            responseService.on(`responseService.${callSid}`, (responseMessage: any) => {
                logOut('Conversation Relay', `Got a call SID event for the response service: ${JSON.stringify(responseMessage)}`);
                // This will be handled by the instance, but we set up the listener here
            });
        }

        const instance = new ConversationRelayService(responseService, sessionData);
        
        // Set up call SID event forwarding if provided
        if (callSid) {
            responseService.on(`responseService.${callSid}`, (responseMessage: any) => {
                instance.emit(`conversationRelay.${callSid}`, responseMessage);
            });
        }

        return instance;
    }

    /**
     * Initializes a new conversation relay session.
     * Sets up initial context, silence monitoring, and prepares the conversation flow.
     * This method is called once at the start of a new conversation.
     * 
     * @async
     * @param {SessionData} sessionData - Session and parameter information
     * @emits conversationRelay.silence
     * @returns {Promise<void>} Resolves when setup is complete
     */
    async setupMessage(sessionData: SessionData): Promise<void> {
        // Pull out session data parts into own variables
        const { parameterData, setupData } = sessionData;
        this.logMessage = `Call SID: ${setupData.callSid}] `;

        // This first system message pushes all the data into the Response Service in preparation for the conversation under generateResponse.
        const initialMessage = `These are all the details of the call: ${JSON.stringify(setupData, null, 4)} and the parameter data needed to complete your objective: ${JSON.stringify(parameterData, null, 4)}. Use this to complete your objective`;
        await this.responseService.insertMessage('system', initialMessage);

        // Initialize and start silence monitoring. When triggered it will emit a 'silence' event with a message
        if (this.silenceHandler) {
            this.silenceHandler.startMonitoring((silenceMessage) => {
                // Add callSid to silence message if it's a text message
                if (silenceMessage.type === 'text') {
                    logOut(`Conversation Relay`, `${this.logMessage} Sending silence breaker message: ${JSON.stringify(silenceMessage)}`);
                } else if (silenceMessage.type === 'end') {
                    logOut(`Conversation Relay`, `${this.logMessage} Ending call due to silence: ${JSON.stringify(silenceMessage)}`);
                }
                this.emit('conversationRelay.silence', silenceMessage);
            });
        }

        logOut(`Conversation Relay`, `${this.logMessage} Setup complete`);
    }

    /**
     * Processes incoming messages from the conversation relay.
     * Handles different message types:
     * - info: System information messages
     * - prompt: Voice prompts requiring LLM response
     * - interrupt: User interruption events
     * - dtmf: Touch-tone signals
     * - setup: Initial setup messages
     * 
     * @async
     * @param {IncomingMessage} message - Incoming message object
     * @emits conversationRelay.prompt
     * @throws {Error} If message handling fails
     * @returns {Promise<void>} Resolves when message is processed
     */
    async incomingMessage(message: IncomingMessage): Promise<void> {
        try {
            // Only reset silence timer for non-info messages
            if (this.silenceHandler && message.type !== 'info') {
                this.silenceHandler.resetTimer();
            }

            switch (message.type) {
                case 'setup':
                    logOut(`Conversation Relay`, `${this.logMessage} SETUP: ${JSON.stringify(message)}`);
                    await this.setupMessage(this.sessionData);
                    break;
                case 'prompt':
                    logOut(`Conversation Relay`, `${this.logMessage} PROMPT ${message.voicePrompt}`);
                    await this.responseService.generateResponse('user', message.voicePrompt || '');
                    break;
                case 'dtmf':
                    logOut(`Conversation Relay`, `${this.logMessage} DTMF: ${message.digit}`);
                    break;
                case 'interrupt':
                    logOut(`Conversation Relay`, `${this.logMessage} ........ INTERRUPT: ${message.utteranceUntilInterrupt}`);
                    // Interrupt the streaming so it does not continue to send the previous generated stream.
                    this.responseService.interrupt();
                    break;
                case 'info':
                    logOut(`Conversation Relay`, `${this.logMessage} INFO: ${JSON.stringify(message, null, 4)}`);
                    break;
                case 'error':
                    logOut(`Conversation Relay`, `${this.logMessage} ERROR: ${message.description}`);
                    break;
                default:
                    logError(`Conversation Relay`, `${this.logMessage} UNKNOWN: "${(message as any).type}"`);
            }
        } catch (error) {
            logError(`Conversation Relay`, `${this.logMessage} Error in message handling: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Conversation Relay Switch Message type ${(message as any).type}: ${this.logMessage} Error in message handling: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handles outgoing messages to be sent to Twilio via WebSocket.
     * Sends structured messages directly to the client without inserting into conversation context.
     * Use insertMessage() for adding content to conversation history.
     * 
     * @async
     * @param {OutgoingMessage} message - Structured outgoing message object
     * @emits conversationRelay.outgoingMessage
     * @throws {Error} If message handling fails
     * @returns {Promise<void>} Resolves when message is processed
     */
    async outgoingMessage(message: OutgoingMessage): Promise<void> {
        try {
            logOut(`Conversation Relay`, `${this.logMessage} Outgoing structured message: ${JSON.stringify(message)}`);
            this.emit('conversationRelay.outgoingMessage', message);
        } catch (error) {
            logError(`Conversation Relay`, `${this.logMessage} Error in outgoing message handling: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Inserts a message into the response service.
     * Proxy method for direct access to response service functionality.
     * 
     * @async
     * @param {string} role - Message role (system, user, assistant)
     * @param {string} content - Message content
     * @returns {Promise<void>} Resolves when message is inserted
     */
    async insertMessage(role: 'system' | 'user' | 'assistant', content: string): Promise<void> {
        await this.responseService.insertMessage(role, content);
    }

    /**
     * Updates the context and manifest files for the response service.
     * Proxy method for direct access to response service functionality.
     * 
     * @param {string} contextFile - New context file path
     * @param {string} toolManifestFile - New tool manifest file path
     */
    async updateContextAndManifest(contextFile: string, toolManifestFile: string): Promise<void> {
        await this.responseService.updateContextAndManifest(contextFile, toolManifestFile);
    }

    /**
     * Performs cleanup of service resources.
     * - Cleans up silence handler
     * - Cleans up LLM service
     * - Removes all event listeners
     * 
     * Call this method when the conversation is complete to prevent memory leaks
     * and ensure proper resource cleanup.
     */
    cleanup(): void {
        if (this.silenceHandler) {
            this.silenceHandler.cleanup();
            this.silenceHandler = null;
        }
        // Clean up the LLM service
        if (this.responseService) {
            this.responseService.cleanup();
        }
        // Remove all event listeners from this instance
        this.removeAllListeners();
    }
}

export { ConversationRelayService };
