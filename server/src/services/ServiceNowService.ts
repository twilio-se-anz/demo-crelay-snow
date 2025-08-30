import { logOut, logError } from '../utils/logger.js';

/**
 * Interface for ServiceNow ticket creation
 */
interface CreateTicketRequest {
    short_description: string;
    description?: string;
    category?: string;
    subcategory?: string;
    priority?: string;
    caller_id?: string;
    assignment_group?: string;
    [key: string]: any;
}

/**
 * Interface for ServiceNow ticket response
 */
interface TicketResponse {
    result: {
        sys_id: string;
        number: string;
        state: string;
        short_description: string;
        description?: string;
        caller_id?: string;
        assigned_to?: string;
        assignment_group?: string;
        priority?: string;
        category?: string;
        subcategory?: string;
        created_on: string;
        updated_on: string;
        [key: string]: any;
    };
}

/**
 * Interface for customer lookup response
 */
interface CustomerResponse {
    result: Array<{
        sys_id: string;
        name: string;
        email: string;
        phone: string;
        user_name: string;
        active: boolean;
        [key: string]: any;
    }>;
}

/**
 * Service class for handling ServiceNow-related operations including ticket management and customer lookup.
 * 
 * @class
 * @property {string} instanceUrl - ServiceNow instance URL from environment variables
 * @property {string} username - ServiceNow username from environment variables
 * @property {string} password - ServiceNow password from environment variables
 */
class ServiceNowService {
    private instanceUrl: string;
    private username: string;
    private password: string;
    private authHeader: string;

    constructor() {
        this.instanceUrl = process.env.SERVICENOW_INSTANCE_URL || '';
        this.username = process.env.SERVICENOW_USERNAME || '';
        this.password = process.env.SERVICENOW_PASSWORD || '';
        this.authHeader = 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');
    }

    /**
     * Creates a new ServiceNow incident ticket.
     * 
     * @param {CreateTicketRequest} ticketData - The ticket creation data
     * @returns {Promise<TicketResponse|null>} The created ticket response or null if creation fails
     */
    async createTicket(ticketData: CreateTicketRequest): Promise<TicketResponse | null> {
        try {
            logOut('ServiceNowService', `Creating ticket with data: ${JSON.stringify(ticketData)}`);

            const response = await fetch(`${this.instanceUrl}/api/now/table/incident`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authHeader,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(ticketData)
            });

            if (!response.ok) {
                throw new Error(`ServiceNow API error: ${response.status} ${response.statusText}`);
            }

            const result: TicketResponse = await response.json();
            logOut('ServiceNowService', `Created ticket: ${result.result.number} (${result.result.sys_id})`);
            return result;

        } catch (error) {
            logError('ServiceNowService', `Create ticket error: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Retrieves a ServiceNow incident ticket by number or sys_id.
     * 
     * @param {string} ticketIdentifier - Ticket number (e.g., INC0000123) or sys_id
     * @returns {Promise<TicketResponse|null>} The ticket data or null if not found
     */
    async getTicket(ticketIdentifier: string): Promise<TicketResponse | null> {
        try {
            logOut('ServiceNowService', `Getting ticket: ${ticketIdentifier}`);

            // Determine if identifier is a ticket number or sys_id
            const isTicketNumber = ticketIdentifier.match(/^INC\d+$/i);
            const queryParam = isTicketNumber ? `number=${ticketIdentifier}` : `sys_id=${ticketIdentifier}`;

            const response = await fetch(`${this.instanceUrl}/api/now/table/incident?${queryParam}`, {
                headers: {
                    'Authorization': this.authHeader,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`ServiceNow API error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.result && result.result.length > 0) {
                logOut('ServiceNowService', `Found ticket: ${result.result[0].number}`);
                return { result: result.result[0] };
            } else {
                logOut('ServiceNowService', `Ticket not found: ${ticketIdentifier}`);
                return null;
            }

        } catch (error) {
            logError('ServiceNowService', `Get ticket error: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Updates a ServiceNow incident ticket.
     * 
     * @param {string} sysId - The sys_id of the ticket to update
     * @param {Partial<CreateTicketRequest>} updateData - The data to update
     * @returns {Promise<TicketResponse|null>} The updated ticket response or null if update fails
     */
    async updateTicket(sysId: string, updateData: Partial<CreateTicketRequest>): Promise<TicketResponse | null> {
        try {
            logOut('ServiceNowService', `Updating ticket ${sysId} with data: ${JSON.stringify(updateData)}`);

            const response = await fetch(`${this.instanceUrl}/api/now/table/incident/${sysId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authHeader,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                throw new Error(`ServiceNow API error: ${response.status} ${response.statusText}`);
            }

            const result: TicketResponse = await response.json();
            logOut('ServiceNowService', `Updated ticket: ${result.result.number}`);
            return result;

        } catch (error) {
            logError('ServiceNowService', `Update ticket error: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Looks up customer information in ServiceNow by various criteria.
     * 
     * @param {string} searchTerm - Email, phone number, or name to search for
     * @param {string} searchType - Type of search: 'email', 'phone', 'name', or 'username'
     * @returns {Promise<CustomerResponse|null>} Customer information or null if not found
     */
    async lookupCustomer(searchTerm: string, searchType: string = 'email'): Promise<CustomerResponse | null> {
        try {
            logOut('ServiceNowService', `Looking up customer by ${searchType}: ${searchTerm}`);

            let queryParam: string;
            switch (searchType.toLowerCase()) {
                case 'email':
                    queryParam = `email=${encodeURIComponent(searchTerm)}`;
                    break;
                case 'phone':
                    queryParam = `phone=${encodeURIComponent(searchTerm)}`;
                    break;
                case 'name':
                    queryParam = `name=${encodeURIComponent(searchTerm)}`;
                    break;
                case 'username':
                    queryParam = `user_name=${encodeURIComponent(searchTerm)}`;
                    break;
                default:
                    queryParam = `email=${encodeURIComponent(searchTerm)}`;
            }

            const response = await fetch(`${this.instanceUrl}/api/now/table/sys_user?${queryParam}&active=true`, {
                headers: {
                    'Authorization': this.authHeader,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`ServiceNow API error: ${response.status} ${response.statusText}`);
            }

            const result: CustomerResponse = await response.json();
            logOut('ServiceNowService', `Found ${result.result.length} customer(s)`);
            return result;

        } catch (error) {
            logError('ServiceNowService', `Customer lookup error: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
}

export { ServiceNowService, CreateTicketRequest, TicketResponse, CustomerResponse };