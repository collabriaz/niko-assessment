export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-muted" />
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <li key={slot} className="h-56 animate-pulse rounded-lg bg-muted" />
        ))}
      </ul>
    </div>
  );
}
