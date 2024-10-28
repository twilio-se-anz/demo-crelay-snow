exports.handler = async function (context, event, callback) {
  console.log("[getCustomer] Event object:", JSON.stringify(event, null, 4));

  try {
    // Extract phone-number from the event object
    // let caller = event.call.from_number; // This is for RetellAI
    let caller = event.from;
    if (!caller) {
      throw new Error('[getCustomer] phone-number is missing from the event object');
    }

    console.log(`[getCustomer] Phone number provided:`, caller);

    // You would replace this with actual logic (e.g., database lookup)
    const customerDatabase = {
      '+61401277XXX': {
        firstname: "Des",
        lastname: "Hartman"
      }
    };

    const customerData = customerDatabase[caller];
    console.log(`[getCustomer] customer returned:`, customerData);
    if (customerData) {
      return callback(null, customerData);
    } else {
      return callback(null);
    }
  } catch (error) {
    return callback(`[getCustomer] Error: ${error}`);
  }
}
