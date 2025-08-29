# ServiceNow OpenFrame Plugin

This plugin provides ServiceNow integration capabilities for the Conversation Relay system, specifically designed to work with OpenFrame configurations.

## Features

- ServiceNow ticket management integration
- Customer lookup functionality
- Identity verification workflows
- OpenFrame-specific UI components

## Configuration

Set the following environment variables:

```bash
SERVICENOW_INSTANCE_URL=https://your-instance.service-now.com
SERVICENOW_USERNAME=your-username
SERVICENOW_PASSWORD=your-password
```

## Usage

This plugin extends the base Conversation Relay system with ServiceNow-specific functionality. The tools and services are automatically available when the plugin is loaded.

## Tools Provided

- `create-servicenow-ticket` - Create new ServiceNow incidents
- `get-servicenow-ticket` - Retrieve existing ServiceNow tickets
- `update-servicenow-ticket` - Update ServiceNow ticket information
- `lookup-customer` - Search for customer information in ServiceNow
- `send-verification` - Send verification codes via SMS/voice
- `check-verification` - Verify submitted verification codes