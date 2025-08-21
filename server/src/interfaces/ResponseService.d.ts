/**
 * Interface for Response Service implementations
 * Defines the contract that all LLM services must implement for conversation handling
 */

import { EventEmitter } from 'events';

/**
 * Interface for content response chunks
 */
export interface ContentResponse {
    type: string;
    token: string;
    last: boolean;
}

/**
 * Interface for tool result events
 */
export interface ToolResultEvent {
    toolType: string;  // "crelay" for ConversationRelay-specific tools
    toolData: any;     // The actual tool response data
}

/**
 * Interface for tool result from individual tool execution
 */
export interface ToolResult {
    success: boolean;
    message: string;
    [key: string]: any; // Allows additional properties like digits, recipient, summary, etc.
}

/**
 * Interface that all Response Service implementations must follow
 * Extends EventEmitter to provide standardized event handling
 * 
 * Standard Events Emitted:
 * - 'responseService.content': ContentResponse chunks during streaming
 * - 'responseService.toolResult': ToolResultEvent when tools execute
 * - 'responseService.error': Error events during processing
 */
export interface ResponseService extends EventEmitter {
    /**
     * Generates a streaming response from the LLM service
     * 
     * @param role - Message role ('user' or 'system')
     * @param prompt - Input message content
     * @returns Promise that resolves when response generation starts
     * @emits responseService.content - Response chunks during streaming
     * @emits responseService.toolResult - Tool execution results
     * @emits responseService.error - Error events
     */
    generateResponse(role: 'user' | 'system', prompt: string): Promise<void>;

    /**
     * Inserts a message into conversation context without generating a response
     * 
     * @param role - Message role ('system', 'user', or 'assistant')
     * @param message - Message content to add to context
     * @returns Promise that resolves when message is inserted
     */
    insertMessage(role: 'system' | 'user' | 'assistant', message: string): Promise<void>;

    /**
     * Interrupts current response generation
     * Used when user interrupts AI during response to stop streaming
     */
    interrupt(): void;

    /**
     * Updates the context and manifest files for the response service
     * 
     * @param contextFile - New context file path
     * @param toolManifestFile - New tool manifest file path
     * @returns Promise that resolves when update is complete
     */
    updateContextAndManifest(contextFile: string, toolManifestFile: string): Promise<void>;

    /**
     * Performs cleanup of service resources
     * Removes event listeners and cleans up any active connections
     */
    cleanup(): void;
}