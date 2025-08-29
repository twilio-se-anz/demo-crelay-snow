import { logOut } from '../utils/logger.js';
import { PlayMediaMessage } from '../interfaces/ConversationRelay.js';

/**
 * Interface for the function arguments
 */
interface PlayMediaFunctionArguments {
    source: string;
    loop?: number;
    preemptible?: boolean;
    interruptible?: boolean;
    [key: string]: any;
}

/**
 * Interface for the response object - simple response for conversation
 */
interface PlayMediaResponse {
    success: boolean;
    message: string;
    source: string;
    loop?: number;
    preemptible?: boolean;
    interruptible?: boolean;
    outgoingMessage?: PlayMediaMessage;
}

/**
 * Plays audio media from a URL via WebSocket
 * 
 * @param functionArguments - The arguments for the play media function
 * @returns Simple response for conversation context with outgoing message for WebSocket routing
 */
export default function (functionArguments: PlayMediaFunctionArguments): PlayMediaResponse {
    logOut('PlayMedia', `Play media function called with arguments: ${JSON.stringify(functionArguments)}`);

    // Validate that source URL is provided
    if (!functionArguments.source) {
        const errorResponse: PlayMediaResponse = {
            success: false,
            message: 'Source URL is required to play media',
            source: ''
        };
        logOut('PlayMedia', `Play media validation failed: ${JSON.stringify(errorResponse)}`);
        return errorResponse;
    }

    // Return response with both conversation context and outgoing message
    const response: PlayMediaResponse = {
        success: true,
        message: `Media playback initiated successfully`,
        source: functionArguments.source,
        loop: functionArguments.loop,
        preemptible: functionArguments.preemptible,
        interruptible: functionArguments.interruptible,
        outgoingMessage: {
            type: "play",
            source: functionArguments.source,
            loop: functionArguments.loop,
            preemptible: functionArguments.preemptible,
            interruptible: functionArguments.interruptible
        }
    };

    logOut('PlayMedia', `Play media response: ${JSON.stringify(response)}`);
    return response;
}