'use client';

import React from 'react';

/* ─── Tiny inline markdown renderer ─────────────────────────────────────
   Handles (in order):
     - Bullet lists   : lines starting with "- " or "* "
     - Numbered lists : lines starting with "1. " "2. " etc.
     - Bold           : **text**
     - Inline links   : [label](url)
     - Bare URLs      : https://...
     - Plain text / line breaks
   ──────────────────────────────────────────────────────────────────── */

type Segment = { type: 'text'; value: string }
             | { type: 'bold'; value: string }
             | { type: 'link'; label: string; url: string };

/** Tokenise a single line into bold / link / text segments */
function parseInline(line: string): Segment[] {
  const segments: Segment[] = [];
  // Combined regex: **bold** or [label](url) or bare https://...
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/\S+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) segments.push({ type: 'text', value: line.slice(last, m.index) });
    if (m[1] !== undefined) {
      segments.push({ type: 'bold', value: m[1] });
    } else if (m[2] !== undefined) {
      segments.push({ type: 'link', label: m[2], url: m[3] });
    } else if (m[4] !== undefined) {
      // bare URL — use domain as label
      try {
        const domain = new URL(m[4]).hostname.replace(/^www\./, '');
        segments.push({ type: 'link', label: domain, url: m[4] });
      } catch {
        segments.push({ type: 'text', value: m[4] });
      }
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) segments.push({ type: 'text', value: line.slice(last) });
  return segments;
}

function renderSegments(segs: Segment[], key: string): React.ReactNode {
  return segs.map((s, i) => {
    if (s.type === 'bold') {
      return <strong key={`${key}-b${i}`} className="font-semibold text-white">{s.value}</strong>;
    }
    if (s.type === 'link') {
      return (
        <a
          key={`${key}-l${i}`}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px]
                     bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40
                     border border-indigo-500/30 hover:border-indigo-400/60
                     transition-colors no-underline align-baseline"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2.5}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          {s.label}
        </a>
      );
    }
    return <React.Fragment key={`${key}-t${i}`}>{s.value}</React.Fragment>;
  });
}

interface Props {
  content: string;
  role: 'user' | 'assistant';
}

export function MessageContent({ content, role }: Props) {
  if (role === 'user') {
    // User messages: plain text only
    return <span>{content}</span>;
  }

  const rawLines = content.split('\n');

  // Group lines into blocks: bullet-list, numbered-list, or paragraph
  type Block =
    | { kind: 'bullet';   items: string[] }
    | { kind: 'numbered'; items: string[] }
    | { kind: 'para';     lines: string[] };

  const blocks: Block[] = [];

  for (const raw of rawLines) {
    const line = raw.trimEnd();

    if (/^[-*]\s+/.test(line)) {
      const text = line.replace(/^[-*]\s+/, '');
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'bullet') last.items.push(text);
      else blocks.push({ kind: 'bullet', items: [text] });
    } else if (/^\d+\.\s+/.test(line)) {
      const text = line.replace(/^\d+\.\s+/, '');
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'numbered') last.items.push(text);
      else blocks.push({ kind: 'numbered', items: [text] });
    } else {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'para') last.lines.push(line);
      else blocks.push({ kind: 'para', lines: [line] });
    }
  }

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {blocks.map((block, bi) => {
        if (block.kind === 'bullet') {
          return (
            <ul key={bi} className="flex flex-col gap-1.5 pl-1">
              {block.items.map((item, ii) => (
                <li key={ii} className="flex items-start gap-2 leading-snug">
                  <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400/70" />
                  <span className="flex flex-wrap gap-x-1 items-baseline">
                    {renderSegments(parseInline(item), `${bi}-${ii}`)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.kind === 'numbered') {
          return (
            <ol key={bi} className="flex flex-col gap-1.5 pl-1">
              {block.items.map((item, ii) => (
                <li key={ii} className="flex items-start gap-2 leading-snug">
                  <span className="shrink-0 text-[11px] font-semibold text-indigo-400/80
                                   min-w-[18px] text-right mt-0.5">{ii + 1}.</span>
                  <span className="flex flex-wrap gap-x-1 items-baseline">
                    {renderSegments(parseInline(item), `${bi}-${ii}`)}
                  </span>
                </li>
              ))}
            </ol>
          );
        }

        // paragraph
        const joined = block.lines.join('\n').trim();
        if (!joined) return null;
        // Split on \n inside para for hard line-breaks
        return (
          <p key={bi} className="leading-snug">
            {joined.split('\n').map((l, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderSegments(parseInline(l), `${bi}-${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
