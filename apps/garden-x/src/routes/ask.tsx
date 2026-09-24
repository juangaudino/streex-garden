import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, Leaf } from "lucide-react";
import { useGarden } from "@/lib/garden-store";
import { askSuggestions, askWholeGarden, type AskAnswer } from "@/lib/garden-logic";
import { askGardenAi } from "@/lib/garden-backend";
import { ProvenanceTag } from "@/components/garden/atoms";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { GardenConversationComposer } from "@/components/garden/garden-conversation-composer";
import { ui } from "@/lib/ui-copy";

export const Route = createFileRoute("/ask")({
  validateSearch: (search: Record<string, unknown>) => ({
    prompt: typeof search["prompt"] === "string" ? search["prompt"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ask Garden — Garden X" },
      { name: "description", content: "Ask questions grounded in the recorded history of your gardens and plants." },
      { property: "og:title", content: "Ask Garden — Garden X" },
      { property: "og:description", content: "Garden-wide answers grounded in recorded plant history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GardenWideAsk,
});

function GardenWideAsk() {
  const store = useGarden();
  const language = store.language;
  const { prompt } = Route.useSearch();
  const navigationImage = useRouterState({ select: (state) => {
    const value = state.location.state as { gardenConversationImage?: unknown } | undefined;
    return typeof value?.gardenConversationImage === "string" ? value.gardenConversationImage : undefined;
  } });
  const [thread, setThread] = useState<Array<AskAnswer & { attachedImageDataUrl?: string }>>([]);
  const [thinking, setThinking] = useState(false);
  const initialPromptSent = useRef(false);

  const send = useCallback(async (question: string, imageDataUrl?: string) => {
    const clean = question.trim();
    if (!clean || thinking) return;
    setThinking(true);
    const conversation = thread.slice(-4).map((item) => ({
      question: item.question,
      answer: [...item.grounded, item.inference, item.attachedImageDataUrl ? "The user attached a photo in that turn." : ""].filter(Boolean).join(" "),
    }));
    try {
      const result = await askGardenAi(clean, conversation, { messageImageDataUrl: imageDataUrl });
      const answer: AskAnswer & { attachedImageDataUrl?: string } = {
        question: clean,
        grounded: result.confirmed_facts.length ? result.confirmed_facts.map((fact) => fact.claim) : [result.answer],
        evidence: result.confirmed_facts.map((fact) => `${fact.source.kind} · ${fact.source.id.slice(0, 8)}`),
        ...(result.confirmed_facts.length && result.answer ? { inference: result.answer } : {}),
        ...(imageDataUrl ? { attachedImageDataUrl: imageDataUrl } : {}),
      };
      setThread((current) => [...current, answer]);
    } catch {
      // Deterministic Garden logic remains the safe fallback if AI is temporarily unavailable.
      setThread((current) => [...current, { ...askWholeGarden(clean, store, language), ...(imageDataUrl ? { attachedImageDataUrl: imageDataUrl } : {}) }]);
    } finally {
      setThinking(false);
    }
  }, [language, store, thread, thinking]);

  useEffect(() => {
    if (!prompt || initialPromptSent.current) return;
    initialPromptSent.current = true;
    void send(prompt, navigationImage);
  }, [navigationImage, prompt, send]);

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-[32rem] min-w-0 max-w-full flex-col lg:h-screen">
      <header className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-2.5 backdrop-blur-xl sm:px-8 lg:px-12">
        <Link to="/garden-ai" className="press grid h-8 w-8 place-items-center rounded-full border border-border/70 bg-card" aria-label={ui(language, "backToGardenAI")}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{ui(language, "askGarden")}</p>
          <p className="numeral truncate text-[0.7rem] text-muted-foreground">{ui(language, "allGardens")} · {store.plants.filter((plant) => !plant.cycleClosed).length} {ui(language, "activePlants")}</p>
        </div>
        <Leaf className="h-4 w-4 text-primary" />
      </header>

      <Conversation className="mx-auto w-full min-w-0 max-w-3xl">
        <ConversationContent className="min-w-0 px-5 py-8 sm:px-8">
          {thread.length === 0 ? (
            <div className="rise">
              <h1 className="font-display text-3xl">{ui(language, "whatKnow")}</h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{ui(language, "askDescription")}</p>
            </div>
          ) : null}
          {thread.map((answer, index) => (
            <div key={`${answer.question}-${index}`} className="min-w-0 max-w-full space-y-3">
              <Message from="user">
                <MessageContent className="bg-primary text-primary-foreground">
                  {answer.attachedImageDataUrl ? <img src={answer.attachedImageDataUrl} alt={ui(language, "attachedPhotoPreview")} className="mb-2 max-h-36 max-w-full rounded-xl object-cover" /> : null}
                  {answer.question}
                </MessageContent>
              </Message>
              <Message from="assistant">
                <MessageContent className="w-full">
                  <ProvenanceTag kind="recorded" />
                  <div className="mt-3 space-y-2">
                    {answer.grounded.map((item) => <MessageResponse key={item}>{item}</MessageResponse>)}
                  </div>
                  {answer.inference ? (
                    <div className="mt-4 min-w-0 max-w-full rounded-2xl border border-inference/25 bg-inference/6 p-4">
                      <ProvenanceTag kind="inferred" confidence="moderate" />
                      <MessageResponse className="mt-2 text-muted-foreground">{answer.inference}</MessageResponse>
                    </div>
                  ) : null}
                </MessageContent>
              </Message>
            </div>
          ))}
          {thinking ? <Shimmer className="text-sm">{ui(language, "readingRecord")}</Shimmer> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="min-w-0 max-w-full border-t border-border/70 bg-background/90 px-[max(1rem,env(safe-area-inset-left))] pt-3 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="mx-auto min-w-0 max-w-3xl">
          <div className="no-scrollbar mb-2.5 flex min-w-0 max-w-full gap-2 overflow-x-auto">
            {[ui(language, "whatNeedsAttention"), ui(language, "whatChangedRecently"), ...askSuggestions(language).slice(4)].map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => send(suggestion)} className="press shrink-0 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground">{suggestion}</button>
            ))}
          </div>
          <GardenConversationComposer
            language={language}
            placeholder={ui(language, "askPlaceholder")}
            sendLabel={ui(language, "sendQuestion")}
            disabled={thinking}
            sending={thinking}
            onSend={send}
          />
        </div>
      </div>
    </div>
  );
}
