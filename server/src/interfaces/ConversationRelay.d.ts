/**
 * Handler function type for outgoing messages from ConversationRelay services
 */
export type OutgoingMessageHandler = (message: OutgoingMessage) => void;

/**
 * Handler function type for call SID specific events from LLM services
 */
export type CallSidEventHandler = (callSid: string, responseMessage: any) => void;

/**
 * Handler function type for silence events from ConversationRelay services
 * Handles both silence breaker messages and call termination messages
 */
export type SilenceEventHandler = (message: OutgoingMessage) => void;

/**
 * Interface for session data
 */
export interface SessionData {
    parameterData: Record<string, any>;
    setupData: {
        callSid: string;
        [key: string]: any;
    };
}

/**
 * Setup message - sent immediately after WebSocket connection
 */
export interface SetupMessage {
    type: 'setup';
    sessionId?: string;
    callSid?: string;
    from?: string;
    to?: string;
    direction?: string;
    customParameters?: {
        callReference?: string;
        contextFile?: string;
        toolManifestFile?: string;
    };
    [key: string]: any;
}

/**
 * Prompt message - sent when caller speaks
 */
export interface PromptMessage {
    type: 'prompt';
    voicePrompt: string;
    language?: string;
    last?: boolean;
    [key: string]: any;
}

/**
 * DTMF message - sent when caller presses a key
 */
export interface DTMFMessage {
    type: 'dtmf';
    digit: string;
    [key: string]: any;
}

/**
 * Interrupt message - sent when caller interrupts TTS playback
 */
export interface InterruptMessage {
    type: 'interrupt';
    utteranceUntilInterrupt: string;
    durationUntilInterruptMs?: number;
    [key: string]: any;
}

/**
 * Info message - for informational updates
 */
export interface InfoMessage {
    type: 'info';
    description?: string;
    [key: string]: any;
}

/**
 * Error message - sent when an error occurs
 */
export interface ErrorMessage {
    type: 'error';
    description: string;
    [key: string]: any;
}

/**
 * Union type for all incoming message types
 */
export type IncomingMessage = SetupMessage | PromptMessage | DTMFMessage | InterruptMessage | InfoMessage | ErrorMessage;

/**
 * Text tokens message - sends text to be converted to speech
 */
export interface TextTokensMessage {
    type: 'text';
    token: string;
    last?: boolean;
    lang?: string;
    interruptible?: boolean;
    preemptible?: boolean;
}

/**
 * Play media message - plays audio from a URL
 */
export interface PlayMediaMessage {
    type: 'play';
    source: string;
    loop?: number;
    preemptible?: boolean;
    interruptible?: boolean;
}

/**
 * Send digits message - sends DTMF digits
 */
export interface SendDigitsMessage {
    type: 'sendDigits';
    digits: string;
}

/**
 * Switch language message - changes TTS and transcription languages
 */
export interface SwitchLanguageMessage {
    type: 'language';
    ttsLanguage?: string;
    transcriptionLanguage?: string;
}

/**
 * End session message - terminates the conversation session
 */
export interface EndSessionMessage {
    type: 'end';
    handoffData?: string;
}

/**
 * Union type for all outgoing message types
 */
export type OutgoingMessage = TextTokensMessage | PlayMediaMessage | SendDigitsMessage | SwitchLanguageMessage | EndSessionMessage;

/**
 * ConversationRelayService - manages conversation relay between users and an LLM service
 */
export interface ConversationRelay {

    /**
     * Handler setters - called once during setup to register event handlers
     */
    setOutgoingMessageHandler(handler: OutgoingMessageHandler): void;
    setCallSidEventHandler(handler: CallSidEventHandler): void;
    setSilenceEventHandler(handler: SilenceEventHandler): void;

    /**
     * Initializes a new conversation relay session
     */
    setupMessage(sessionData: SessionData): Promise<void>;

    /**
     * Processes incoming messages from the conversation relay
     */
    incomingMessage(message: IncomingMessage): Promise<void>;

    /**
     * Handles outgoing messages to be sent to Twilio via WebSocket
     */
    outgoingMessage(message: OutgoingMessage): Promise<void>;

    /**
     * Inserts a message into the response service
     */
    insertMessage(role: 'system' | 'user' | 'assistant', content: string): Promise<void>;

    /**
     * Updates the context file for the response service
     */
    updateContext(contextFile: string): Promise<void>;

    /**
     * Updates the tool manifest file for the response service
     */
    updateTools(toolManifestFile: string): Promise<void>;

    /**
     * Performs cleanup of service resources
     */
    cleanup(): void;
}

/**
 * ConversationRelayService class declaration
 */
export declare class ConversationRelayService implements ConversationRelay {
    static create(
        sessionData: SessionData,
        contextFile: string,
        toolManifestFile: string,
        callSid?: string
    ): Promise<ConversationRelayService>;

    setOutgoingMessageHandler(handler: OutgoingMessageHandler): void;
    setCallSidEventHandler(handler: CallSidEventHandler): void;
    setSilenceEventHandler(handler: SilenceEventHandler): void;
    setupMessage(sessionData: SessionData): Promise<void>;
    incomingMessage(message: IncomingMessage): Promise<void>;
    outgoingMessage(message: OutgoingMessage): Promise<void>;
    insertMessage(role: 'system' | 'user' | 'assistant', content: string): Promise<void>;
    updateContext(contextFile: string): Promise<void>;
    updateTools(toolManifestFile: string): Promise<void>;
    cleanup(): void;
}