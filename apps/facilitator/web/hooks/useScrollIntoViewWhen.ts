import { useEffect } from "preact/hooks";
import type { RefObject } from "preact";

/**
 * Smoothly scrolls `ref` into view whenever `value` transitions to a
 * non-nullish value. Used to follow the demo flow as new sections appear.
 */
export function useScrollIntoViewWhen(
  value: unknown,
  ref: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (value != null)
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [value]);
}
