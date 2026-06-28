import { cx } from "class-variance-authority";
import { Label } from "./typography/label";

export function Tag({
  className,
  text,
}: {
  className?: string;
  text: string | undefined;
}) {
  return (
    <Label
      className={cx(
        "bg-highlight px-1 py-px text-end text-background",
        className
      )}
      desktopSize="sm"
      font="display"
      mobileSize="2xs"
    >
      {text}
    </Label>
  );
}
