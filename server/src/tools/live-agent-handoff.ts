import { logOut, logError } from '../utils/logger.js';

/**
 * Interface for the function arguments
 */
interface LiveAgentHandoffFunctionArguments {
    summary: string;
    [key: string]: any;
}

/**
 * Interface for the response object
 */
interface LiveAgentHandoffResponse {
    toolType: string;
    toolData: {
        type: string;
        handoffData: string;
    };
}

/**
 * This is a CR specific tool type. It CR specific messages sent back via the Websocket.
 * 
 * @param functionArguments - The arguments for the live agent handoff function
 * @returns The response object for handing off to a live agent
 */
export default function (functionArguments: LiveAgentHandoffFunctionArguments): LiveAgentHandoffResponse {
    logOut('LiveAgentHandoff', `LiveAgentHandoff function called with arguments: ${JSON.stringify(functionArguments)}`);
    const response: LiveAgentHandoffResponse = {
        toolType: "crelay",
        toolData: {
            type: "end",
            handoffData: JSON.stringify({   // TODO: Why does this have to be stringified?
                reasonCode: "live-agent-handoff",
                reason: functionArguments.summary
            })
        }
    };
    logOut('LiveAgentHandoff', `Transfer to agent response: ${JSON.stringify(response, null, 4)}`);
    return response;
}
