/**
 * Handler function types for dependency injection
 * Used to replace EventEmitter pattern with direct function calls for better type safety
 */

import { ContentResponse, ToolResultEvent } from '../interfaces/ResponseService.js';

/**
 * Handler function type for content responses from LLM services
 */
export type ContentHandler = (response: ContentResponse) => void;

/**
 * Handler function type for tool result events from LLM services
 */
export type ToolResultHandler = (toolResult: ToolResultEvent) => void;

/**
 * Handler function type for error events from LLM services
 */
export type ErrorHandler = (error: Error) => void;

/**
 * Handler function type for call SID specific events from LLM services
 */
export type CallSidEventHandler = (callSid: string, responseMessage: any) => void;