import React from "react";
import * as Flex from "@twilio/flex-ui";
import { FlexPlugin, loadJS } from "@twilio/flex-plugin";

import { Activity } from "twilio-taskrouter";

import { ServiceNowMessage } from "types/ServiceNowMessage";

const PLUGIN_NAME = "ServicenowOpenframePlugin";

const openFrameConfig = { height: 600, width: 400 };

export default class ServicenowOpenframePlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  /**
   * This code is run when your plugin is being started
   * Use this to modify any UI components or attach to the actions framework
   *
   * @param flex { typeof Flex }
   * @param manager { Flex.Manager }
   */
  async init(flex: typeof Flex, manager: Flex.Manager): Promise<void> {
    // Default layout
    flex.AgentDesktopView.defaultProps.showPanel2 = false;
    flex.AgentDesktopView.defaultProps.splitterOptions = {
      initialFirstPanelSize: "400px",
      minimumFirstPanelSize: "400px",
    };
    flex.RootContainer.Content.remove("project-switcher");

    // Load custom logo if configured
    if (manager.serviceConfiguration.attributes.logo_url) {
      flex.MainHeader.defaultProps.logoUrl =
        manager.serviceConfiguration.attributes.logo_url;
    }

    // Prepend Environment value to NoTasks
    if (manager.serviceConfiguration.attributes.no_task_string_prefix) {
      manager.strings.NoTasks = `${manager.serviceConfiguration.attributes.no_task_string_prefix} - ${manager.strings.NoTasks}`;
    }

    // This will hold a reference to the Openframe Object once it is loaded.
    let openFrame: Window["openFrameAPI"];

    // Function to process messages from SNOW.
    function handleCommunicationEvent(context: any) {
      console.log("Communication from Topframe", context);
      const message = context as ServiceNowMessage;

      // Click to Dial
      if (message.type === "OUTGOING_CALL") {
        const interactionQuery = message.data.data.find(
          (d) => d.entity === "interaction"
        )?.query;

        Flex.Actions.invokeAction("StartOutboundCall", {
          destination: message.data.metaData.phoneNumber,
          taskAttributes: {
            interactionQuery: interactionQuery,
          },
        });
      }
    }

    // Openframe has initialised, do our setup and event mapping
    function initSuccess(snConfig: any) {
      console.log("openframe configuration", snConfig);
      // Wire up agent state to SNOW agent state
      manager.events.addListener(
        "workerActivityUpdated",
        (activity: Activity, allActivities: Map<string, Activity>) => {
          openFrame.setPresenceIndicator(
            activity.name,
            activity.available
              ? openFrame.INDICATOR_COLORS.GREEN
              : openFrame.INDICATOR_COLORS.RED
          );
        }
      );

      // Set initial agent state in SNOW
      openFrame.setPresenceIndicator(
        manager.workerClient?.activity.name ?? "unknown",
        manager.workerClient?.activity.available
          ? openFrame.INDICATOR_COLORS.GREEN
          : openFrame.INDICATOR_COLORS.RED
      );

      // Register for communication event from TopFrame
      openFrame.subscribe(
        openFrame.EVENTS.COMMUNICATION_EVENT,
        handleCommunicationEvent
      );

      // Open the phone panel when were are assigned a task
      manager.workerClient?.addListener("reservationCreated", () =>
        openFrame.show()
      );

      // Invoke CTI.do when a reservation is accepted - i.e. do a screenpop
      flex.Actions.addListener("beforeAcceptTask", (payload) => {
        console.log("beforeAcceptTask", payload.task);

        // Open the interaction created by OpenFrame for Click2Dial
        if (payload.task.attributes.direction === "outbound") {
          console.log("Outbound call accepted");
          openFrame.openServiceNowForm({
            entity: "interaction",
            query: payload.task.attributes.interactionQuery,
          });
        } else {
          // These IDs are created or queried in the IVR. Property names flow through from ServiceNow.
          const { interaction_sys_id, incident_sys_id } =
            payload.task.attributes;

          // Screenpop Interaction first if it exists.
          if (interaction_sys_id) {
            openFrame.openServiceNowForm({
              entity: "interaction",
              query: `sys_id=${interaction_sys_id}`,
            });
          } else if (incident_sys_id) {
            openFrame.openServiceNowForm({
              entity: "incident",
              query: `sys_id=${incident_sys_id}`,
            });
          }
        }
      });
    }

    function initFailure(error: any) {
      console.log("OpenFrame init failed: ", error);
    }

    const onOpenframeLoaded = () => {
      // Attempt to get open frame API
      openFrame = window.openFrameAPI;

      if (openFrame && openFrame.init) {
        openFrame.init(openFrameConfig, initSuccess, initFailure);
        console.log("onOpenframeLoaded - openframe script has loaded");
      } else {
        console.log(
          "onOpenframeLoaded - openframe NOT LOADED, is this running inside ServiceNow?"
        );
      }
    };

    // Load Openframe library, async=false to ensure it loads before execution continues
    var script = document.createElement("script");
    script.src = manager.serviceConfiguration.attributes.openframe_url;
    if (script.src && script.src !== "") {
      script.async = true;
      script.onload = onOpenframeLoaded;
      document.head.appendChild(script);
    } else {
      console.log(
        "onOpenframe - ERROR manager.serviceConfiguration.attributes.openframe_url is not set"
      );
    }
  }
}
