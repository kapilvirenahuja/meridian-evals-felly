import { IPublicAvailabilitySlot } from '@felly/shared-types';

interface AvailabilityDisplayProps {
  slots: IPublicAvailabilitySlot[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(timeStr: string): string {
  // Format "HH:MM" to "HH:MM AM/PM"
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = minutesStr || '00';
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

export function AvailabilityDisplay({ slots }: AvailabilityDisplayProps) {
  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground italic">Not accepting sessions</p>
      </div>
    );
  }

  // Group slots by dayOfWeek
  const byDay = new Map<number, IPublicAvailabilitySlot[]>();
  for (const slot of slots) {
    if (!byDay.has(slot.dayOfWeek)) {
      byDay.set(slot.dayOfWeek, []);
    }
    const existing = byDay.get(slot.dayOfWeek);
    if (existing) {
      existing.push(slot);
    }
  }

  // Sort days 0–6
  const sortedDays = Array.from(byDay.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-2">
      {sortedDays.map((day) => {
        const daySlots = byDay.get(day) ?? [];
        return (
          <div key={day} className="flex items-center gap-2 text-sm">
            <span className="w-28 font-medium text-foreground">{DAY_NAMES[day]}:</span>
            <div className="flex flex-wrap gap-1.5">
              {daySlots.map((slot) => (
                <span
                  key={slot.id}
                  className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {formatTime(slot.startTimeUtc)} – {formatTime(slot.endTimeUtc)}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
