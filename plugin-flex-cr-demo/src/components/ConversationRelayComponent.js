import React from "react";
import { withTaskContext } from "@twilio/flex-ui";
import { Box, Text } from "@twilio-paste/core";

class ConversationRelayComponent extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { task } = this.props;
    // Access the call summary from task attributes
    console.log("task attributes");
    console.log(task.attributes);
    const callSummary = task.attributes.callSummary;
    const sentiment = task.attributes.sentiment;
    const ticketNumber = task.attributes.ticketNumber;

    return (
      <Box
        padding="space50"
        height="auto"
        marginTop="space30"
        borderColor="colorBorderWeaker"
        borderWidth="borderWidth30"
        borderRadius="borderRadius30"
        margin="space60"
        borderStyle="solid"
      >
        <Box
          as="header"
          alignItems="center"
          justifyContent="space-between"
          marginBottom="space30"
        >
          <Text
            as="h1"
            fontSize="fontSize30"
            color="colorText"
            fontWeight="fontWeightBold"
          >
            Summary of the conversation with voice bot
          </Text>
        </Box>
        <Box marginBottom="space30">
          <Text as="div">{callSummary}</Text>
        </Box>

        <Box
          as="header"
          alignItems="center"
          justifyContent="space-between"
          marginBottom="space30"
        >
          <Text
            as="h1"
            fontSize="fontSize30"
            color="colorText"
            fontWeight="fontWeightBold"
          >
            Sentiment is {sentiment}
          </Text>
        </Box>

        <Box
          as="header"
          alignItems="center"
          justifyContent="space-between"
          marginBottom="space30"
        >
          <Text
            as="h1"
            fontSize="fontSize30"
            color="colorText"
            fontWeight="fontWeightBold"
          >
            Ticket Number: {ticketNumber}
          </Text>
        </Box>
      </Box>
    );
  }
}

export default withTaskContext(ConversationRelayComponent);
