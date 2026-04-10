import { createSignal, createEffect, Show, For, onMount } from "solid-js";
import { ChevronDown, ChevronUp, Hash, MessageCircleQuestion, Zap } from "lucide-solid";
import { getSettings, updateSettings } from "@/lib/settings";
import { generateDocument } from "@/lib/ai";
import { getDocumentsForPage, putDocument } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import PostCard from "./PostCard";
import ThreadView from "./ThreadView";
import { ProseSkeleton } from "./DocumentSkeletons";

type Platform = "x" | "linkedin" | "instagram" | "facebook" | "threads";
type PostLength = "brief" | "standard" | "detailed" | "thread";

interface PlatformConfig {
  id: Platform;
  label: string;
  shortLabel: string;
  color: string;
  maxChars: number;
}

const PLATFORMS: PlatformConfig[] = [
  { id: "x", label: "𝕏 / Twitter", shortLabel: "𝕏", color: "#1d9bf0", maxChars: 280 },
  { id: "linkedin", label: "LinkedIn", shortLabel: "in", color: "#0a66c2", maxChars: 3000 },
  { id: "instagram", label: "Instagram", shortLabel: "IG", color: "#e1306c", maxChars: 2200 },
  { id: "facebook", label: "Facebook", shortLabel: "fb", color: "#1877f2", maxChars: 63206 },
  { id: "threads", label: "Threads", shortLabel: "@", color: "#7b7b7b", maxChars: 500 },
];

const LENGTH_OPTIONS: { id: PostLength; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "standard", label: "Standard" },
  { id: "detailed", label: "Detailed" },
  { id: "thread", label: "Thread" },
];

interface GeneratedPost {
  text: string;
  hashtags: string;
  posts?: string[];
}

function parseGeneratedPost(raw: string): GeneratedPost {
  const lines = raw.split("\n");
  const hashtagLine = lines.findIndex((l) => /^#\w/.test(l.trim()));

  let text: string;
  let hashtags = "";

  if (hashtagLine !== -1) {
    text = lines.slice(0, hashtagLine).join("\n").trim();
    hashtags = lines.slice(hashtagLine).join(" ").trim();
  } else {
    text = raw.trim();
  }

  return { text, hashtags };
}

function parseThread(raw: string): GeneratedPost {
  const sections = raw.split(/---+/).map((s) => s.trim()).filter(Boolean);

  if (sections.length <= 1) {
    const numbered = raw.split(/\n(?=\d+[.\/])/).map((s) => s.replace(/^\d+[.\/]\s*/, "").trim()).filter(Boolean);
    if (numbered.length > 1) {
      const lastPost = numbered[numbered.length - 1];
      const hashMatch = lastPost.match(/((?:#\w+\s*)+)$/);
      const hashtags = hashMatch ? hashMatch[1].trim() : "";
      if (hashtags) {
        numbered[numbered.length - 1] = lastPost.replace(/((?:#\w+\s*)+)$/, "").trim();
      }
      return { text: raw, hashtags, posts: numbered };
    }
    return parseGeneratedPost(raw);
  }

  const lastSection = sections[sections.length - 1];
  const hashMatch = lastSection.match(/((?:#\w+\s*)+)$/);
  const hashtags = hashMatch ? hashMatch[1].trim() : "";
  if (hashtags) {
    sections[sections.length - 1] = lastSection.replace(/((?:#\w+\s*)+)$/, "").trim();
  }

  return { text: raw, hashtags, posts: sections.filter(Boolean) };
}

interface SocialPostsViewProps {
  content: string;
  contentType: "transcript" | "markdown";
  pageId: string;
}

export default function SocialPostsView(props: SocialPostsViewProps) {
  const [platform, setPlatform] = createSignal<Platform>("x");
  const [length, setLength] = createSignal<PostLength>("standard");
  const [hashtags, setHashtags] = createSignal(true);
  const [engagementQuestion, setEngagementQuestion] = createSignal(false);
  const [hook, setHook] = createSignal(true);
  const [voice, setVoice] = createSignal("");
  const [voiceOpen, setVoiceOpen] = createSignal(false);
  const [focus, setFocus] = createSignal("");
  const [generating, setGenerating] = createSignal(false);
  const [result, setResult] = createSignal<GeneratedPost | null>(null);
  const [hasGenerated, setHasGenerated] = createSignal(false);

  // Cache: platform+length+hashtags+question+hook → result
  const [cache, setCache] = createSignal<Record<string, GeneratedPost>>({});
  const [savedFocus, setSavedFocus] = createSignal<Record<string, string>>({});

  const cacheKey = () => `${platform()}-${length()}-${hashtags()}-${engagementQuestion()}-${hook()}`;

  const platformConfig = () => PLATFORMS.find((p) => p.id === platform())!;

  // Load persistent settings and cached posts
  onMount(async () => {
    const settings = await getSettings();
    setVoice(settings.socialVoice || "");
    setLength(settings.socialDefaultLength || "standard");
    setHashtags(settings.socialHashtags ?? true);
    setEngagementQuestion(settings.socialEngagementQuestion ?? false);
    setHook(settings.socialHook ?? true);

    // Load previously generated posts from DB
    const docs = await getDocumentsForPage(props.pageId);
    const socialDocs = docs.filter((d) => d.templateId.startsWith("social-post-"));
    const restored: Record<string, GeneratedPost> = {};
    const restoredFocus: Record<string, string> = {};
    for (const doc of socialDocs) {
      const key = doc.templateId.replace("social-post-", "");
      const isThread = key.includes("-thread-");
      let raw = doc.content;

      // Extract stored focus
      const focusMatch = raw.match(/^<!--focus:(.+?)-->\n/);
      if (focusMatch) {
        restoredFocus[key] = focusMatch[1];
        raw = raw.replace(/^<!--focus:.+?-->\n/, "");
      }

      restored[key] = isThread ? parseThread(raw) : parseGeneratedPost(raw);
    }
    setCache(restored);
    setSavedFocus(restoredFocus);
  });

  // Save voice when it changes (debounced)
  let voiceSaveTimeout: ReturnType<typeof setTimeout>;
  const handleVoiceChange = (value: string) => {
    setVoice(value);
    clearTimeout(voiceSaveTimeout);
    voiceSaveTimeout = setTimeout(() => {
      updateSettings({ socialVoice: value });
    }, 500);
  };

  // Save other settings when they change
  createEffect(() => {
    updateSettings({
      socialDefaultLength: length(),
      socialHashtags: hashtags(),
      socialEngagementQuestion: engagementQuestion(),
      socialHook: hook(),
    });
  });

  // Check cache when settings change
  createEffect(() => {
    const key = cacheKey();
    const cached = cache()[key];
    if (cached) {
      setResult(cached);
      setHasGenerated(true);
    } else if (hasGenerated()) {
      setResult(null);
    }
  });

  const buildPrompt = (): string => {
    const p = platformConfig();
    const isThread = length() === "thread";

    const voiceSection = voice()
      ? `Voice & personality: ${voice()}`
      : "";

    const focusSection = focus().trim()
      ? `\nFocus: Write specifically about "${focus().trim()}". Do not cover other topics from the content.`
      : "";

    const lengthMap: Record<PostLength, string> = {
      brief: "1-2 sentences. Punchy and concise.",
      standard: "1 short paragraph. Clear and impactful.",
      detailed: "2-3 paragraphs. Thorough but readable.",
      thread: `Create a thread of 3-5 connected posts, each under ${p.maxChars} characters. Separate each post with --- on its own line. The first post should hook the reader.`,
    };

    const hashtagInstruction = hashtags()
      ? `Include 3-5 relevant hashtags at the end of the ${isThread ? "last post" : "post"}.`
      : "Do NOT include any hashtags.";

    const questionInstruction = engagementQuestion()
      ? `End the ${isThread ? "last post" : "post"} with an engaging question to drive replies.`
      : "Do NOT end with a question.";

    const hookInstruction = hook()
      ? isThread
        ? "The FIRST post in the thread must be a compelling hook — a bold claim, surprising fact, or 'here's what I learned' statement that makes people want to read the rest."
        : "Open with a strong hook — a bold claim, surprising fact, or 'here's how to...' statement that grabs attention immediately."
      : "Do NOT start with a hook or attention-grabbing opener. Dive straight into the insight.";

    const platformSpecific = p.id === "linkedin"
      ? "\n- Start with a bold first line that acts as a headline — this shows before the 'see more' fold in the LinkedIn feed. Follow with a line break before the body."
      : "";

    const formatInstruction = isThread
      ? "Separate each post in the thread with --- on its own line. Do not number the posts. Each post should be under " + p.maxChars + " characters."
      : "Return ONLY the post text. No preamble, no labels, no quotation marks." + platformSpecific;

    const contentLabel = props.contentType === "transcript" ? "video transcript" : "article";

    return `You are a social media expert. Write a ${p.label} post based on the following ${contentLabel}.

Write as a subject matter expert sharing knowledge and insights. Do NOT promote or reference the source content — no "this article," "this video," "I just read," or "check out." Write as if these are YOUR OWN insights and expertise.

${voiceSection}${focusSection}

Requirements:
- Platform: ${p.label}
- STRICT CHARACTER LIMIT: Each post MUST be under ${p.maxChars} characters including hashtags. Count carefully. This is non-negotiable.
- Length: ${lengthMap[length()]}
- ${hookInstruction}
- ${hashtagInstruction}
- ${questionInstruction}

${formatInstruction}`;
  };

  const handleClear = () => {
    setResult(null);
    setHasGenerated(false);
    // Restore focus from the last generation for this key
    const saved = savedFocus()[cacheKey()];
    if (saved) setFocus(saved);
  };

  const handleGenerate = async () => {
    const settings = await getSettings();
    if (!settings.openRouterApiKey || !props.content) return;

    setGenerating(true);
    setResult(null);
    try {
      const prompt = buildPrompt();
      const raw = await generateDocument(
        settings.openRouterApiKey,
        settings.aiModel,
        prompt,
        props.content,
        props.contentType,
      );

      const parsed = length() === "thread" ? parseThread(raw) : parseGeneratedPost(raw);
      setResult(parsed);
      setHasGenerated(true);
      const key = cacheKey();
      setCache((prev) => ({ ...prev, [key]: parsed }));
      if (focus().trim()) {
        setSavedFocus((prev) => ({ ...prev, [key]: focus().trim() }));
      }

      // Persist to DB — store focus in content so we can restore it
      const storedContent = focus().trim()
        ? `<!--focus:${focus().trim()}-->\n${raw}`
        : raw;
      await putDocument({
        id: uuidv4(),
        pageId: props.pageId,
        templateId: `social-post-${key}`,
        content: storedContent,
        generatedAt: new Date().toISOString(),
        promptUsed: prompt,
      });
    } catch (e) {
      console.error("[TabZen Social] Generation failed:", e);
    } finally {
      setGenerating(false);
    }
  };

  const effectiveLength = () => {
    if (length() === "thread" && platform() !== "x") return "detailed";
    return length();
  };

  return (
    <div class="px-2 pb-12">
      {/* Title */}
      <h2 class="text-xl font-semibold text-foreground mb-6">Social Posts</h2>

      {/* Platform pills */}
      <div class="flex gap-2 mb-5 flex-wrap">
        <For each={PLATFORMS}>
          {(p) => (
            <button
              class={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                platform() === p.id
                  ? "text-white"
                  : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
              style={platform() === p.id ? { background: p.color } : {}}
              onClick={() => setPlatform(p.id)}
            >
              {p.label}
            </button>
          )}
        </For>
      </div>

      {/* Settings bar — length + toggle chips */}
      <div class="flex items-center gap-3 bg-muted/5 rounded-xl px-4 py-3 mb-5 flex-wrap">
        {/* Length */}
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground/50 font-medium">Length</span>
          <div class="flex gap-1">
            <For each={LENGTH_OPTIONS}>
              {(opt) => {
                const disabled = opt.id === "thread" && platform() !== "x";
                return (
                  <button
                    class={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      (effectiveLength() === opt.id && !disabled)
                        ? "bg-muted/30 text-foreground font-medium"
                        : disabled
                          ? "text-muted-foreground/20 cursor-not-allowed"
                          : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => !disabled && setLength(opt.id)}
                    disabled={disabled}
                    title={disabled ? "Threads are only available on X/Twitter" : ""}
                  >
                    {opt.label}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Divider */}
        <div class="w-px h-5 bg-muted-foreground/10" />

        {/* Toggle chips */}
        <div class="flex gap-1.5">
          <button
            class={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
              hashtags()
                ? "bg-sky-500/15 text-sky-400"
                : "text-muted-foreground/40 hover:text-muted-foreground"
            }`}
            onClick={() => setHashtags(!hashtags())}
          >
            <Hash size={11} />
            Hashtags
          </button>
          <button
            class={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
              engagementQuestion()
                ? "bg-sky-500/15 text-sky-400"
                : "text-muted-foreground/40 hover:text-muted-foreground"
            }`}
            onClick={() => setEngagementQuestion(!engagementQuestion())}
          >
            <MessageCircleQuestion size={11} />
            Question
          </button>
          <button
            class={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
              hook()
                ? "bg-sky-500/15 text-sky-400"
                : "text-muted-foreground/40 hover:text-muted-foreground"
            }`}
            onClick={() => setHook(!hook())}
          >
            <Zap size={11} />
            Hook
          </button>
        </div>
      </div>

      {/* Voice & personality */}
      <div class="mb-6">
        <button
          onClick={() => setVoiceOpen(!voiceOpen())}
          class="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {voiceOpen() ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Voice & personality
        </button>
        <Show when={voiceOpen()}>
          <div class="mt-2">
            <textarea
              value={voice()}
              onInput={(e) => handleVoiceChange(e.currentTarget.value)}
              maxLength={300}
              class="w-full text-sm text-foreground/80 leading-relaxed bg-muted/10 rounded-lg p-3 focus:outline-none focus:bg-muted/20 transition-colors"
              style={{ resize: "none" }}
              rows={3}
              placeholder="e.g., Professional but approachable. I use data to back up claims. I avoid jargon and explain things simply."
            />
            <div class="flex items-center justify-between mt-1.5">
              <span class="text-xs text-sky-400/50">Saved globally</span>
              <span class="text-xs text-muted-foreground/50">{voice().length}/300</span>
            </div>
          </div>
        </Show>
      </div>

      {/* Divider */}
      <div class="border-t border-muted-foreground/5 mb-6" />

      {/* Focus / angle input */}
      <Show when={!generating() && !result()}>
        <div class="mb-4">
          <input
            type="text"
            value={focus()}
            onInput={(e) => setFocus(e.currentTarget.value)}
            maxLength={150}
            class="w-full text-sm text-foreground/80 bg-muted/10 rounded-lg px-3 py-2.5 focus:outline-none focus:bg-muted/20 transition-colors placeholder:text-muted-foreground/30"
            placeholder="Optional: focus on a specific topic or angle..."
          />
        </div>
      </Show>

      {/* Generate button or result */}
      <Show when={!generating() && !result()}>
        <button
          onClick={handleGenerate}
          class="px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer hover:brightness-150 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: `${platformConfig().color}25`, color: platformConfig().color }}
        >
          Generate {platformConfig().label} Post
        </button>
      </Show>

      {/* Generating skeleton */}
      <Show when={generating()}>
        <ProseSkeleton />
      </Show>

      {/* Result — single post */}
      <Show when={!generating() && result() && !result()!.posts}>
        {/* Header with platform badge + actions */}
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span
              class="text-xs font-semibold px-2.5 py-1 rounded-md text-white"
              style={{ background: platformConfig().color }}
            >
              {platformConfig().shortLabel}
            </span>
            <span class="text-sm text-muted-foreground">Single post</span>
          </div>
          <button
            onClick={handleClear}
            class="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/30 transition-colors"
          >
            Start Over
          </button>
        </div>
        <PostCard
          text={result()!.text}
          hashtags={hashtags() ? result()!.hashtags : undefined}
          platform={platform()}
          charCount={result()!.text.length}
          maxChars={platformConfig().maxChars}
        />
      </Show>

      {/* Result — thread */}
      <Show when={!generating() && result()?.posts}>
        <ThreadView
          posts={result()!.posts!.map((text) => ({ text, charCount: text.length }))}
          platform={platform()}
          platformColor={platformConfig().color}
          platformLabel={platformConfig().shortLabel}
          maxChars={platformConfig().maxChars}
          hashtags={hashtags() ? result()!.hashtags : undefined}
          onClear={handleClear}
        />
      </Show>
    </div>
  );
}
