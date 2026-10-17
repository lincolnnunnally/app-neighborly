import { cn } from "@/lib/utils";

export function ChipSelect({
  options,
  value,
  onChange,
  multi = true,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (multi) {
                onChange(
                  selected ? value.filter((v) => v !== opt) : [...value, opt],
                );
              } else {
                onChange(selected ? [] : [opt]);
              }
            }}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm transition-colors",
              selected
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-bg-elevated text-fg-muted hover:border-border-strong",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
