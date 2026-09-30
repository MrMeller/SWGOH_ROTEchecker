"use client";

import { useState } from "react";

/** One copy button per Discord message; long focus lists are split into parts. */
export function CopyButtons({ messages }: { messages: string[] }) {
  const [copied, setCopied] = useState<number | null>(null);

  const copy = async (i: number) => {
    try {
      await navigator.clipboard.writeText(messages[i]);
      setCopied(i);
      setTimeout(() => setCopied((c) => (c === i ? null : c)), 2000);
    } catch {
      window.prompt("Copy this text:", messages[i]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {messages.map((_, i) => (
        <button
          key={i}
          onClick={() => copy(i)}
          className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          {copied === i ? "Copied!" : messages.length > 1 ? `Copy part ${i + 1} of ${messages.length}` : "Copy for Discord"}
        </button>
      ))}
      {messages.length > 1 && (
        <span className="text-xs text-slate-400">Discord allows 2000 characters per message, so this is split.</span>
      )}
    </div>
  );
}
