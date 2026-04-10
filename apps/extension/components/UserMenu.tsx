import { createSignal, createResource, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Settings, User } from "lucide-solid";

interface UserInfo {
  email: string;
  name: string;
  initials: string;
}

async function fetchUserInfo(): Promise<UserInfo> {
  try {
    const info = await browser.identity.getProfileUserInfo({ accountStatus: "ANY" as any });
    if (info.email) {
      const name = info.email.split("@")[0];
      const initials = name.slice(0, 2).toUpperCase();
      return { email: info.email, name, initials };
    }
  } catch {}
  return { email: "", name: "User", initials: "U" };
}

export default function UserMenu() {
  const [open, setOpen] = createSignal(false);
  const [userInfo] = createResource(fetchUserInfo);
  const navigate = useNavigate();

  const info = () => userInfo() || { email: "", name: "User", initials: "U" };

  return (
    <div class="relative flex-shrink-0">
      {/* Avatar button */}
      <button
        class="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white cursor-pointer hover:ring-2 hover:ring-sky-400/50 transition-all"
        onClick={() => setOpen(!open())}
        title={info().email || "Account"}
      >
        {info().initials}
      </button>

      <Show when={open()}>
        {/* Backdrop */}
        <div class="fixed inset-0 z-30" onClick={() => setOpen(false)} />

        {/* Profile card */}
        <div class="absolute right-0 top-full mt-2 z-40 w-[280px] bg-[#1e1e22] rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div class="flex flex-col items-center pt-6 pb-4 px-4">
            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white mb-3">
              {info().initials}
            </div>
            <Show when={info().email}>
              <p class="text-sm text-foreground font-medium">
                Hi, {info().name}!
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {info().email}
              </p>
            </Show>
            <Show when={!info().email}>
              <p class="text-sm text-foreground font-medium">
                Hi there!
              </p>
            </Show>
          </div>

          {/* Divider */}
          <div class="mx-4 border-t border-muted-foreground/10" />

          {/* Menu items */}
          <div class="py-2">
            <button
              class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              onClick={() => {
                setOpen(false);
                navigate("/settings");
              }}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </div>

          {/* Footer — future upgrade CTA */}
          <div class="mx-4 border-t border-muted-foreground/10" />
          <div class="px-4 py-3">
            <p class="text-xs text-muted-foreground/50 text-center">
              Tab Zen — Free
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
}
