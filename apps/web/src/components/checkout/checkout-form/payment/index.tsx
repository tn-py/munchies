import { actions } from "astro:actions";
import type { StoreCart, StorePaymentProvider } from "@medusajs/types";
import { Indicator, Item, Root } from "@radix-ui/react-radio-group";
import {
  type Dispatch,
  type SetStateAction,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Cta } from "@/components/shared/button";
import { Body } from "@/components/shared/typography/body";
import { Heading } from "@/components/shared/typography/heading";
import { PaymentButton } from "./button";
import { isAuthorizeNet } from "./utils";
import { AcceptJsContext } from "./wrapper";
import type { CardData } from "./wrapper/accept-js";

const MIN_CARD_NUMBER_LENGTH = 13;
const MAX_CARD_NUMBER_LENGTH = 19;
const MIN_MONTH = 1;
const MAX_MONTH = 12;
const SHORT_YEAR_LENGTH = 2;
const FULL_YEAR_LENGTH = 4;
const MIN_CVC_LENGTH = 3;
const MAX_CVC_LENGTH = 4;

const inputClassName =
  "pt-3 pb-1 block w-full h-11 px-4 text-accent mt-0 bg-background border-2 rounded-md appearance-none focus:outline-none focus:ring-0 focus:shadow-borders-interactive-with-active border-accent transition-all duration-300 ease-in-out";

export function Payment({
  active,
  cart,
  methods,
  setCart,
  setStep,
}: {
  active: boolean;
  cart: StoreCart;
  methods: StorePaymentProvider[];
  setCart: Dispatch<SetStateAction<StoreCart>>;
  setStep: Dispatch<
    SetStateAction<"addresses" | "delivery" | "payment" | "review">
  >;
}) {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession) => paymentSession.status === "pending"
  );

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? methods[0].id
  );

  const [card, setCard] = useState<CardData>({
    number: "",
    expMonth: "",
    expYear: "",
    cvc: "",
    name: "",
    zip: "",
  });

  const isAuthNet = isAuthorizeNet(selectedPaymentMethod);
  const acceptReady = useContext(AcceptJsContext);

  const [isPending, startTransition] = useTransition();
  const initiatingRef = useRef(false);

  function initiatePayment() {
    startTransition(async () => {
      const { error, data } = await actions.order.initiatePaymentSession({
        cart,
        data: {
          provider_id: selectedPaymentMethod,
        },
      });
      if (!error && data.cart && data.status === "success") {
        setCart(data.cart);
        if (selectedPaymentMethod === "pp_system_default") {
          setStep("review");
        }
      }
    });
  }

  // The Authorize.net button only renders once a pending session exists on the
  // cart (see button/index.tsx). Create that session as soon as the method is
  // selected so the button shows; the button later upserts it with the nonce.
  useEffect(() => {
    if (!(active && isAuthNet)) {
      return;
    }

    const hasAuthNetSession = cart.payment_collection?.payment_sessions?.some(
      (session) => isAuthorizeNet(session.provider_id)
    );

    if (hasAuthNetSession || initiatingRef.current) {
      return;
    }

    initiatingRef.current = true;
    startTransition(async () => {
      const { error, data } = await actions.order.initiatePaymentSession({
        cart,
        data: {
          provider_id: selectedPaymentMethod,
        },
      });
      if (!error && data.cart && data.status === "success") {
        setCart(data.cart);
      }
      initiatingRef.current = false;
    });
  }, [active, isAuthNet, cart, selectedPaymentMethod, setCart]);

  const activeMethod = methods.find(
    ({ id }) => id === activeSession?.provider_id
  );
  const isFilled = !!activeMethod && !active;

  const method = getMethodInfo(activeMethod?.id);

  const strippedNumber = card.number.replace(/\s+/g, "");
  const expMonthNumber = Number(card.expMonth);
  const cardComplete =
    strippedNumber.length >= MIN_CARD_NUMBER_LENGTH &&
    strippedNumber.length <= MAX_CARD_NUMBER_LENGTH &&
    expMonthNumber >= MIN_MONTH &&
    expMonthNumber <= MAX_MONTH &&
    (card.expYear.length === SHORT_YEAR_LENGTH ||
      card.expYear.length === FULL_YEAR_LENGTH) &&
    card.cvc.length >= MIN_CVC_LENGTH &&
    card.cvc.length <= MAX_CVC_LENGTH;

  return (
    <div className="flex w-full flex-col gap-8 border-accent border-t py-8">
      <div className="flex items-center justify-between">
        <Heading desktopSize="xs" font="sans" mobileSize="xs" tag="h6">
          Payment
        </Heading>
        {isFilled ? (
          <Cta onClick={() => setStep("payment")} size="sm" variant="outline">
            Edit
          </Cta>
        ) : null}
      </div>
      {isFilled ? (
        <div className="flex flex-1 flex-col gap-4">
          <Body className="font-semibold" font="sans">
            Method
          </Body>
          <Body font="sans">{method.name}</Body>
        </div>
      ) : null}
      {active ? (
        <Root
          className="flex w-full flex-col gap-4"
          defaultValue={selectedPaymentMethod}
          name="shippingMethodId"
          onValueChange={(v) => setSelectedPaymentMethod(v)}
        >
          {methods.map((item) => (
            <Item
              className="flex w-full items-center justify-between gap-2.5 rounded-lg border-[1.5px] border-accent px-[32px] py-4.75 data-[state=checked]:bg-accent data-[state=checked]:text-background"
              key={item.id}
              value={item.id}
            >
              <div className="size-4 rounded-full border border-accent">
                <Indicator id={item.id}>
                  <div className="size-4 rounded-full border-4 border-background" />
                </Indicator>
              </div>
              <div className="flex w-full items-center justify-between">
                <Body font="sans">{getMethodInfo(item.id).name}</Body>
              </div>
            </Item>
          ))}

          {isAuthNet && acceptReady ? (
            <div className="mt-5 flex flex-col gap-4 transition-all duration-150 ease-in-out">
              <Body font="sans">Enter your card details:</Body>

              <div className="flex flex-col gap-1">
                <label
                  className="font-sans text-body-sm"
                  htmlFor="authnet-card-number"
                >
                  Card number
                </label>
                <input
                  autoComplete="cc-number"
                  className={inputClassName}
                  id="authnet-card-number"
                  inputMode="numeric"
                  maxLength={MAX_CARD_NUMBER_LENGTH}
                  onChange={(e) =>
                    setCard((prev) => ({ ...prev, number: e.target.value }))
                  }
                  placeholder="4111 1111 1111 1111"
                  value={card.number}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    className="font-sans text-body-sm"
                    htmlFor="authnet-exp-month"
                  >
                    Exp. month
                  </label>
                  <input
                    autoComplete="cc-exp-month"
                    className={inputClassName}
                    id="authnet-exp-month"
                    inputMode="numeric"
                    maxLength={2}
                    onChange={(e) =>
                      setCard((prev) => ({ ...prev, expMonth: e.target.value }))
                    }
                    placeholder="MM"
                    value={card.expMonth}
                  />
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <label
                    className="font-sans text-body-sm"
                    htmlFor="authnet-exp-year"
                  >
                    Exp. year
                  </label>
                  <input
                    autoComplete="cc-exp-year"
                    className={inputClassName}
                    id="authnet-exp-year"
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(e) =>
                      setCard((prev) => ({ ...prev, expYear: e.target.value }))
                    }
                    placeholder="YYYY"
                    value={card.expYear}
                  />
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <label
                    className="font-sans text-body-sm"
                    htmlFor="authnet-cvc"
                  >
                    CVC
                  </label>
                  <input
                    autoComplete="cc-csc"
                    className={inputClassName}
                    id="authnet-cvc"
                    inputMode="numeric"
                    maxLength={MAX_CVC_LENGTH}
                    onChange={(e) =>
                      setCard((prev) => ({ ...prev, cvc: e.target.value }))
                    }
                    placeholder="123"
                    value={card.cvc}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    className="font-sans text-body-sm"
                    htmlFor="authnet-name"
                  >
                    Name on card (optional)
                  </label>
                  <input
                    autoComplete="cc-name"
                    className={inputClassName}
                    id="authnet-name"
                    onChange={(e) =>
                      setCard((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Jane Doe"
                    value={card.name}
                  />
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <label
                    className="font-sans text-body-sm"
                    htmlFor="authnet-zip"
                  >
                    ZIP (optional)
                  </label>
                  <input
                    autoComplete="postal-code"
                    className={inputClassName}
                    id="authnet-zip"
                    inputMode="numeric"
                    maxLength={10}
                    onChange={(e) =>
                      setCard((prev) => ({ ...prev, zip: e.target.value }))
                    }
                    placeholder="33101"
                    value={card.zip}
                  />
                </div>
              </div>

              <PaymentButton card={card} cart={cart} disabled={!cardComplete} />
            </div>
          ) : (
            <Cta
              loading={isPending}
              onClick={initiatePayment}
              size="sm"
              type="submit"
            >
              Continue to review
            </Cta>
          )}
        </Root>
      ) : null}
    </div>
  );
}

function getMethodInfo(id?: string) {
  switch (id) {
    case "pp_system_default":
      return {
        id,
        name: "Testing method",
      };
    case "pp_authorizenet_authorizenet":
      return {
        id,
        name: "Credit Card",
      };
    default:
      return {
        id,
        name: "Unknown",
      };
  }
}
