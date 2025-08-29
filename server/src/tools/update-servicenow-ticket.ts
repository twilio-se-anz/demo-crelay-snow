/**
 * Update ServiceNow Ticket function - returns standard responses for conversation context.
 * This is a generic LLM tool that OpenAI processes normally.
 */
import { logOut, logError } from '../utils/logger.js';
import { ServiceNowService } from '../services/ServiceNowService.js';

/**
 * Interface for the function arguments
 */
interface UpdateServiceNowTicketArguments {
    sys_id: string;
    short_description?: string;
    description?: string;
    category?: string;
    subcategory?: string;
    priority?: string;
    state?: string;
    assignment_group?: string;
    work_notes?: string;
    [key: string]: any;
}

/**
 * Interface for the response object - simplified
 */
interface UpdateServiceNowTicketResponse {
    success: boolean;
    message: string;
    ticket_number?: string;
    ticket_id?: string;
}

/**
 * Updates a ServiceNow incident ticket using the ServiceNow service
 * Returns a simple response that gets inserted into conversation context
 * 
 * @param functionArguments - The arguments for the update ticket function
 * @returns A simple response object for conversation context
 */
export default async function (functionArguments: UpdateServiceNowTicketArguments): Promise<UpdateServiceNowTicketResponse> {
    const log = (msg: string) => logOut('UpdateServiceNowTicket', msg);
    const logError_ = (msg: string) => logError('UpdateServiceNowTicket', msg);

    log(`Update ServiceNow ticket function called with arguments: ${JSON.stringify(functionArguments)}`);

    const serviceNowService = new ServiceNowService();

    try {
        // Extract sys_id and prepare update data
        const { sys_id, ...updateData } = functionArguments;
        
        // Update the ticket
        const result = await serviceNowService.updateTicket(sys_id, updateData);

        if (!result) {
            logError_(`Failed to update ServiceNow ticket with ID: ${sys_id}`);
            return {
                success: false,
                message: `Failed to update ServiceNow ticket with ID: ${sys_id}`
            };
        }

        const response: UpdateServiceNowTicketResponse = {
            success: true,
            message: `Ticket updated successfully`,
            ticket_number: result.result.number,
            ticket_id: result.result.sys_id
        };

        log(`Ticket updated successfully: ${JSON.stringify(response)}`);
        return response;

    } catch (error) {
        const errorMessage = `Ticket update failed: ${error instanceof Error ? error.message : String(error)}`;
        logError_(errorMessage);

        return {
            success: false,
            message: errorMessage
        };
    }
}