import { logOut } from '../utils/logger.js';
import { EndSessionMessage } from '../interfaces/ConversationRelay.js';

/**
 * Interface for the function arguments
 */
interface EndCallFunctionArguments {
    summary: string;
    [key: string]: any;
}

/**
 * Interface for the response object - simple response for conversation
 */
interface EndCallResponse {
    success: boolean;
    message: string;
    summary: string;
    outgoingMessage?: EndSessionMessage;
}

/**
 * Ends the call with a summary and triggers call termination via WebSocket
 * 
 * @param functionArguments - The arguments for the end call function
 * @returns Simple response for conversation context with outgoing message for WebSocket routing
 */
export default function (functionArguments: EndCallFunctionArguments): EndCallResponse {
    logOut('EndCall', `End call function called with arguments: ${JSON.stringify(functionArguments)}`);

    // Return response with both conversation context and outgoing message
    const response: EndCallResponse = {
        success: true,
        message: `Call ended successfully`,
        summary: functionArguments.summary,
        outgoingMessage: {
            type: "end",
            handoffData: JSON.stringify({
                reasonCode: "end-call",
                reason: "Ending the call",
                conversationSummary: functionArguments.summary,
            })
        }
    };

    logOut('EndCall', `End call response: ${JSON.stringify(response)}`);
    return response;
}