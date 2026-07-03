export interface AuthorizeNetOptions {
  apiLoginId: string;
  transactionKey: string;
  signatureKey: string;
  environment?: "sandbox" | "production";
}

export interface AuthorizeNetSessionData {
  // Session data round-trips through Medusa's `Record<string, unknown>` payment
  // session `data` field, which can carry additional keys.
  [key: string]: unknown;
  amount: number;
  currency_code: string;
  opaque_data?: {
    dataDescriptor: string;
    dataValue: string;
  };
  bill_to?: Record<string, string>;
  email?: string;
}

export interface AuthorizeNetPaymentData {
  [key: string]: unknown;
  transactionId: string;
  authCode?: string;
  accountType?: string;
  lastFour: string;
  amount: number;
  currency_code: string;
  captured: boolean;
  captureTransactionId?: string;
  voidTransactionId?: string;
  voided?: boolean;
  refunds?: {
    refundTransactionId: string;
    amount: number;
  }[];
  medusa_session_id?: string;
}
