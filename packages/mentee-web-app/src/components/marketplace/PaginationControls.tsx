'use client';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1 && total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  // Compute page buttons (up to 5)
  const getPageNumbers = () => {
    const range: number[] = [];
    const delta = 2;
    const left = Math.max(1, page - delta);
    const right = Math.min(totalPages, page + delta);

    for (let i = left; i <= right; i++) {
      range.push(i);
    }

    return range;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {total > 0 ? `Showing ${from}–${to} of ${total} mentors` : 'No mentors found'}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            ‹
          </button>

          {pageNumbers[0] > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm hover:bg-muted transition-colors"
              >
                1
              </button>
              {pageNumbers[0] > 2 && <span className="px-1 text-muted-foreground text-sm">…</span>}
            </>
          )}

          {pageNumbers.map((n) => (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors ${
                n === page
                  ? 'border-foreground bg-foreground text-background font-medium'
                  : 'border-border hover:bg-muted'
              }`}
              aria-current={n === page ? 'page' : undefined}
            >
              {n}
            </button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                <span className="px-1 text-muted-foreground text-sm">…</span>
              )}
              <button
                onClick={() => onPageChange(totalPages)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm hover:bg-muted transition-colors"
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
