const { logOut, logError } = require('../utils/logger');

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
    logOut('LLM', `Ending the call with endResponseContent: ${JSON.stringify(response, null, 4)}`);
    return response;
}
