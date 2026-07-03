import crypto from "node:crypto";
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";
import {
  AbstractPaymentProvider,
  BigNumber,
  MedusaError,
  PaymentActions,
} from "@medusajs/framework/utils";
import pkg from "authorizenet";
import {
  assertApproved,
  assertRequestOk,
  buildMerchantAuth,
  executeController,
  isNotSettledError,
  resolveEndpoint,
  verifyAnetSignature,
} from "./client";
import type {
  AuthorizeNetOptions,
  AuthorizeNetPaymentData,
  AuthorizeNetSessionData,
} from "./types";

const { APIContracts, APIControllers } = pkg;

interface InjectedDependencies {
  // The DI cradle passed to providers is a `Record<string, unknown>` holding
  // every registered dependency; we only type the ones we use.
  [key: string]: unknown;
  logger: Logger;
}

const SETTLED_SUCCESSFULLY = "settledSuccessfully";
const BRACKETED_ERROR_CODE_REGEX = /\[([A-Z0-9]+)\]/;

class AuthorizeNetProviderService extends AbstractPaymentProvider<AuthorizeNetOptions> {
  static identifier = "authorizenet";

  static validateOptions(options: AuthorizeNetOptions): void {
    if (!options.apiLoginId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Authorize.net provider requires the `apiLoginId` option"
      );
    }

    if (!options.transactionKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Authorize.net provider requires the `transactionKey` option"
      );
    }
  }

  protected logger_: Logger;
  protected options_: AuthorizeNetOptions;
  protected endpoint_: string;

  constructor(container: InjectedDependencies, options: AuthorizeNetOptions) {
    super(container, options);

    this.logger_ = container.logger;
    this.options_ = options;
    this.endpoint_ = resolveEndpoint(options.environment);
  }

  /**
   * Submits a transaction request (auth, capture, refund, void) to the
   * Authorize.net gateway. Always pins the environment before executing,
   * otherwise the SDK silently defaults to sandbox.
   */
  private async createTransaction(txnRequest: any): Promise<any> {
    const request = new APIContracts.CreateTransactionRequest();
    request.setMerchantAuthentication(
      buildMerchantAuth(this.options_.apiLoginId, this.options_.transactionKey)
    );
    request.setTransactionRequest(txnRequest);

    const controller = new APIControllers.CreateTransactionController(
      request.getJSON()
    );
    controller.setEnvironment(this.endpoint_);

    const response = await executeController<any>(
      controller,
      APIContracts.CreateTransactionResponse
    );
    assertRequestOk(response);
    return response;
  }

  /**
   * Fetches the full transaction record so we can inspect settlement status
   * and stored user fields (e.g. the Medusa session id).
   */
  private async getDetails(transactionId: string): Promise<any> {
    const request = new APIContracts.GetTransactionDetailsRequest();
    request.setMerchantAuthentication(
      buildMerchantAuth(this.options_.apiLoginId, this.options_.transactionKey)
    );
    request.setTransId(transactionId);

    const controller = new APIControllers.GetTransactionDetailsController(
      request.getJSON()
    );
    controller.setEnvironment(this.endpoint_);

    const response = await executeController<any>(
      controller,
      APIContracts.GetTransactionDetailsResponse
    );
    assertRequestOk(response);
    return response.getTransaction();
  }

  private buildBillTo(billTo: Record<string, string>): any {
    const address = new APIContracts.CustomerAddressType();

    if (billTo.first_name) {
      address.setFirstName(billTo.first_name);
    }
    if (billTo.last_name) {
      address.setLastName(billTo.last_name);
    }
    if (billTo.company) {
      address.setCompany(billTo.company);
    }
    if (billTo.address) {
      address.setAddress(billTo.address);
    }
    if (billTo.city) {
      address.setCity(billTo.city);
    }
    if (billTo.state) {
      address.setState(billTo.state);
    }
    if (billTo.zip) {
      address.setZip(billTo.zip);
    }
    if (billTo.country) {
      address.setCountry(billTo.country);
    }

    return address;
  }

  private buildSessionUserFields(sessionId: string): any {
    const userField = new APIContracts.UserField();
    userField.setName("medusa_session_id");
    userField.setValue(sessionId);

    const userFields = new APIContracts.TransactionRequestType.UserFields();
    userFields.setUserField([userField]);
    return userFields;
  }

  private extractErrorCode(error: unknown): string {
    if (error instanceof Error) {
      const match = error.message.match(BRACKETED_ERROR_CODE_REGEX);
      return match?.[1] ?? "";
    }
    return "";
  }

  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const id = (input.context?.idempotency_key as string) ?? crypto.randomUUID();

    return Promise.resolve({
      id,
      data: {
        ...(input.data ?? {}),
        amount: Number(input.amount),
        currency_code: input.currency_code,
      },
    });
  }

  updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return Promise.resolve({
      data: {
        ...(input.data ?? {}),
        amount: Number(input.amount),
        currency_code: input.currency_code,
      },
    });
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const data = input.data as AuthorizeNetSessionData;

    if (!data?.opaque_data?.dataValue) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing Authorize.net payment nonce"
      );
    }

    const sessionId = String(input.context?.idempotency_key ?? "");

    const opaqueData = new APIContracts.OpaqueDataType();
    opaqueData.setDataDescriptor(data.opaque_data.dataDescriptor);
    opaqueData.setDataValue(data.opaque_data.dataValue);

    const payment = new APIContracts.PaymentType();
    payment.setOpaqueData(opaqueData);

    const txnRequest = new APIContracts.TransactionRequestType();
    txnRequest.setTransactionType(
      APIContracts.TransactionTypeEnum.AUTHONLYTRANSACTION
    );
    txnRequest.setPayment(payment);
    txnRequest.setAmount(Number(data.amount).toFixed(2));

    if (data.bill_to) {
      txnRequest.setBillTo(this.buildBillTo(data.bill_to));
    }

    txnRequest.setUserFields(this.buildSessionUserFields(sessionId));

    const response = await this.createTransaction(txnRequest);
    const transaction = assertApproved(response.getTransactionResponse());

    return {
      status: "authorized",
      data: {
        transactionId: transaction.getTransId(),
        authCode: transaction.getAuthCode?.(),
        accountType: transaction.getAccountType?.(),
        lastFour: String(transaction.getAccountNumber?.() ?? "").slice(-4),
        amount: Number(data.amount),
        currency_code: data.currency_code,
        captured: false,
        medusa_session_id: sessionId,
      },
    };
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const data = input.data as AuthorizeNetPaymentData;

    const txnRequest = new APIContracts.TransactionRequestType();
    txnRequest.setTransactionType(
      APIContracts.TransactionTypeEnum.PRIORAUTHCAPTURETRANSACTION
    );
    txnRequest.setRefTransId(data.transactionId);
    txnRequest.setAmount(Number(data.amount).toFixed(2));

    const response = await this.createTransaction(txnRequest);
    const transaction = assertApproved(response.getTransactionResponse());

    return {
      data: {
        ...data,
        captureTransactionId: transaction.getTransId(),
        captured: true,
      },
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = input.data as AuthorizeNetPaymentData;
    const refId = data.captureTransactionId ?? data.transactionId;

    // A transaction can only be refunded once it has settled. While it is still
    // pending settlement (authorizedPendingCapture / capturedPendingSettlement)
    // the correct action is to void it instead.
    let isSettled = false;
    try {
      const details = await this.getDetails(refId);
      isSettled = details?.getTransactionStatus?.() === SETTLED_SUCCESSFULLY;
    } catch {
      isSettled = false;
    }

    if (!isSettled) {
      return await this.cancelPayment(input);
    }

    const creditCard = new APIContracts.CreditCardType();
    creditCard.setCardNumber(data.lastFour);
    creditCard.setExpirationDate("XXXX");

    const payment = new APIContracts.PaymentType();
    payment.setCreditCard(creditCard);

    const txnRequest = new APIContracts.TransactionRequestType();
    txnRequest.setTransactionType(
      APIContracts.TransactionTypeEnum.REFUNDTRANSACTION
    );
    txnRequest.setPayment(payment);
    txnRequest.setRefTransId(refId);
    txnRequest.setAmount(Number(input.amount).toFixed(2));

    let transaction: any;
    try {
      const response = await this.createTransaction(txnRequest);
      transaction = assertApproved(response.getTransactionResponse());
    } catch (error) {
      // Authorize.net reports E00027 when the referenced charge has not settled
      // yet; in that race we fall back to voiding the transaction.
      if (isNotSettledError(this.extractErrorCode(error))) {
        return await this.cancelPayment(input);
      }
      throw error;
    }

    return {
      data: {
        ...data,
        refunds: [
          ...(data.refunds ?? []),
          {
            refundTransactionId: transaction.getTransId(),
            amount: Number(input.amount),
          },
        ],
      },
    };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = input.data as AuthorizeNetPaymentData;

    if (data?.voided) {
      return { data };
    }

    const txnRequest = new APIContracts.TransactionRequestType();
    txnRequest.setTransactionType(
      APIContracts.TransactionTypeEnum.VOIDTRANSACTION
    );
    txnRequest.setRefTransId(data.transactionId);

    const response = await this.createTransaction(txnRequest);
    const transaction = assertApproved(response.getTransactionResponse());

    return {
      data: {
        ...data,
        voided: true,
        voidTransactionId: transaction.getTransId(),
      },
    };
  }

  deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return Promise.resolve({ data: input.data ?? {} });
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const data = input.data as AuthorizeNetPaymentData;

    if (!data?.transactionId) {
      return { data: input.data ?? {} };
    }

    const transaction = await this.getDetails(
      data.captureTransactionId ?? data.transactionId
    );

    return {
      data: {
        ...data,
        gatewayStatus: transaction.getTransactionStatus?.(),
        settleAmount: transaction.getSettleAmount?.(),
      },
    };
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const data = input.data as AuthorizeNetPaymentData;

    if (!data?.transactionId) {
      return { status: "pending", data: input.data ?? {} };
    }

    const transaction = await this.getDetails(
      data.captureTransactionId ?? data.transactionId
    );

    let status: GetPaymentStatusOutput["status"];
    switch (transaction.getTransactionStatus()) {
      case "authorizedPendingCapture":
        status = "authorized";
        break;
      case "capturedPendingSettlement":
      case SETTLED_SUCCESSFULLY:
      case "refundPendingSettlement":
      case "refundSettledSuccessfully":
        status = "captured";
        break;
      case "voided":
        status = "canceled";
        break;
      case "declined":
      case "expired":
      case "FDSPendingReview":
      case "failedReview":
        status = "error";
        break;
      default:
        status = "pending";
    }

    return { status, data: input.data };
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { data, rawData, headers } = payload;

    const signature = (headers["x-anet-signature"] ??
      headers["X-ANET-Signature"]) as string | undefined;

    if (!verifyAnetSignature(rawData, signature, this.options_.signatureKey)) {
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    const eventType = (data as any).eventType as string;
    const transactionId = (data as any).payload?.id;

    let action: WebhookActionResult["action"];
    if (eventType?.includes("authorization.created")) {
      action = PaymentActions.AUTHORIZED;
    } else if (
      eventType &&
      (eventType.includes("capture.created") ||
        eventType.includes("authcapture.created") ||
        eventType.includes("priorAuthCapture.created"))
    ) {
      action = PaymentActions.SUCCESSFUL;
    } else if (eventType?.includes("void.created")) {
      action = PaymentActions.CANCELED;
    } else if (eventType?.includes("refund.created")) {
      action = PaymentActions.SUCCESSFUL;
    } else if (eventType?.includes("fraud.declined")) {
      action = PaymentActions.FAILED;
    } else {
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    let sessionId = "";
    try {
      const transaction = await this.getDetails(transactionId);
      const fields = transaction.getUserFields?.()?.getUserField?.() ?? [];
      const field = fields.find(
        (entry: any) => entry.getName?.() === "medusa_session_id"
      );
      sessionId = field?.getValue?.() ?? "";
    } catch {
      // The session id lookup is best-effort; ignore failures here.
    }

    const amount = new BigNumber(Number((data as any).payload?.authAmount ?? 0));

    return {
      action,
      data: {
        session_id: sessionId,
        amount,
      },
    };
  }
}

export default AuthorizeNetProviderService;
