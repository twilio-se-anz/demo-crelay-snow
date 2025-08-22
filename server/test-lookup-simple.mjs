#!/usr/bin/env node

/**
 * Simple Customer Lookup Test
 * Tests the customer lookup directly via ServiceNow API to verify exact matching
 */

import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const phoneNumber = process.argv[2] || "61467601932";

console.log("📱 Testing Customer Lookup");
console.log("Phone number:", phoneNumber);
console.log("=======================\n");

async function testLookup() {
  const serviceNowInstance = process.env.SERVICENOW_INSTANCE;
  const serviceNowUsername = process.env.SERVICENOW_USERNAME;
  const serviceNowPassword = process.env.SERVICENOW_PASSWORD;

  if (!serviceNowInstance || !serviceNowUsername || !serviceNowPassword) {
    console.error("Missing ServiceNow credentials");
    return;
  }

  // Normalize ServiceNow instance URL
  let baseUrl = serviceNowInstance;
  if (!baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}.service-now.com`;
  }

  // Create authorization header
  const auth = Buffer.from(
    `${serviceNowUsername}:${serviceNowPassword}`
  ).toString("base64");

  // Normalize phone number (remove formatting)
  const normalizedPhone = phoneNumber.replace(/[\s\-\(\)\.+]/g, "");
  console.log("Normalized phone:", normalizedPhone);

  // Build query with exact match operator (fixed implementation)
  const userApiUrl = `${baseUrl}/api/now/table/sys_user`;
  const exactQuery = `mobile_phone=${normalizedPhone}^ORphone=${normalizedPhone}^active=true`;

  console.log("\n🎯 Testing with EXACT MATCH (= operator):");
  console.log("Query:", exactQuery);
  console.log(
    "Full URL:",
    `${userApiUrl}?sysparm_query=${encodeURIComponent(exactQuery)}`
  );

  const exactParams = new URLSearchParams({
    sysparm_query: exactQuery,
    sysparm_fields: "sys_id,name,email,phone,mobile_phone,company.name",
    sysparm_limit: "10",
  });

  try {
    const exactResponse = await fetch(`${userApiUrl}?${exactParams}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!exactResponse.ok) {
      console.error(
        `API Error: ${exactResponse.status} ${exactResponse.statusText}`
      );
      const errorText = await exactResponse.text();
      console.error("Error details:", errorText);
      return;
    }

    const exactData = await exactResponse.json();
    console.log(`\n✅ Results found: ${exactData.result.length}`);

    if (exactData.result.length > 0) {
      console.log("\nUsers found with EXACT MATCH:");
      exactData.result.forEach((user, i) => {
        console.log(`${i + 1}. ${user.name}`);
        console.log(`   Mobile: ${user.mobile_phone || "Not set"}`);
        console.log(`   Phone: ${user.phone || "Not set"}`);
        console.log(`   Email: ${user.email || "Not set"}`);
        console.log(`   Company: ${user.company?.name || "Not set"}`);
        console.log("");
      });
    } else {
      console.log("\n❌ No exact matches found for this phone number");
      console.log(
        "This is expected if the test number doesn't exist in your ServiceNow instance."
      );
    }

    // For comparison, let's also show what the old CONTAINS query would have returned
    console.log("\n📊 Comparison with old CONTAINS operator:");
    const containsQuery = `mobile_phone.contains=${normalizedPhone.slice(
      0,
      4
    )}^active=true`;
    console.log("Query (using first 4 digits):", containsQuery);

    const containsParams = new URLSearchParams({
      sysparm_query: containsQuery,
      sysparm_fields: "sys_id,name,mobile_phone",
      sysparm_limit: "5",
    });

    const containsResponse = await fetch(`${userApiUrl}?${containsParams}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (containsResponse.ok) {
      const containsData = await containsResponse.json();
      console.log(
        `CONTAINS would have returned: ${containsData.result.length} results`
      );
      if (containsData.result.length > 0) {
        console.log("(Showing first few partial matches)");
        containsData.result.forEach((user, i) => {
          console.log(
            `  - ${user.name} (Mobile: ${user.mobile_phone || "Not set"})`
          );
        });
      }
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.cause) {
      console.error("Cause:", error.cause);
    }
  }
}

console.log("🔧 Configuration:");
console.log(
  `ServiceNow Instance: ${process.env.SERVICENOW_INSTANCE || "NOT SET"}`
);
console.log(
  `ServiceNow Username: ${process.env.SERVICENOW_USERNAME || "NOT SET"}`
);
console.log(
  `ServiceNow Password: ${process.env.SERVICENOW_PASSWORD ? "***" : "NOT SET"}`
);
console.log("");

testLookup();
