"use client";

import { useEffect, useState } from "react";

import { formatDate, formatDateTime } from "@/lib/format";

/**
 * Renders an absolute timestamp in each viewer's own timezone.
 *
 * Dates are stored as UTC instants. Formatting them on the server would bake in
 * the server's timezone (UTC on Vercel), so every viewer saw UTC regardless of
 * where they are. This component defers the final formatting to the browser:
 *
 *  - The server render and the first client (hydration) render both format in
 *    a fixed UTC zone, so the markup is identical and hydration never mismatches.
 *  - After mount, an effect reformats using the browser's local timezone.
 *
 * Net result: a brief UTC value on first paint, then the viewer's local time.
 */
export function LocalTime({
  value,
  mode = "datetime",
  className,
}: {
  /** An absolute instant — ISO-8601 string or Date. */
  value: string | Date;
  mode?: "datetime" | "date";
  className?: string;
}) {
  const iso = typeof value === "string" ? value : value.toISOString();
  const format = mode === "date" ? formatDate : formatDateTime;

  // Deterministic first render (server + hydration) pinned to UTC.
  const [text, setText] = useState(() => format(iso, "UTC"));

  useEffect(() => {
    // No timeZone arg → the browser uses the viewer's local zone.
    setText(format(iso));
  }, [iso, format]);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
