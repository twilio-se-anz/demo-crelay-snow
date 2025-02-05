const { logOut, logError } = require('../utils/logger');
const { twilioService } = require('../services/twilioService');

function SendSMS(functionArguments) {

    logOut('SendSMS', `Send SMS function called with arguments: ${JSON.stringify(functionArguments)}`);

    // Send the SMS
    const result = twilioService.sendSMS(functionArguments.to, functionArguments.message);

    let response = '';

    if (!result) {
        logError('SendSMS', `Failed to send SMS to ${functionArguments.to}`);
        response = `SMS send failed to the number`;
    }

    response = `SMS sent to the number successfully to ${functionArguments.to}`;
    logOut('LLM', `Ending the call with endResponseContent: ${JSON.stringify(response, null, 4)}`);

    return response;
}

module.exports = { SendSMS }