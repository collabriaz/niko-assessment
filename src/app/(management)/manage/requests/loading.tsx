export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <ul className="grid gap-3">
        {[0, 1, 2].map((slot) => (
          <li key={slot} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </ul>
    </div>
  );
}
