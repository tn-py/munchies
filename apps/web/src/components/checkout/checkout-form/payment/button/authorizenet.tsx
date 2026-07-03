import { actions } from "astro:actions";
import { navigate } from "astro:transitions/client";
import type { HttpTypes } from "@medusajs/types";
import { useState, useTransition } from "react";
import { Cta } from "@/components/shared/button";
import { Body } from "@/components/shared/typography/body";
import { type CardData, tokenizeCard } from "../wrapper/accept-js";

export function AuthorizeNetPaymentButton({
  cart,
  card,
  notReady,
}: {
  cart: HttpTypes.StoreCart;
  card: CardData;
  notReady: boolean;
}) {
  const [errorMessage, setErrorMessage] = useState<null | string>(null);
  const [isPending, startTransition] = useTransition();

  const handlePayment = () => {
    setErrorMessage(null);
    startTransition(async () => {
      let opaque: { dataDescriptor: string; dataValue: string };
      try {
        // Accept.js nonces are single-use and expire ~15min, so we always
        // re-tokenize on each click — a retry safely produces a fresh nonce.
        opaque = await tokenizeCard(card);
      } catch (err) {
        setErrorMessage((err as Error).message);
        return;
      }

      const bill_to = {
        first_name: cart.billing_address?.first_name,
        last_name: cart.billing_address?.last_name,
        company: cart.billing_address?.company,
        address: cart.billing_address?.address_1,
        city: cart.billing_address?.city,
        state: cart.billing_address?.province,
        zip: cart.billing_address?.postal_code,
        country: cart.billing_address?.country_code,
      };

      const res = await actions.order.updatePaymentSession({
        cart,
        data: {
          provider_id: "pp_authorizenet_authorizenet",
          data: {
            opaque_data: opaque,
            bill_to,
            email: cart.email,
          },
        },
      });

      if (res.error || res.data?.status !== "success") {
        setErrorMessage(
          "Could not attach payment details. Please try again."
        );
        return;
      }

      const placed = await actions.order.placeOrder();

      if (!placed.error && placed.data?.redirect) {
        navigate(placed.data.redirect);
      } else {
        setErrorMessage("Payment could not be completed.");
      }
    });
  };

  return (
    <>
      <Cta
        className="w-full"
        disabled={notReady}
        loading={isPending}
        onClick={handlePayment}
        size="sm"
      >
        Complete order
      </Cta>
      <Body font="sans">{errorMessage}</Body>
    </>
  );
}
