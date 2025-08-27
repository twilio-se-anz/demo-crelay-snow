export interface ServiceNowMessage {
  type: string;
  data: Data;
}

export interface Data {
  data: Daum[];
  metaData: MetaData;
}

export interface Daum {
  entity: string;
  query: string;
  value: string;
  label: string;
  display?: boolean;
}

export interface MetaData {
  phoneNumber: string;
}
