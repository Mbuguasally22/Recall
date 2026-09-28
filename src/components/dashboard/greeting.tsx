function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: { name: string }) {
  const hour = new Date().getHours();
  return (
    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
      {getGreeting(hour)}, {name}
    </h1>
  );
}
