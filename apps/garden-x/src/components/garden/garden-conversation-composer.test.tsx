// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GardenConversationComposer } from "./garden-conversation-composer";

vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  const DialogContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({ open: false, onOpenChange: () => undefined });
  return {
    Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>,
    DialogTrigger: ({ asChild, children }: { asChild?: boolean; children: React.ReactElement }) => {
      const context = React.useContext(DialogContext);
      return React.cloneElement(children, { onClick: () => context.onOpenChange(true) });
    },
    DialogContent: ({ children }: { children: React.ReactNode }) => React.useContext(DialogContext).open ? <div role="dialog">{children}</div> : null,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  };
});

vi.mock("@/components/garden/photo-source-picker", () => ({
  PhotoSourcePicker: ({ onFile }: { onFile: (file: File) => void }) => (
    <div>
      <button type="button" onClick={() => onFile(new File(["camera"], "camera.jpg", { type: "image/jpeg" }))}>Take photo</button>
      <button type="button" onClick={() => onFile(new File(["library"], "library.jpg", { type: "image/jpeg" }))}>Choose from Photo Library</button>
      <button type="button" onClick={() => onFile(new File(["heic"], "library.heic", { type: "image/heic" }))}>Choose HEIC</button>
    </div>
  ),
}));

describe("Garden conversation image composer", () => {
  afterEach(cleanup);

  it("offers camera/library, previews, replaces or removes one image, then sends it with the current turn", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<GardenConversationComposer language="en" placeholder="Ask about this" sendLabel="Send" onSend={onSend} />);

    fireEvent.click(screen.getByRole("button", { name: "Attach a photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose from Photo Library" }));
    expect(await screen.findByAltText("Attached photo")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByAltText("Attached photo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Attach a photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    expect(await screen.findByAltText("Attached photo")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Ask about this"), { target: { value: "Can you see the reservoir?" } });
    fireEvent.submit(screen.getByPlaceholderText("Ask about this").closest("form")!);
    await waitFor(() => expect(onSend).toHaveBeenCalledWith("Can you see the reservoir?", expect.stringContaining("data:image/jpeg;base64,")));
    expect(screen.queryByAltText("Attached photo")).toBeNull();
  });

  it("rejects image types that the existing Garden AI image transport cannot inspect", async () => {
    render(<GardenConversationComposer language="en" placeholder="Ask" sendLabel="Send" onSend={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Attach a photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose HEIC" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Choose a JPEG, PNG, or WebP photo.");
    expect(screen.queryByAltText("Attached photo")).toBeNull();
  });
});
