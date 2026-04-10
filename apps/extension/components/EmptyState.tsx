import { Inbox } from "lucide-solid";
import EmptyBlock from "./EmptyBlock";

export default function EmptyState() {
  return (
    <EmptyBlock
      icon={<Inbox size={52} />}
      title="No pages saved yet"
      description='Click "Capture All Tabs" to save your open tabs, or right-click any tab to save it individually.'
    />
  );
}
