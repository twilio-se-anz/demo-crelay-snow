import { logOut, logError } from '../utils/logger.js';

/**
 * Interface for the function arguments
 */
interface EndCallFunctionArguments {
    summary: string;
    [key: string]: any;
}

/**
 * Interface for the response object
 */
interface EndCallResponse {
    toolType: string;
    toolData: {
        type: string;
        handoffData: string;
    };
}

/**
 * This is a CR specific tool type. It CR specific messages sent back via the Websocket.
 * 
 * @param functionArguments - The arguments for the end call function
 * @returns The response object for ending the call
 */
export default function (functionArguments: EndCallFunctionArguments): EndCallResponse {
    logOut('EndCall', `End call function called with arguments: ${JSON.stringify(functionArguments)}`);
    const response: EndCallResponse = {
        toolType: "crelay",
        toolData: {
            type: "end",
            handoffData: JSON.stringify({   // TODO: Why does this have to be stringified?
                reasonCode: "end-call",
                reason: "Ending the call",
                conversationSummary: functionArguments.summary,
            })
        }
    };
    logOut('EndCall', `Ending the call with endResponseContent: ${JSON.stringify(response, null, 4)}`);
    return response;
}
