/**
 * Update ServiceNow Ticket function - updates an existing incident ticket in ServiceNow
 * This tool allows adding work notes, updating status, priority, and other ticket fields
 */
import { logOut, logError } from "../utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Interface for the function arguments
 */
interface UpdateServiceNowTicketFunctionArguments {
  ticketNumber: string;
  workNotes?: string;
  state?: "1" | "2" | "3" | "6" | "7" | "8"; // 1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed, 8=Canceled
  priority?: "1" | "2" | "3" | "4" | "5"; // 1=Critical, 2=High, 3=Moderate, 4=Low, 5=Planning
  urgency?: "1" | "2" | "3"; // 1=High, 2=Medium, 3=Low
  closeCode?: string;
  resolutionNotes?: string;
  assignedTo?: string; // User name or sys_id
  assignmentGroup?: string; // Group name or sys_id
  category?: string;
  subcategory?: string;
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
 * Interface for ServiceNow ticket update response
 */
interface ServiceNowTicketUpdateResponse {
  sys_id: string;
  number: string;
  state: string;
  updated_at: string;
  work_notes?: string;
}

/**
 * Interface for the response object
 */
interface UpdateServiceNowTicketResponse {
  success: boolean;
  message: string;
  ticket?: ServiceNowTicketUpdateResponse;
  ticketNumber?: string;
  updatedFields?: string[];
}

/**
 * Updates an existing incident ticket in ServiceNow
 *
 * @param functionArguments - The arguments for updating the ServiceNow ticket
 * @param toolEvent - Tool event for logging (provided by ResponseService)
 * @returns A response object with updated ticket information for conversation context
 */
export default async function (
  functionArguments: UpdateServiceNowTicketFunctionArguments,
  toolEvent?: ToolEvent
): Promise<UpdateServiceNowTicketResponse> {
  const log =
    toolEvent?.log || ((msg: string) => logOut("UpdateServiceNowTicket", msg));
  const logError_ =
    toolEvent?.logError ||
    ((msg: string) => logError("UpdateServiceNowTicket", msg));

  log(
    `Update ServiceNow ticket function called for: ${functionArguments.ticketNumber}`
  );

  // Get ServiceNow credentials from environment
  const serviceNowInstance = process.env.SERVICENOW_INSTANCE;
  const serviceNowUsername = process.env.SERVICENOW_USERNAME;
  const serviceNowPassword = process.env.SERVICENOW_PASSWORD;

  if (!serviceNowInstance || !serviceNowUsername || !serviceNowPassword) {
    const errorMessage =
      "Missing required ServiceNow credentials in environment variables";
    logError_(errorMessage);
    return {
      success: false,
      message: errorMessage,
    };
  }

  try {
    // Normalize ServiceNow instance URL
    let baseUrl = serviceNowInstance;
    if (baseUrl.startsWith("https://")) {
      // Instance is already a full URL, use as-is
      baseUrl = baseUrl;
    } else {
      // Instance is just the name, construct full URL
      baseUrl = `https://${baseUrl}.service-now.com`;
    }

    // Create authorization header (Basic Auth)
    const auth = Buffer.from(
      `${serviceNowUsername}:${serviceNowPassword}`
    ).toString("base64");

    // Step 1: Find the ticket by number to get sys_id
    const ticketApiUrl = `${baseUrl}/api/now/table/incident`;
    const findQueryParams = new URLSearchParams({
      sysparm_query: `number=${functionArguments.ticketNumber}`,
      sysparm_fields: "sys_id,number,state",
    });

    const findResponse = await fetch(`${ticketApiUrl}?${findQueryParams}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    // Debug log the find response
    log(
      `Find ticket response status: ${findResponse.status} ${findResponse.statusText}`
    );

    if (!findResponse.ok) {
      const errorText = await findResponse.text();
      log(`Find ticket error response body: ${errorText}`);
      throw new Error(
        `ServiceNow ticket lookup failed: ${findResponse.status} ${findResponse.statusText}`
      );
    }

    const findData = await findResponse.json();
    log(`Find ticket response data: ${JSON.stringify(findData, null, 2)}`);

    if (!findData.result || findData.result.length === 0) {
      const notFoundMessage = `Ticket ${functionArguments.ticketNumber} not found in ServiceNow`;
      log(notFoundMessage);
      return {
        success: false,
        message: notFoundMessage,
        ticketNumber: functionArguments.ticketNumber,
      };
    }

    const ticketSysId = findData.result[0].sys_id;
    log(
      `Found ticket ${functionArguments.ticketNumber} with sys_id: ${ticketSysId}`
    );

    // Step 2: Build update data object
    const updateData: any = {};
    const updatedFields: string[] = [];

    // Add work notes if provided
    if (functionArguments.workNotes) {
      updateData.work_notes = functionArguments.workNotes;
      updatedFields.push("work_notes");
    }

    // Add state if provided
    if (functionArguments.state) {
      updateData.state = functionArguments.state;
      updatedFields.push("state");
    }

    // Add priority if provided
    if (functionArguments.priority) {
      updateData.priority = functionArguments.priority;
      updatedFields.push("priority");
    }

    // Add urgency if provided
    if (functionArguments.urgency) {
      updateData.urgency = functionArguments.urgency;
      updatedFields.push("urgency");
    }

    // Add resolution information if provided
    // Note: Field names may vary by ServiceNow instance configuration
    if (functionArguments.closeCode) {
      updateData.close_code = functionArguments.closeCode;
      updatedFields.push("close_code");
    }

    if (functionArguments.resolutionNotes) {
      updateData.resolution_notes = functionArguments.resolutionNotes;
      updatedFields.push("resolution_notes");
    }

    // Add assignment information if provided
    if (functionArguments.assignedTo) {
      updateData.assigned_to = functionArguments.assignedTo;
      updatedFields.push("assigned_to");
    }

    if (functionArguments.assignmentGroup) {
      updateData.assignment_group = functionArguments.assignmentGroup;
      updatedFields.push("assignment_group");
    }

    // Add category information if provided
    if (functionArguments.category) {
      updateData.category = functionArguments.category;
      updatedFields.push("category");
    }

    if (functionArguments.subcategory) {
      updateData.subcategory = functionArguments.subcategory;
      updatedFields.push("subcategory");
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      const noUpdatesMessage = `No update fields provided for ticket ${functionArguments.ticketNumber}`;
      log(noUpdatesMessage);
      return {
        success: false,
        message: noUpdatesMessage,
        ticketNumber: functionArguments.ticketNumber,
      };
    }

    // Step 3: Update the ticket
    log(`Updating ticket with data: ${JSON.stringify(updateData, null, 2)}`);
    log(`Update URL: ${ticketApiUrl}/${ticketSysId}`);

    const updateResponse = await fetch(`${ticketApiUrl}/${ticketSysId}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(updateData),
    });

    // Debug log the update response
    log(
      `Update ticket response status: ${updateResponse.status} ${updateResponse.statusText}`
    );
    log(
      `Update response headers: ${JSON.stringify(
        Object.fromEntries(updateResponse.headers.entries()),
        null,
        2
      )}`
    );

    if (!updateResponse.ok) {
      // Get the error response body for debugging
      const errorText = await updateResponse.text();
      log(`Update ticket error response body: ${errorText}`);

      // Try to parse error response as JSON to get more details
      let errorDetail = "";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.detail) {
          errorDetail = errorJson.error.detail;
        }
      } catch (e) {
        // If parsing fails, we'll use the default error handling
      }

      // Handle specific error cases
      if (updateResponse.status === 403) {
        // Check if it's a data policy exception rather than a permission issue
        if (errorDetail.includes("Data Policy Exception")) {
          // Extract the specific field requirements from the error detail
          const fieldMatch = errorDetail.match(
            /The following fields are mandatory: (.+)/
          );
          const requiredFields = fieldMatch
            ? fieldMatch[1].trim()
            : "unknown fields";

          // Check if it's about resolution fields when changing state to Resolved/Closed
          if (
            errorDetail.includes("Resolution code") &&
            (functionArguments.state === "6" || functionArguments.state === "7")
          ) {
            throw new Error(
              `Cannot ${
                functionArguments.state === "6" ? "resolve" : "close"
              } ticket: Resolution code is required when changing state to ${
                functionArguments.state === "6" ? "Resolved" : "Closed"
              }. Please provide a closeCode parameter.`
            );
          } else {
            throw new Error(
              `Data validation failed: ${requiredFields} are required for this update.`
            );
          }
        } else {
          throw new Error(
            `Permission denied: The user ${serviceNowUsername} does not have permission to update tickets in ServiceNow. Please check user roles and ACLs.`
          );
        }
      } else if (updateResponse.status === 401) {
        throw new Error(
          `Authentication failed: Invalid credentials for ServiceNow. Please check username and password.`
        );
      } else if (updateResponse.status === 404) {
        throw new Error(
          `Ticket not found: The ticket ${functionArguments.ticketNumber} could not be found in ServiceNow.`
        );
      } else {
        throw new Error(
          `ServiceNow ticket update failed: ${updateResponse.status} ${updateResponse.statusText}`
        );
      }
    }

    const updatedTicketData = await updateResponse.json();
    log(
      `Update ticket response data: ${JSON.stringify(
        updatedTicketData,
        null,
        2
      )}`
    );
    const updatedTicket = updatedTicketData.result;

    const successResponse: UpdateServiceNowTicketResponse = {
      success: true,
      message: `Successfully updated ticket ${functionArguments.ticketNumber}`,
      ticket: {
        sys_id: updatedTicket.sys_id,
        number: updatedTicket.number,
        state: updatedTicket.state,
        updated_at: updatedTicket.sys_updated_on,
        work_notes: updatedTicket.work_notes,
      },
      ticketNumber: functionArguments.ticketNumber,
      updatedFields: updatedFields,
    };

    log(
      `ServiceNow ticket updated successfully: ${
        functionArguments.ticketNumber
      }. Updated fields: ${updatedFields.join(", ")}`
    );
    return successResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError_(errorMessage);

    // Provide more user-friendly error messages
    let userMessage = errorMessage;
    if (
      errorMessage.includes("Cannot resolve ticket") ||
      errorMessage.includes("Cannot close ticket")
    ) {
      userMessage = errorMessage; // Use the specific error message about resolution code
    } else if (errorMessage.includes("Data validation failed")) {
      userMessage = errorMessage; // Use the specific error message about required fields
    } else if (errorMessage.includes("Permission denied")) {
      userMessage =
        "Unable to update ticket due to permission restrictions in ServiceNow. The user account may need additional roles or permissions.";
    } else if (errorMessage.includes("Authentication failed")) {
      userMessage =
        "Unable to authenticate with ServiceNow. Please verify the credentials.";
    }

    return {
      success: false,
      message: userMessage,
      ticketNumber: functionArguments.ticketNumber,
    };
  }
}
