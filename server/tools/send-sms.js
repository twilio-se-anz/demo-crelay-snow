/**
 * Send SMS function. This is an example of a NON-CR type tool type and will not be sent back via CR. 
 * It also shows the toolType "error" in the response.
 * Although the actual SMS API code could be inserted directly here, we are using the common TwilioService instead, to send the SMS to keep the code contained.
 * 
 */
import { logOut, logError } from '../utils/logger.js';
import { TwilioService } from '../services/TwilioService.js';

export default async function (functionArguments) {
    logOut('SendSMS', `Send SMS function called with arguments: ${JSON.stringify(functionArguments)}`);
    const twilioService = new TwilioService();

    // Send the SMS
    const result = await twilioService.sendSMS(functionArguments.to, functionArguments.message);
    let response = '';

    if (!result) {
        logError('SendSMS', `Failed to send SMS to ${functionArguments.to}`);
        response = {
            toolType: "error",
            toolData: `SMS send failed to the number`
        }
        return response;
    }

    response = {
        toolType: "tool",
        toolData: `SMS sent to the number successfully to ${functionArguments.to}`
    }
    logOut('SendSMS', `Sent SMS: ${JSON.stringify(response, null, 4)}`);
    return response;
}
