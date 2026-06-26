import type { Header as HeaderType } from "sanity.types";
import { LocalizedLink } from "@/components/shared//localized-link";
import type { Country } from "@/lib/medusa/regions";
import { CountrySelectorDialog } from "./country-selector-dialog";
import { Hamburger } from "./parts/hamburger";
import { Navigation } from "./parts/navigation";

interface HeaderClientProps {
  header: HeaderType;
  countries: Country[];
  cartNode?: React.ReactNode;
}

export function HeaderClient({
  header,
  countries,
  cartNode,
}: HeaderClientProps) {
  return (
    <div className="mx-auto flex w-full max-w-max-screen items-center justify-between gap-2xl px-m py-xs lg:px-xl">
      <div className="flex items-center gap-m">
        <div className="flex items-center justify-start gap-s">
          <Hamburger countries={countries} data={header} />
          <LocalizedLink href="/">
            <img
              alt="Best Vapes logo"
              className="my-1.5 h-10 w-auto lg:my-2 lg:h-12"
              height={46}
              loading="eager"
              src="/images/best-vapes-logo.png"
              width={48}
            />
          </LocalizedLink>
        </div>
        <Navigation data={header} />
      </div>
      <div className="flex items-center gap-s">
        <span className="hidden lg:block" id="country-selector">
          <CountrySelectorDialog countries={countries} />
        </span>
        {cartNode}
      </div>
    </div>
  );
}
