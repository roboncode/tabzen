interface HighlightProps {
  text: string;
  query: string;
}

export default function Highlight(props: HighlightProps) {
  const parts = () => {
    const q = props.query.trim();
    if (q.length < 2) return null;

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return props.text.split(regex);
  };

  return (
    <span>
      {(() => {
        const p = parts();
        if (!p) return props.text;
        const lower = props.query.toLowerCase();
        return p.map((segment) =>
          segment.toLowerCase() === lower ? (
            <mark class="bg-sky-500/80 text-foreground rounded px-0.5">{segment}</mark>
          ) : (
            segment
          ),
        );
      })()}
    </span>
  );
}
