import { useNavigate } from "@solidjs/router";
import SettingsPanel from "@/components/SettingsPanel";

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div class="w-full h-screen bg-background">
      <SettingsPanel onClose={() => navigate("/")} />
    </div>
  );
}
