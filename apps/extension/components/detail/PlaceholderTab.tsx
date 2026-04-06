import { FileText } from "lucide-solid";
import EmptyBlock from "@/components/EmptyBlock";

interface PlaceholderTabProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function PlaceholderTab(props: PlaceholderTabProps) {
  return (
    <EmptyBlock
      icon={<FileText size={52} />}
      title={props.title}
      description={props.description}
      actionLabel={props.actionLabel}
      onAction={props.onAction}
    />
  );
}
