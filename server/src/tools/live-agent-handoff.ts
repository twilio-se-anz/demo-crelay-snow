import { logOut } from '../utils/logger.js';

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
    crelayData?: {
        type: "end";
        handoffData: string;
    };
}

/**
 * Initiates handoff to a live agent and triggers call transfer via WebSocket
 * 
 * @param functionArguments - The arguments for the live agent handoff function
 * @returns Simple response for conversation context with crelay data for WebSocket routing
 */
export default function (functionArguments: LiveAgentHandoffFunctionArguments): LiveAgentHandoffResponse {
    logOut('LiveAgentHandoff', `LiveAgentHandoff function called with arguments: ${JSON.stringify(functionArguments)}`);

    const handoffData = {
        type: "end" as const,
        handoffData: JSON.stringify({
            reasonCode: "live-agent-handoff",
            reason: functionArguments.summary
        })
    };

    // Return response with both conversation context and crelay data
    const response: LiveAgentHandoffResponse = {
        success: true,
        message: `Live agent handoff initiated`,
        summary: functionArguments.summary,
        crelayData: handoffData
    };

    logOut('LiveAgentHandoff', `Live agent handoff response: ${JSON.stringify(response)}`);
    return response;
}