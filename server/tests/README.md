# Test Suite for Data#3 ServiceNow and Twilio Integration

This directory contains comprehensive Jest tests for all ServiceNow and Twilio Verify tools, based on the test cases defined in `TEST_CASES.md`.

## Test Structure

```
tests/
├── setup.ts                           # Jest setup and configuration
├── tools/                            # Unit tests for individual tools
│   ├── lookup-customer.test.ts       # Customer lookup tests
│   ├── get-servicenow-ticket.test.ts # Ticket retrieval tests
│   ├── create-servicenow-ticket.test.ts # Ticket creation tests
│   ├── send-verification.test.ts     # Twilio Verify send tests
│   └── check-verification.test.ts    # Twilio Verify check tests
└── integration/                      # Integration tests
    └── webhook-endpoints.test.ts     # Webhook endpoint tests
```

## Running Tests

### Install Dependencies
```bash
npm install
# or
pnpm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Categories
```bash
# Run only tool tests
npm test -- tests/tools/

# Run only integration tests
npm test -- tests/integration/

# Run specific tool tests
npm test -- lookup-customer.test.ts
npm test -- send-verification.test.ts
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Generate Coverage Report
```bash
npm run test:coverage
```

## Test Categories Implemented

### 1. Customer Lookup Tests (`lookup-customer.test.ts`)
- ✅ Successful customer lookup with open tickets
- ✅ Customer lookup with no open tickets  
- ✅ Customer not found scenarios
- ✅ Phone number format normalization
- ✅ Error handling for API failures
- ✅ Credential validation

### 2. ServiceNow Ticket Retrieval (`get-servicenow-ticket.test.ts`)
- ✅ Successful ticket retrieval
- ✅ Ticket not found handling
- ✅ Closed ticket retrieval with resolution details
- ✅ State and priority mapping validation
- ✅ API request parameter validation
- ✅ Error handling and network failures

### 3. Twilio Verify Send Tests (`send-verification.test.ts`)
- ✅ SMS verification code sending
- ✅ Voice verification code sending
- ✅ Default channel handling (SMS)
- ✅ Invalid phone number handling
- ✅ Credential validation
- ✅ Error handling and rate limiting
- ✅ Logging functionality

### 4. Twilio Verify Check Tests (`check-verification.test.ts`)
- ✅ Valid verification code checking
- ✅ Invalid verification code rejection
- ✅ Expired verification code handling
- ✅ Code redaction in logs for security
- ✅ Status mapping (approved, denied, expired)
- ✅ Error handling for API failures

### 5. ServiceNow Ticket Creation (`create-servicenow-ticket.test.ts`)
- ✅ Minimum required fields creation
- ✅ All optional parameters handling
- ✅ Non-existent caller handling
- ✅ Invalid parent case handling
- ✅ Default value application
- ✅ Phone number normalization
- ✅ API failure handling

### 6. Integration Tests (`webhook-endpoints.test.ts`)
- ✅ Voice Intelligence webhook processing
- ✅ Call Recording webhook processing
- ✅ Content type handling (JSON/form-encoded)
- ✅ Error scenarios and missing fields
- ✅ Customer lookup integration
- ✅ Ticket update integration

## Mock Strategy

### External Dependencies
- **ServiceNow API**: Mocked using `jest.fn()` with `fetch`
- **Twilio SDK**: Mocked at module level to control API responses
- **File System**: Using in-memory mocks for configuration files

### Test Data
- Realistic ServiceNow ticket and user data structures
- Valid Twilio response formats
- Various error scenarios and edge cases

## Environment Variables for Testing

Tests use the following environment variables (set in `setup.ts`):
```bash
NODE_ENV=test
SERVICENOW_INSTANCE=test-instance
SERVICENOW_USERNAME=test-user
SERVICENOW_PASSWORD=test-password
ACCOUNT_SID=ACtest1234567890
AUTH_TOKEN=test-auth-token
VERIFY_SERVICE_SID=VAtest1234567890
```

## Coverage Goals

Target coverage metrics:
- **Lines**: > 90%
- **Functions**: > 95%
- **Branches**: > 85%
- **Statements**: > 90%

## Running Specific Test Scenarios

### Test Customer Lookup with Different Phone Formats
```bash
npm test -- --testNamePattern="Phone Number Format Handling"
```

### Test Error Handling Across All Tools
```bash
npm test -- --testNamePattern="Error Handling"
```

### Test ServiceNow Integration
```bash
npm test -- --testNamePattern="ServiceNow"
```

### Test Twilio Verify Integration
```bash
npm test -- --testNamePattern="Verify|Verification"
```

## Debugging Tests

### Run Tests with Verbose Output
```bash
npm test -- --verbose
```

### Run Single Test File with Debug Info
```bash
npm test -- lookup-customer.test.ts --verbose
```

### Debug Test in VS Code
Add this launch configuration to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Continuous Integration

These tests are designed to run in CI environments. Ensure:
1. All environment variables are properly set
2. Network mocking is in place (no real API calls)
3. Test timeouts are appropriate for CI environments
4. Coverage reports are generated and stored

## Test Maintenance

### Adding New Tests
1. Follow the existing pattern in `TEST_CASES.md`
2. Create test file in appropriate directory (`tools/` or `integration/`)
3. Include both positive and negative test cases
4. Add proper mocking for external dependencies
5. Update this README with new test categories

### Updating Existing Tests
1. Ensure backward compatibility
2. Update mocks to match new API responses
3. Maintain test coverage levels
4. Update documentation as needed

## Common Issues and Solutions

### Test Timeouts
If tests are timing out, increase the timeout in `jest.config.js`:
```javascript
testTimeout: 30000 // 30 seconds
```

### Mock Issues
If mocks aren't working properly:
1. Ensure mocks are cleared between tests (`jest.clearAllMocks()`)
2. Check mock module paths are correct
3. Verify environment variables are set in `setup.ts`

### Coverage Issues
If coverage is low:
1. Check for untested error paths
2. Add tests for edge cases
3. Ensure all public methods are tested
4. Review excluded files in `jest.config.js`