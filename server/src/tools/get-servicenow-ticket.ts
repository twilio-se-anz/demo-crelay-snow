/**
 * Get ServiceNow Ticket function - retrieves ticket information from ServiceNow API
 * This tool queries ServiceNow to get ticket details, status, and related information
 */
import { logOut, logError } from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Interface for the function arguments
 */
interface GetServiceNowTicketFunctionArguments {
    ticketNumber: string;
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
 * Interface for ServiceNow ticket data
 */
interface ServiceNowTicket {
    number: string;
    short_description: string;
    description: string;
    state: string;
    priority: string;
    urgency: string;
    category: string;
    subcategory: string;
    assigned_to: string;
    assignment_group: string;
    opened_at: string;
    updated_at: string;
    resolved_at?: string;
    closed_at?: string;
    caller_id: string;
    contact_type: string;
    work_notes?: string;
    resolution_notes?: string;
    sys_id: string;
}

/**
 * Interface for the response object
 */
interface GetServiceNowTicketResponse {
    success: boolean;
    message: string;
    ticket?: ServiceNowTicket;
    ticketNumber?: string;
}

/**
 * Gets ticket information from ServiceNow using REST API
 * 
 * @param functionArguments - The arguments for the get ServiceNow ticket function
 * @param toolEvent - Tool event for logging (provided by ResponseService)
 * @returns A response object with ticket information for conversation context
 */
export default async function (functionArguments: GetServiceNowTicketFunctionArguments, toolEvent?: ToolEvent): Promise<GetServiceNowTicketResponse> {
    const log = toolEvent?.log || ((msg: string) => logOut('GetServiceNowTicket', msg));
    const logError_ = toolEvent?.logError || ((msg: string) => logError('GetServiceNowTicket', msg));

    log(`Get ServiceNow ticket function called with ticket number: ${functionArguments.ticketNumber}`);

    // Get ServiceNow credentials from environment
    const serviceNowInstance = process.env.SERVICENOW_INSTANCE;
    const serviceNowUsername = process.env.SERVICENOW_USERNAME;
    const serviceNowPassword = process.env.SERVICENOW_PASSWORD;

    log(`ServiceNow Instance: ${serviceNowInstance ? 'SET' : 'NOT SET'}`);
    log(`ServiceNow Username: ${serviceNowUsername ? 'SET' : 'NOT SET'}`);
    log(`ServiceNow Password: ${serviceNowPassword ? 'SET' : 'NOT SET'}`);

    if (!serviceNowInstance || !serviceNowUsername || !serviceNowPassword) {
        const errorMessage = 'Missing required ServiceNow credentials in environment variables';
        logError_(errorMessage);
        return {
            success: false,
            message: errorMessage
        };
    }

    try {
        // Normalize ServiceNow instance URL
        let baseUrl = serviceNowInstance;
        if (baseUrl.startsWith('https://')) {
            // Instance is already a full URL, use as-is
            baseUrl = baseUrl;
        } else {
            // Instance is just the name, construct full URL
            baseUrl = `https://${baseUrl}.service-now.com`;
        }
        
        // Construct ServiceNow API URL
        const apiUrl = `${baseUrl}/api/now/table/incident`;
        
        // Create authorization header (Basic Auth)
        const auth = Buffer.from(`${serviceNowUsername}:${serviceNowPassword}`).toString('base64');
        
        // Query parameters to find ticket by number
        const queryParams = new URLSearchParams({
            sysparm_query: `number=${functionArguments.ticketNumber}`,
            sysparm_fields: 'number,short_description,description,state,priority,urgency,category,subcategory,assigned_to.name,assignment_group.name,opened_at,sys_updated_on,resolved_at,closed_at,caller_id.name,contact_type,work_notes,close_notes,sys_id'
        });

        const fullUrl = `${apiUrl}?${queryParams}`;
        log(`ServiceNow API URL: ${fullUrl}`);

        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        log(`ServiceNow API Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            throw new Error(`ServiceNow API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        log(`ServiceNow API Response: ${JSON.stringify(data, null, 2)}`);

        if (!data.result || data.result.length === 0) {
            const notFoundMessage = `Ticket ${functionArguments.ticketNumber} not found in ServiceNow`;
            log(notFoundMessage);
            return {
                success: false,
                message: notFoundMessage,
                ticketNumber: functionArguments.ticketNumber
            };
        }

        // Get the first (should be only) result
        const ticketData = data.result[0];

        // Map state numbers to readable status
        const stateMapping: { [key: string]: string } = {
            '1': 'New',
            '2': 'In Progress', 
            '3': 'On Hold',
            '6': 'Resolved',
            '7': 'Closed',
            '8': 'Canceled'
        };

        // Map priority numbers to readable priority
        const priorityMapping: { [key: string]: string } = {
            '1': 'Critical',
            '2': 'High',
            '3': 'Moderate',
            '4': 'Low',
            '5': 'Planning'
        };

        // Map urgency numbers to readable urgency
        const urgencyMapping: { [key: string]: string } = {
            '1': 'High',
            '2': 'Medium',
            '3': 'Low'
        };

        const ticket: ServiceNowTicket = {
            number: ticketData.number,
            short_description: ticketData.short_description || '',
            description: ticketData.description || '',
            state: stateMapping[ticketData.state] || ticketData.state,
            priority: priorityMapping[ticketData.priority] || ticketData.priority,
            urgency: urgencyMapping[ticketData.urgency] || ticketData.urgency,
            category: ticketData.category || '',
            subcategory: ticketData.subcategory || '',
            assigned_to: ticketData.assigned_to?.name || 'Unassigned',
            assignment_group: ticketData.assignment_group?.name || 'Unassigned',
            opened_at: ticketData.opened_at,
            updated_at: ticketData.sys_updated_on,
            resolved_at: ticketData.resolved_at || undefined,
            closed_at: ticketData.closed_at || undefined,
            caller_id: ticketData.caller_id?.name || '',
            contact_type: ticketData.contact_type || '',
            work_notes: ticketData.work_notes || undefined,
            resolution_notes: ticketData.close_notes || undefined,
            sys_id: ticketData.sys_id
        };

        const successResponse: GetServiceNowTicketResponse = {
            success: true,
            message: `Successfully retrieved ticket ${functionArguments.ticketNumber}`,
            ticket: ticket,
            ticketNumber: functionArguments.ticketNumber
        };

        log(`ServiceNow ticket retrieved successfully for ${functionArguments.ticketNumber}`);
        return successResponse;

    } catch (error) {
        const errorMessage = `ServiceNow API request failed: ${error instanceof Error ? error.message : String(error)}`;
        logError_(errorMessage);

        return {
            success: false,
            message: errorMessage,
            ticketNumber: functionArguments.ticketNumber
        };
    }
}