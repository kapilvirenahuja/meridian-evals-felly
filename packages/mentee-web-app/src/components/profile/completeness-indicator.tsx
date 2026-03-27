'use client';

interface CompletenessIndicatorProps {
  completeness: number;
  label?: string;
}

export function CompletenessIndicator({
  completeness,
  label = 'Profile Completeness',
}: CompletenessIndicatorProps) {
  const getColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getMessage = (pct: number) => {
    if (pct === 100) return 'Your profile is complete!';
    if (pct >= 80) return 'Almost there — add a few more details.';
    if (pct >= 50) return 'Keep going — fill in more details to stand out.';
    return 'Start filling in your profile to get better matches.';
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-2xl font-bold text-foreground">{completeness}%</span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${getColor(completeness)}`}
          style={{ width: `${completeness}%` }}
          role="progressbar"
          aria-valuenow={completeness}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{getMessage(completeness)}</p>
    </div>
  );
}
