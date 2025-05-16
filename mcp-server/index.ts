#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from 'dotenv';

dotenv.config();
const { CONTEXT_FILE } = process.env;

console.error("CONTEXT FILE: ", CONTEXT_FILE)
// Get configuration parameters from the command line arguments
/****************************************************
 * 
 *                Twilio API Credentials
 *  
 ****************************************************/

// NOTE: we are enforcing use of API Keys here instead of Auth Token, as it is a better posture for message level sends
const accountSid = process.argv[2] || '';
const apiKey = process.argv[3] || '';
const apiSecret = process.argv[4] || '';

// Validate required configuration
if (!accountSid || !apiKey || !apiSecret) {
    console.error("Missing required configuration parameters");
    console.error("Usage: twilio-messaging-mcp-server <accountSid> <apiKey> <apiSecret>");
    process.exit(1);
}

/****************************************************
 * 
 *                      MCP server
 *  
 ****************************************************/

// Server configuration with clear naming for the messaging service
const SERVER_CONFIG = {
    name: "TwilioConversationRelayServer",
    description: "MCP server for Conversation Relay",
    version: "1.0.0"
};

const MCP_CAPABILITIES = {
    capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {}  // Add logging capability
    }
}

const mcpServer = new McpServer(SERVER_CONFIG, MCP_CAPABILITIES);


// Define schemas for Twilio messaging
const messageSchema = z.object({
    to: z.string().describe("The Twilio To number in +E.164 format (+XXXXXXXXXX)"),
    message: z.string().describe("The message to send")
});

// create a new mcpServer.prompt  to tell the LLM how to use the tool and how to call the resource for status updates
// Register prompts using the built-in prompt method
// Import fs and path modules for file reading
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the equivalent of __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the context from the VoiceContext.md file in the server directory
const context = fs.readFileSync(path.join(__dirname, `../assets/${CONTEXT_FILE}`), "utf-8");

mcpServer.prompt(
    "SendSMS",
    "Prompt for sending an SMS using Twilio Messaging MCP Server",
    messageSchema.shape,
    (args, extra) => {
        const { to, message } = args;
        return {
            messages: [
                {
                    role: "assistant",
                    content: {
                        type: "text",
                        text: context
                    }
                }
            ]
        };
    }
);

// Define schemas for each tool from defaultToolManifest.json
const endCallSchema = z.object({
    conversationSummary: z.string().describe("A summary of the call")
});

const liveAgentHandoffSchema = z.object({
    summary: z.string().describe("A summary of the call")
});

const sendDtmfSchema = z.object({
    dtmfDigit: z.string().describe("The DTMF digit value to send")
});

// Register the end-call tool
mcpServer.tool(
    "end-call",
    "End this call now",
    endCallSchema.shape,
    async ({ conversationSummary }) => {
        try {
            // Implementation would go here - this is a placeholder
            // You would typically call a function to end the call
            // For example: await twilioVoiceServer.endCall(conversationSummary);

            return {
                content: [{
                    type: "text",
                    text: `Call ended successfully. Summary: ${conversationSummary}`
                }]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`TwilioMessagingServer: Error ending call: ${errorMessage}`);

            return {
                content: [{
                    type: "text",
                    text: `Error ending call: ${errorMessage}`
                }],
                isError: true
            };
        }
    }
);

// Register the live-agent-handoff tool
mcpServer.tool(
    "live-agent-handoff",
    "Transfers the call to a human agent",
    liveAgentHandoffSchema.shape,
    async ({ summary }) => {
        try {
            // Implementation would go here - this is a placeholder
            // You would typically call a function to transfer the call
            // For example: await twilioVoiceServer.transferToAgent(summary);

            return {
                content: [{
                    type: "text",
                    text: `Call transferred to human agent. Summary: ${summary}`
                }]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`TwilioMessagingServer: Error transferring call: ${errorMessage}`);

            return {
                content: [{
                    type: "text",
                    text: `Error transferring call: ${errorMessage}`
                }],
                isError: true
            };
        }
    }
);

// Register the send-dtmf tool
mcpServer.tool(
    "send-dtmf",
    "This sends DTMF tones to the call",
    sendDtmfSchema.shape,
    async ({ dtmfDigit }) => {
        try {
            // Implementation would go here - this is a placeholder
            // You would typically call a function to send DTMF tones
            // For example: await twilioVoiceServer.sendDtmf(dtmfDigit);

            return {
                content: [{
                    type: "text",
                    text: `DTMF tone ${dtmfDigit} sent successfully`
                }]
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`TwilioMessagingServer: Error sending DTMF: ${errorMessage}`);

            return {
                content: [{
                    type: "text",
                    text: `Error sending DTMF: ${errorMessage}`
                }],
                isError: true
            };
        }
    }
);

// Start the server
async function main() {
    try {
        const transport = new StdioServerTransport();
        await mcpServer.connect(transport);
    } catch (error) {
        console.error(`TwilioMessagingServer: Error starting server: ${error}`);
        process.exit(1);
    }
}

// Handle clean shutdown
process.on("SIGINT", async () => {
    await mcpServer.close();
    process.exit(0);
});

// Start the server
main().catch(error => {
    console.error(`TwilioMessagingServer: Fatal error: ${error}`);
    process.exit(1);
});
