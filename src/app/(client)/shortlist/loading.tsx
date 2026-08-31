export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      <ul className="space-y-4">
        {[0, 1].map((slot) => (
          <li key={slot} className="h-40 animate-pulse rounded-lg bg-muted" />
        ))}
      </ul>
    </div>
  );
}
