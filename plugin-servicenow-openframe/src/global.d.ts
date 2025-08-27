declare interface ServiceNowOpenframeConfig {
  height?: number;
  width?: number;
  title?: string;
  subTitle?: string;
  titleIcon?: string;
}

declare interface ServiceNowOpenframeFormDetails {
  entity: string;
  interaction_sys_id?: string;
  query: string;
}

declare interface ServiceNowOpenframeListDetails {
  entity: string;
  query: string;
}

declare interface FRAME_MODE {
  COLLAPSE: string;
  EXPAND: string;
}

declare interface EVENTS {
  HEADER_ICON_CLICKED: string;
  ICON_CLICKED: string;
  TITLE_ICON_CLICKED: string;
  OPENFRAME_SHOWN: string;
  OPENFRAME_HIDDEN: string;
  OPENFRAME_BEFORE_DESTROY: string;
  COMMUNICATION_EVENT: string;
  COMMUNICATION_FAILURE: string;
  EXPAND: string;
  COLLAPSE: string;
}

declare interface INDICATOR_COLORS {
  GREEN: string;
  RED: string;
  ORANGE: string;
  GREY: string;
}

declare interface Window {
  openFrameAPI: {
    EVENTS: EVENTS;
    FRAME_MODE: FRAME_MODE;
    INDICATOR_COLORS: INDICATOR_COLORS;
    init(
      config: ServiceNowOpenframeConfig,
      successCallback: (ServiceNowOpenframeConfig) => void,
      failureCallback: (error: any) => void
    ): void;
    version(): string;
    show(): void;
    hide(): void;
    isVisible(successCallback: (boolean) => void): void;
    subscribe(event: string, callback: (context: any) => void): void;
    setTitle(title: string): void;
    setSubtitle(subtitle: string): void;
    setSize(width: number, height: number): void;
    setIcons(iconList: [object]): void;
    setTitleIcon(icon: object): void;
    openServiceNowForm(details: ServiceNowOpenframeFormDetails): void;
    openServiceNowList(details: ServiceNowOpenframeListDetails): void;
    openCustomURL(url: string): void;
    openInteraction(interactionSysId: any): void;
    setFrameMode(mode: string): void;
    setHeight(height: number): void;
    setWidth(width: number): void;
    setPresenceIndicator(state: string, color: string): void;
  };
}
