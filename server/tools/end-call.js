import { logOut, logError } from '../utils/logger.js';

/**
 * This is a CR specific tool type. It CR specific messages sent back via the Websocket.
 * 
 * @param {*} functionArguments 
 * @returns 
 */
export default function (functionArguments) {
    logOut('EndCall', `End call function called with arguments: ${JSON.stringify(functionArguments)}`);
    const response = {
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
