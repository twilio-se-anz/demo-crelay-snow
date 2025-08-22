#!/usr/bin/env node

/**
 * Customer Lookup Test Script
 * 
 * This script tests the lookup-customer tool by searching for customers
 * in ServiceNow using their phone number (mobile_phone field only).
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('📱 Customer Lookup Test');
console.log('=======================');

async function testCustomerLookup() {
    try {
        // Import the lookup-customer tool
        const { default: lookupCustomer } = await import('./src/tools/lookup-customer.ts');

        // Test phone numbers to try
        const testPhoneNumbers = [
            '+15551234567',      // Test number with +
            '(555) 123-4567',    // US format with parentheses
            '555-123-4567',      // US format with dashes
            '5551234567',        // Plain digits
            '+1234567890',       // Different test number
            '+12345678901',      // 11-digit number
        ];

        console.log(`\n🔍 Testing ${testPhoneNumbers.length} phone number formats...\n`);

        for (let i = 0; i < testPhoneNumbers.length; i++) {
            const phoneNumber = testPhoneNumbers[i];
            
            console.log(`${i + 1}️⃣ Testing: ${phoneNumber}`);
            console.log('─'.repeat(50));
            
            const result = await lookupCustomer({ 
                phoneNumber: phoneNumber 
            });
            
            if (result.success) {
                console.log('✅ Customer Found!');
                console.log(`   Name: ${result.customer.name}`);
                console.log(`   Email: ${result.customer.email}`);
                console.log(`   Company: ${result.customer.company}`);
                console.log(`   Department: ${result.customer.department}`);
                console.log(`   Phone: ${result.customer.phone}`);
                console.log(`   Mobile: ${result.customer.mobile_phone}`);
                console.log(`   Open Tickets: ${result.ticketCount || 0}`);
                
                if (result.openTickets && result.openTickets.length > 0) {
                    console.log('   Recent Tickets:');
                    result.openTickets.slice(0, 3).forEach((ticket, idx) => {
                        console.log(`     ${idx + 1}. ${ticket.number}: ${ticket.short_description}`);
                    });
                }
            } else {
                console.log('❌ Customer Not Found');
                console.log(`   Message: ${result.message}`);
            }
            
            console.log(''); // Empty line for spacing
        }

        console.log('🎯 Interactive Test');
        console.log('───────────────────');
        console.log('To test a specific phone number, you can also run:');
        console.log('node test-customer-lookup.js "+1234567890"');
        console.log('');

    } catch (error) {
        console.error('\n❌ Test Failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Check if a phone number was provided as command line argument
function getPhoneFromArgs() {
    const args = process.argv.slice(2);
    return args.length > 0 ? args[0] : null;
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

// Main execution
async function main() {
    checkEnvironment();
    
    const phoneFromArgs = getPhoneFromArgs();
    
    if (phoneFromArgs) {
        // Test specific phone number from command line
        console.log(`\n🎯 Testing specific phone number: ${phoneFromArgs}`);
        console.log('─'.repeat(50));
        
        try {
            const { default: lookupCustomer } = await import('./src/tools/lookup-customer.ts');
            const result = await lookupCustomer({ phoneNumber: phoneFromArgs });
            
            console.log('\nResult:', JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('Error:', error.message);
        }
    } else {
        // Run standard test suite
        await testCustomerLookup();
    }
    
    console.log('✅ Customer Lookup Test Complete!');
}

main();