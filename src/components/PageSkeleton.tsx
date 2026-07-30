export function PageSkeleton() {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8" aria-busy="true" aria-label="Loading page content">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-lg bg-stone-200 dark:bg-stone-700" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-4 w-5/6 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-4 w-4/6 rounded bg-stone-200 dark:bg-stone-700" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-32 rounded-2xl bg-stone-200 dark:bg-stone-700" />
          <div className="h-32 rounded-2xl bg-stone-200 dark:bg-stone-700" />
          <div className="h-32 rounded-2xl bg-stone-200 dark:bg-stone-700" />
        </div>
        <div className="h-64 rounded-2xl bg-stone-200 dark:bg-stone-700" />
      </div>
    </div>
  );
}
