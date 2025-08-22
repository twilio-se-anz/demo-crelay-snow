#!/usr/bin/env node

/**
 * ServiceNow Tools Test Script
 * 
 * This script tests the ServiceNow integration tools by:
 * 1. Looking up an existing ticket (INC0008111)
 * 2. Looking up a customer by phone number
 * 3. Creating a new ticket
 * 4. Looking up the newly created ticket
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔧 ServiceNow Tools Integration Test');
console.log('=====================================');

async function testServiceNowTools() {
    try {
        // Import the tools (using .ts extension since we're using tsx)
        const { default: getServiceNowTicket } = await import('./src/tools/get-servicenow-ticket.ts');
        const { default: lookupCustomer } = await import('./src/tools/lookup-customer.ts');
        const { default: createServiceNowTicket } = await import('./src/tools/create-servicenow-ticket.ts');

        console.log('\n1️⃣ Testing Get ServiceNow Ticket with INC0008111...');
        console.log('----------------------------------------------------');
        
        const getTicketResult = await getServiceNowTicket({ 
            ticketNumber: 'INC0008111' 
        });
        
        console.log('Get Ticket Result:', JSON.stringify(getTicketResult, null, 2));

        console.log('\n2️⃣ Testing Customer Lookup...');
        console.log('------------------------------');
        
        const customerResult = await lookupCustomer({ 
            phoneNumber: '+15551234567' 
        });
        
        console.log('Customer Lookup Result:', JSON.stringify(customerResult, null, 2));

        console.log('\n3️⃣ Testing Ticket Creation...');
        console.log('------------------------------');
        
        const createTicketResult = await createServiceNowTicket({
            shortDescription: 'Test Integration Ticket from Script',
            description: 'This is a test ticket created by the ServiceNow integration test script to verify API connectivity and functionality.',
            callerPhoneNumber: '+15551234567',
            priority: '3', // Moderate
            urgency: '2',   // Medium
            category: 'Software',
            subcategory: 'Application',
            contactType: 'phone',
            workNotes: 'Initial test ticket creation via API integration test script'
        });
        
        console.log('Create Ticket Result:', JSON.stringify(createTicketResult, null, 2));

        // If ticket creation was successful, try to look it up
        if (createTicketResult.success && createTicketResult.ticketNumber) {
            console.log('\n4️⃣ Testing Lookup of Newly Created Ticket...');
            console.log('---------------------------------------------');
            
            const newTicketResult = await getServiceNowTicket({ 
                ticketNumber: createTicketResult.ticketNumber 
            });
            
            console.log('New Ticket Lookup Result:', JSON.stringify(newTicketResult, null, 2));
        }

        console.log('\n✅ ServiceNow Tools Test Complete!');
        console.log('==================================');

    } catch (error) {
        console.error('\n❌ Test Failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Check if required environment variables are set
function checkEnvironment() {
    const required = ['SERVICENOW_INSTANCE', 'SERVICENOW_USERNAME', 'SERVICENOW_PASSWORD'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
        console.error('Please set these in your .env file');
        process.exit(1);
    }
    
    console.log('✅ Environment variables configured');
    console.log(`ServiceNow Instance: ${process.env.SERVICENOW_INSTANCE}`);
    console.log(`ServiceNow Username: ${process.env.SERVICENOW_USERNAME}`);
    console.log('ServiceNow Password: *** (hidden)');
}

// Run the test
checkEnvironment();
testServiceNowTools();