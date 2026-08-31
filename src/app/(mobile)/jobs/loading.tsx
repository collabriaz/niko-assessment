export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
      {[0, 1].map((slot) => (
        <div key={slot} className="h-28 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
