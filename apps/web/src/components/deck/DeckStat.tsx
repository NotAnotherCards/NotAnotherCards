export function DeckStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-center justify-center rounded-lg border border-border/40 bg-muted/40 px-2 py-1.5 text-sm font-medium ${className ?? ''}`}
    >
      <span className="w-full text-center tabular-nums text-foreground">
        {value} {label}
      </span>
    </div>
  );
}
