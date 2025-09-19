export interface EccangResponse<T = unknown> {
  ack?: string | boolean | number;
  ackCode?: string;
  success?: boolean;
  code?: string;
  message?: string;
  msg?: string;
  data?: T;
  [key: string]: unknown;
}

export interface NormalizedTrackingEvent {
  occurredAt: Date;
  statusCode?: string;
  comment?: string;
  area?: string;
}
