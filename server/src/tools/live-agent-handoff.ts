import { logOut } from '../utils/logger.js';
import { EndSessionMessage } from '../interfaces/ConversationRelay.js';

/**
 * Interface for the function arguments
 */
interface LiveAgentHandoffFunctionArguments {
    summary: string;
    [key: string]: any;
}

/**
 * Interface for the response object - simple response for conversation
 */
interface LiveAgentHandoffResponse {
    success: boolean;
    message: string;
    summary: string;
    outgoingMessage?: EndSessionMessage;
}

/**
 * Initiates handoff to a live agent and triggers call transfer via WebSocket
 * 
 * @param functionArguments - The arguments for the live agent handoff function
 * @returns Simple response for conversation context with outgoing message for WebSocket routing
 */
export default function (functionArguments: LiveAgentHandoffFunctionArguments): LiveAgentHandoffResponse {
    logOut('LiveAgentHandoff', `LiveAgentHandoff function called with arguments: ${JSON.stringify(functionArguments)}`);

    // Return response with both conversation context and outgoing message
    const response: LiveAgentHandoffResponse = {
        success: true,
        message: `Live agent handoff initiated`,
        summary: functionArguments.summary,
        outgoingMessage: {
            type: "end",
            handoffData: JSON.stringify({
                reasonCode: "live-agent-handoff",
                reason: functionArguments.summary
            })
        }
    };

    logOut('LiveAgentHandoff', `Live agent handoff response: ${JSON.stringify(response)}`);
    return response;
}