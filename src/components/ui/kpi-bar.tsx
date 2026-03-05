import { cn } from "@/lib/utils";

export type KpiItem = {
  label: string;
  value: React.ReactNode;
  hint?: string;
};

export function KpiBar({
  items,
  className,
}: {
  items: KpiItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative w-full rounded-xl border border-border/70",
        "bg-card/75 backdrop-blur supports-[backdrop-filter]:bg-card/60",
        "px-4 py-3",
        "before:absolute before:inset-x-4 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-primary/70 before:to-transparent",
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="group">
            <div className="text-xs font-medium text-muted-foreground">
              {item.label}
            </div>
            <div
              className={cn(
                "mt-1 flex items-baseline gap-2",
                "transition-colors duration-150 group-hover:text-foreground"
              )}
            >
              <div className="text-lg font-semibold tracking-tight font-display">
                {item.value}
              </div>
              {item.hint ? (
                <div className="text-xs text-muted-foreground">{item.hint}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
