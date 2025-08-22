/**
 * Send Verification function - sends an OTP verification code via Twilio Verify API
 * This tool initiates the verification process by sending a code to the specified phone number
 */
import { logOut, logError } from '../utils/logger.js';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Interface for the function arguments
 */
interface SendVerificationFunctionArguments {
    to: string;
    channel?: 'sms' | 'call'; // Default to SMS
    [key: string]: any;
}

/**
 * Interface for the tool event (passed by ResponseService)
 */
interface ToolEvent {
    emit: (eventType: string, data: any) => void;
    log: (message: string) => void;
    logError: (message: string) => void;
}

/**
 * Interface for the response object
 */
interface SendVerificationResponse {
    success: boolean;
    message: string;
    recipient?: string;
    sid?: string;
    status?: string;
}

/**
 * Sends a verification code using Twilio Verify API
 * 
 * @param functionArguments - The arguments for the send verification function
 * @param toolEvent - Tool event for logging (provided by ResponseService)
 * @returns A response object for conversation context
 */
export default async function (functionArguments: SendVerificationFunctionArguments, toolEvent?: ToolEvent): Promise<SendVerificationResponse> {
    const log = toolEvent?.log || ((msg: string) => logOut('SendVerification', msg));
    const logError_ = toolEvent?.logError || ((msg: string) => logError('SendVerification', msg));

    log(`Send verification function called with arguments: ${JSON.stringify(functionArguments)}`);

    // Get Twilio credentials from environment
    const accountSid = process.env.ACCOUNT_SID;
    const authToken = process.env.AUTH_TOKEN;
    const verifyServiceSid = process.env.VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
        const errorMessage = 'Missing required Twilio credentials in environment variables';
        logError_(errorMessage);
        return {
            success: false,
            message: errorMessage
        };
    }

    const client = twilio(accountSid, authToken);

    try {
        // Send verification code
        const verification = await client.verify.v2
            .services(verifyServiceSid)
            .verifications
            .create({
                to: functionArguments.to,
                channel: functionArguments.channel || 'sms'
            });

        const response: SendVerificationResponse = {
            success: true,
            message: `Verification code sent successfully via ${verification.channel}`,
            recipient: functionArguments.to,
            sid: verification.sid,
            status: verification.status
        };

        log(`Verification code sent successfully: ${JSON.stringify(response)}`);
        return response;

    } catch (error) {
        const errorMessage = `Verification send failed: ${error instanceof Error ? error.message : String(error)}`;
        logError_(errorMessage);

        return {
            success: false,
            message: errorMessage
        };
    }
}