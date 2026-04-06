import { Show } from "solid-js";

interface HighlightProps {
  text: string;
  query: string;
}

export default function Highlight(props: HighlightProps) {
  const parts = () => {
    if (!props.query.trim()) return [{ text: props.text, match: false }];
    const regex = new RegExp(`(${props.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const split = props.text.split(regex);
    return split.map((part) => ({
      text: part,
      match: regex.test(part) || part.toLowerCase() === props.query.toLowerCase(),
    }));
  };

  return (
    <span>
      {parts().map((part) =>
        part.match ? (
          <mark class="bg-sky-500/40 text-foreground rounded px-0.5">{part.text}</mark>
        ) : (
          part.text
        ),
      )}
    </span>
  );
}
