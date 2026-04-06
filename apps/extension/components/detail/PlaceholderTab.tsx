import { FileText } from "lucide-solid";

interface PlaceholderTabProps {
  title: string;
  description: string;
}

export default function PlaceholderTab(props: PlaceholderTabProps) {
  return (
    <div class="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
      <FileText size={32} class="opacity-30" />
      <p class="text-sm font-medium">{props.title}</p>
      <p class="text-xs text-muted-foreground/60">{props.description}</p>
    </div>
  );
}
