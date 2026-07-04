import {
  PUBLIC_AUTHNET_API_LOGIN_ID,
  PUBLIC_AUTHNET_CLIENT_KEY,
  PUBLIC_AUTHNET_ENVIRONMENT,
} from "astro:env/client";
import { useEffect, useState } from "react";

const ACCEPT_JS_SRC =
  PUBLIC_AUTHNET_ENVIRONMENT === "production"
    ? "https://js.authorize.net/v1/Accept.js"
    : "https://jstest.authorize.net/v1/Accept.js";

const POLL_INTERVAL_MS = 150;

interface AcceptResponse {
  messages: { resultCode: string; message: { code: string; text: string }[] };
  opaqueData: { dataDescriptor: string; dataValue: string };
}

declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        secureData: unknown,
        cb: (response: AcceptResponse) => void
      ) => void;
    };
  }
}

export interface CardData {
  number: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  name?: string;
  zip?: string;
}

export function useAcceptJs(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.Accept) {
      setReady(true);
      return;
    }

    let interval: ReturnType<typeof setInterval> | undefined;

    const markReady = () => {
      if (window.Accept) {
        setReady(true);
        if (interval) {
          clearInterval(interval);
          interval = undefined;
        }
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${ACCEPT_JS_SRC}"]`
    );

    if (existing) {
      existing.addEventListener("load", markReady);
    } else {
      const script = document.createElement("script");
      script.src = ACCEPT_JS_SRC;
      script.async = true;
      script.addEventListener("load", markReady);
      document.head.appendChild(script);
    }

    interval = setInterval(markReady, POLL_INTERVAL_MS);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  return ready;
}

export function tokenizeCard(
  card: CardData
): Promise<{ dataDescriptor: string; dataValue: string }> {
  return new Promise((resolve, reject) => {
    if (!window.Accept) {
      reject(new Error("Accept.js is not loaded yet. Please try again."));
      return;
    }

    const secureData = {
      authData: {
        clientKey: PUBLIC_AUTHNET_CLIENT_KEY,
        apiLoginID: PUBLIC_AUTHNET_API_LOGIN_ID,
      },
      cardData: {
        cardNumber: card.number.replace(/\s+/g, ""),
        month: card.expMonth,
        year: card.expYear,
        cardCode: card.cvc,
        zip: card.zip,
        fullName: card.name,
      },
    };

    window.Accept.dispatchData(secureData, (response) => {
      if (response.messages.resultCode === "Error") {
        reject(
          new Error(
            response.messages.message
              .map((m) => `[${m.code}] ${m.text}`)
              .join("; ")
          )
        );
      } else {
        resolve(response.opaqueData);
      }
    });
  });
}
