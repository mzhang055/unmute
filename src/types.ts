export interface Message {
  action: string;
  data?: unknown;
}

export interface ButtonClickMessage extends Message {
  action: 'buttonClicked';
}

export interface MessageResponse {
  status: 'success' | 'error';
  message?: string;
}