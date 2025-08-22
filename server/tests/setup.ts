/**
 * Jest setup file for Data#3 ServiceNow and Twilio Verify tools tests
 * Uses real API credentials for integration testing
 */

// Import dotenv to load real credentials from .env file
require('dotenv').config();

// Set test environment
process.env.NODE_ENV = 'test';

// Verify required environment variables are present
const requiredEnvVars = [
  'SERVICENOW_INSTANCE',
  'SERVICENOW_USERNAME', 
  'SERVICENOW_PASSWORD',
  'ACCOUNT_SID',
  'AUTH_TOKEN',
  'VERIFY_SERVICE_SID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn(`Warning: Missing environment variables for real API testing: ${missingVars.join(', ')}`);
  console.warn('Tests will use fallback mock data if APIs are not accessible.');
}