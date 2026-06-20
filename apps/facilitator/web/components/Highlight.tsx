import { useMemo } from "preact/hooks";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";

const codeBlockCls =
  "bg-c0 border border-edge rounded-md p-4 px-4 font-mono text-xs text-ink-2 overflow-auto max-h-80 whitespace-pre leading-[1.55] m-0";

export function JsonBlock({
  value,
  style,
}: {
  value: unknown;
  style?: string | Record<string, string | number>;
}) {
  const html = useMemo(() => {
    const code = JSON.stringify(value, null, 2);
    return Prism.highlight(code, Prism.languages["json"]!, "json");
  }, [value]);
  return (
    <pre
      class={codeBlockCls}
      style={style as never}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function TsBlock({
  code,
  style,
}: {
  code: string;
  style?: string | Record<string, string | number>;
}) {
  const html = useMemo(
    () => Prism.highlight(code, Prism.languages["typescript"]!, "typescript"),
    [code],
  );
  return (
    <pre
      class={codeBlockCls}
      style={style as never}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
