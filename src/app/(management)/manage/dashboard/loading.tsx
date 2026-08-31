export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((slot) => (
          <div key={slot} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <ul className="grid gap-3">
        {[0, 1].map((slot) => (
          <li key={slot} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </ul>
    </div>
  );
}
