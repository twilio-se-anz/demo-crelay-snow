const { logOut, logError } = require('../utils/logger');

function LiveAgentHandoff(functionArguments) {
    logOut('LiveAgentHandoff', `LiveAgentHandoff function called with arguments: ${JSON.stringify(functionArguments)}`);
    const response = {
        type: "end",
        handoffData: JSON.stringify({   // TODO: Why does this have to be stringified?
            reasonCode: "live-agent-handoff",
            reason: functionArguments.summary
        })
    };
    logOut('LLM', `Transfer to agent response: ${JSON.stringify(response, null, 4)}`);
    return response;

}

module.exports = { LiveAgentHandoff }
