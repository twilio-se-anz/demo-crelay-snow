const { logOut, logError } = require('../utils/logger');

/**
 * This is a CR specific tool. It CR specific messages sent back via the Websocket.
 * 
 * NOTE: Using module.exports so we do not have to deal with names in the export.
 * 
 * @param {*} functionArguments 
 * @returns 
 */
module.exports = function (functionArguments) {
    logOut('EndCall', `End call function called with arguments: ${JSON.stringify(functionArguments)}`);
    const response = {
        type: "end",
        handoffData: JSON.stringify({   // TODO: Why does this have to be stringified?
            reasonCode: "end-call",
            reason: "Ending the call",
            conversationSummary: functionArguments.summary,
        })
    };
    logOut('EndCall', `Ending the call with endResponseContent: ${JSON.stringify(response, null, 4)}`);
    return response;
}
