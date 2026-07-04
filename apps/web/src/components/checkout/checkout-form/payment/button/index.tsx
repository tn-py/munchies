import type { HttpTypes } from "@medusajs/types";
import { isAuthorizeNet, isManual } from "../utils";
import type { CardData } from "../wrapper/accept-js";
import { AuthorizeNetPaymentButton } from "./authorizenet";
import { ManualPaymentButton } from "./manual";

interface Props {
  cart: HttpTypes.StoreCart;
  card?: CardData;
  disabled?: boolean;
}
export function PaymentButton({ cart, card, disabled }: Props) {
  const paymentSession = cart.payment_collection?.payment_sessions?.[0];

  const notReady = !(cart?.shipping_address && cart?.email) || disabled;

  if (isAuthorizeNet(paymentSession?.provider_id)) {
    return (
      <AuthorizeNetPaymentButton
        card={card as CardData}
        cart={cart}
        notReady={Boolean(notReady)}
      />
    );
  }

  if (isManual(paymentSession?.provider_id)) {
    return <ManualPaymentButton notReady={Boolean(notReady)} />;
  }
}
