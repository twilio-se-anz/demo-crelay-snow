/**
 * Send SMS function. This is an example of a NON-CR type tool type and will not be sent back via CR. 
 * It also shows the toolType "error" in the response.
 * Although the actual SMS API code could be inserted directly here, we are using the common TwilioService instead, to send the SMS to keep the code contained.
 * 
 */
import { logOut, logError } from '../utils/logger.js';
import { TwilioService } from '../services/TwilioService.js';

/**
 * Interface for the function arguments
 */
interface SendSMSFunctionArguments {
    to: string;
    message: string;
    [key: string]: any;
}

/**
 * Interface for the success response object
 */
interface SendSMSSuccessResponse {
    toolType: "tool";
    toolData: string;
}

/**
 * Interface for the error response object
 */
interface SendSMSErrorResponse {
    toolType: "error";
    toolData: string;
}

/**
 * Type for the combined response types
 */
type SendSMSResponse = SendSMSSuccessResponse | SendSMSErrorResponse;

/**
 * Sends an SMS message using the Twilio service
 * 
 * @param functionArguments - The arguments for the send SMS function
 * @returns A response object indicating success or failure
 */
export default async function (functionArguments: SendSMSFunctionArguments): Promise<SendSMSResponse> {
    logOut('SendSMS', `Send SMS function called with arguments: ${JSON.stringify(functionArguments)}`);
    const twilioService = new TwilioService();

    try {
        // Send the SMS
        const result = await twilioService.sendSMS(functionArguments.to, functionArguments.message);

        if (!result) {
            logError('SendSMS', `Failed to send SMS to ${functionArguments.to}`);
            const response: SendSMSErrorResponse = {
                toolType: "error",
                toolData: `SMS send failed to the number`
            };
            return response;
        }

        const response: SendSMSSuccessResponse = {
            toolType: "tool",
            toolData: `SMS sent to the number successfully to ${functionArguments.to}`
        };
        logOut('SendSMS', `Sent SMS: ${JSON.stringify(response, null, 4)}`);
        return response;
    } catch (error) {
        logError('SendSMS', `Exception when sending SMS: ${error instanceof Error ? error.message : String(error)}`);
        const response: SendSMSErrorResponse = {
            toolType: "error",
            toolData: `SMS send failed due to an error: ${error instanceof Error ? error.message : String(error)}`
        };
        return response;
    }
}
