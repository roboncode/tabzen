import Dialog from "./Dialog";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog open={true} onClose={props.onCancel} maxWidth="max-w-[360px]">
      <h3 class="text-base font-semibold text-foreground mb-2">{props.title}</h3>
      <p class="text-sm text-muted-foreground mb-5">{props.message}</p>
      <div class="flex justify-end gap-2">
        <button
          class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          onClick={props.onCancel}
        >
          Cancel
        </button>
        <button
          class={`px-4 py-2 text-sm rounded-lg transition-colors ${
            props.destructive
              ? "bg-red-600 text-white hover:bg-red-500"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
          onClick={props.onConfirm}
        >
          {props.confirmLabel || "Confirm"}
        </button>
      </div>
    </Dialog>
  );
}
