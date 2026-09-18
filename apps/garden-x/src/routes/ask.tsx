import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Leaf } from "lucide-react";
import { useGarden } from "@/lib/garden-store";
import { askSuggestions, askWholeGarden, type AskAnswer } from "@/lib/garden-logic";
import { ProvenanceTag } from "@/components/garden/atoms";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

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
  const { prompt } = Route.useSearch();
  const [thread, setThread] = useState<AskAnswer[]>([]);
  const [thinking, setThinking] = useState(false);
  const initialPromptSent = useRef(false);

  const send = (question: string) => {
    const clean = question.trim();
    if (!clean || thinking) return;
    setThinking(true);
    const answer = askWholeGarden(clean, store);
    window.setTimeout(() => {
      setThread((current) => [...current, answer]);
      setThinking(false);
    }, 900);
  };

  useEffect(() => {
    if (!prompt || initialPromptSent.current) return;
    initialPromptSent.current = true;
    send(prompt);
  }, [prompt]);

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-[32rem] flex-col lg:h-screen">
      <header className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-2.5 backdrop-blur-xl sm:px-8 lg:px-12">
        <Link to="/garden-ai" className="press grid h-8 w-8 place-items-center rounded-full border border-border/70 bg-card" aria-label="Back to Garden AI">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Ask Garden</p>
          <p className="numeral truncate text-[0.7rem] text-muted-foreground">All gardens · {store.plants.filter((plant) => !plant.cycleClosed).length} active plants</p>
        </div>
        <Leaf className="h-4 w-4 text-primary" />
      </header>

      <Conversation className="mx-auto w-full max-w-3xl">
        <ConversationContent className="px-5 py-8 sm:px-8">
          {thread.length === 0 ? (
            <div className="rise">
              <h1 className="font-display text-3xl">What do you want to know about your garden?</h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">I can read across recorded plant histories, care, photos and open follow-ups. Anything beyond those records stays clearly marked as inference.</p>
            </div>
          ) : null}
          {thread.map((answer, index) => (
            <div key={`${answer.question}-${index}`} className="space-y-3">
              <Message from="user">
                <MessageContent className="bg-primary text-primary-foreground">{answer.question}</MessageContent>
              </Message>
              <Message from="assistant">
                <MessageContent className="w-full">
                  <ProvenanceTag kind="recorded" />
                  <div className="mt-3 space-y-2">
                    {answer.grounded.map((item) => <MessageResponse key={item}>{item}</MessageResponse>)}
                  </div>
                  {answer.inference ? (
                    <div className="mt-4 rounded-2xl border border-inference/25 bg-inference/6 p-4">
                      <ProvenanceTag kind="inferred" confidence="moderate" />
                      <MessageResponse className="mt-2 text-muted-foreground">{answer.inference}</MessageResponse>
                    </div>
                  ) : null}
                  {answer.evidence.length ? <p className="mt-3 text-xs text-muted-foreground">{answer.evidence.join(" · ")}</p> : null}
                </MessageContent>
              </Message>
            </div>
          ))}
          {thinking ? <Shimmer className="text-sm">Reading the garden record…</Shimmer> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border/70 bg-background/90 px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="no-scrollbar mb-2.5 flex gap-2 overflow-x-auto">
            {["What needs attention today?", "What changed recently?", ...askSuggestions.slice(4)].map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => send(suggestion)} className="press shrink-0 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground">{suggestion}</button>
            ))}
          </div>
          <PromptInput onSubmit={({ text }) => send(text)} className="rounded-2xl bg-card">
            <PromptInputTextarea placeholder="Ask about your garden…" disabled={thinking} />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={thinking ? "submitted" : "ready"} disabled={thinking} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}