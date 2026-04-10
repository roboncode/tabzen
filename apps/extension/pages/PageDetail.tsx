import { createResource, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { getPage } from "@/lib/db";
import DetailPage from "@/components/detail/DetailPage";

export default function PageDetail() {
  const params = useParams<{ pageId: string; section?: string }>();
  const navigate = useNavigate();

  const [page] = createResource(
    () => params.pageId,
    async (id) => (id ? getPage(id) : undefined),
  );

  return (
    <Show
      when={page()}
      fallback={
        <div class="flex flex-col items-center justify-center h-screen bg-background gap-3">
          <p class="text-muted-foreground text-sm">
            {page.loading ? "Loading..." : "Page not found"}
          </p>
          <Show when={!page.loading}>
            <button
              class="text-sm text-sky-400 hover:text-sky-300 transition-colors"
              onClick={() => navigate("/")}
            >
              Back to pages
            </button>
          </Show>
        </div>
      }
    >
      {(p) => <DetailPage page={p()} initialSection={params.section} />}
    </Show>
  );
}
