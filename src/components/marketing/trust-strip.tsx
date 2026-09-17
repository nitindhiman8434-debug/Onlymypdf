import { Shield, Clock, Zap } from "lucide-react";

export function TrustStrip({ className = "" }: { className?: string }) {
  const items = [
    { icon: Clock, text: "2h Free file retention" },
    { icon: Shield, text: "Secure SSL processing" },
    { icon: Zap, text: "No signup for basic tools" },
  ];

  return (
    <div
      className={`pd-trust-strip flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-b border-pd-border bg-pd-surface px-4 py-2.5 text-xs text-pd-muted lg:justify-start ${className}`}
    >
      {items.map(({ icon: Icon, text }) => (
        <span key={text} className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-pd-brand" aria-hidden />
          {text}
        </span>
      ))}
    </div>
  );
}
