/**
 * Check Verification function - verifies an OTP code via Twilio Verify API
 * This tool checks if the provided verification code is correct for the phone number
 */
import { logOut, logError } from '../utils/logger.js';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Interface for the function arguments
 */
interface CheckVerificationFunctionArguments {
    to: string;
    code: string;
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
interface CheckVerificationResponse {
    success: boolean;
    message: string;
    verified: boolean;
    recipient?: string;
    status?: string;
    sid?: string;
}

/**
 * Checks a verification code using Twilio Verify API
 * 
 * @param functionArguments - The arguments for the check verification function
 * @param toolEvent - Tool event for logging (provided by ResponseService)
 * @returns A response object for conversation context
 */
export default async function (functionArguments: CheckVerificationFunctionArguments, toolEvent?: ToolEvent): Promise<CheckVerificationResponse> {
    const log = toolEvent?.log || ((msg: string) => logOut('CheckVerification', msg));
    const logError_ = toolEvent?.logError || ((msg: string) => logError('CheckVerification', msg));

    log(`Check verification function called with arguments: ${JSON.stringify({ to: functionArguments.to, code: '[REDACTED]' })}`);

    // Get Twilio credentials from environment
    const accountSid = process.env.ACCOUNT_SID;
    const authToken = process.env.AUTH_TOKEN;
    const verifyServiceSid = process.env.VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
        const errorMessage = 'Missing required Twilio credentials in environment variables';
        logError_(errorMessage);
        return {
            success: false,
            message: errorMessage,
            verified: false
        };
    }

    const client = twilio(accountSid, authToken);

    try {
        // Check verification code
        const verificationCheck = await client.verify.v2
            .services(verifyServiceSid)
            .verificationChecks
            .create({
                to: functionArguments.to,
                code: functionArguments.code
            });

        const isVerified = verificationCheck.status === 'approved';

        const response: CheckVerificationResponse = {
            success: true,
            message: isVerified ? 'Verification successful' : 'Verification failed - invalid code',
            verified: isVerified,
            recipient: functionArguments.to,
            status: verificationCheck.status,
            sid: verificationCheck.sid
        };

        log(`Verification check completed: ${JSON.stringify({ ...response, sid: '[REDACTED]' })}`);
        return response;

    } catch (error) {
        const errorMessage = `Verification check failed: ${error instanceof Error ? error.message : String(error)}`;
        logError_(errorMessage);

        return {
            success: false,
            message: errorMessage,
            verified: false
        };
    }
}