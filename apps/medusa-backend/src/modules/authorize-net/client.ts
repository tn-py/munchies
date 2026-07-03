import crypto from "node:crypto";
import pkg from "authorizenet";

const { APIContracts, Constants } = pkg;

/**
 * Resolves the Authorize.net API endpoint for the configured environment.
 * Defaults to the sandbox endpoint unless `production` is explicitly set.
 */
export function resolveEndpoint(env?: "sandbox" | "production"): string {
  return env === "production"
    ? Constants.endpoint.production
    : Constants.endpoint.sandbox;
}

/**
 * Builds the merchant authentication object used on every API request.
 */
export function buildMerchantAuth(
  apiLoginId: string,
  transactionKey: string
): any {
  const merchantAuth = new APIContracts.MerchantAuthenticationType();
  merchantAuth.setName(apiLoginId);
  merchantAuth.setTransactionKey(transactionKey);
  return merchantAuth;
}

/**
 * Promisifies an Authorize.net controller execution. The SDK uses a
 * callback-based API and stores the response on the controller itself, so we
 * read it back inside the callback and wrap it in the provided response type.
 */
export function executeController<T>(
  controller: any,
  ResponseCtor: new (raw: any) => T
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      controller.execute(() => {
        const raw = controller.getResponse();
        if (raw) {
          resolve(new ResponseCtor(raw));
        } else {
          reject(new Error("Authorize.net returned a null response"));
        }
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Throws when the API request envelope itself reports a non-OK result code.
 */
export function assertRequestOk(res: any): void {
  const messages = res.getMessages();
  if (messages?.getResultCode() === APIContracts.MessageTypeEnum.OK) {
    return;
  }

  const message = messages?.getMessage()?.[0];
  const code = message?.getCode?.() ?? "unknown";
  const text = message?.getText?.() ?? "Authorize.net request failed";
  throw new Error(`Authorize.net error [${code}]: ${text}`);
}

/**
 * Returns the transaction response when it was approved (response code "1"),
 * otherwise throws an error built from the transaction-level error details.
 */
export function assertApproved(transactionResponse: any): any {
  if (transactionResponse && transactionResponse.getResponseCode() === "1") {
    return transactionResponse;
  }

  const error = transactionResponse?.getErrors?.()?.getError?.()?.[0];
  const code = error?.getErrorCode?.() ?? "declined";
  const text = error?.getErrorText?.() ?? "Transaction declined";
  throw new Error(`Authorize.net transaction declined [${code}]: ${text}`);
}

/**
 * E00027 is returned when a transaction cannot be processed because the
 * referenced transaction has not settled yet (e.g. refunding an unsettled
 * charge). Callers fall back to voiding the transaction in that case.
 */
export function isNotSettledError(code: string): boolean {
  return code === "E00027";
}

const SIGNATURE_PREFIX_REGEX = /^sha512=/i;

/**
 * Verifies an Authorize.net webhook signature using the HMAC-SHA512 signature
 * key. Performs a constant-time comparison to avoid timing attacks.
 */
export function verifyAnetSignature(
  rawBody: string | Buffer,
  headerValue: string | undefined,
  signatureKey: string
): boolean {
  const provided = (headerValue || "")
    .replace(SIGNATURE_PREFIX_REGEX, "")
    .toUpperCase();
  const computed = crypto
    .createHmac("sha512", Buffer.from(signatureKey, "hex"))
    .update(rawBody)
    .digest("hex")
    .toUpperCase();

  if (!provided || provided.length !== computed.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(computed));
}
