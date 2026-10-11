import { useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MessagePageShell } from "shell";
import { ChatWorkspace, ChatHistory, ChatComposer, ChatThreadHeader, ChatEmptyState, clearChatAttachments } from "@aisley/ui/chat";
import { addChatFiles } from "./media-state";
import * as chatExports from "@aisley/ui/chat";
import * as compatibility from "compatibility";

const initial = [
  { id: "1", sequence: 1, mine: false, sender: "Maya Shop", body: "Hi! How can I help with your order?", createdAt: "2026-10-11T04:00:00Z" },
  { id: "2", sequence: 2, mine: true, sender: "You", body: "Does the linen shirt come in medium?", createdAt: "2026-10-11T04:01:00Z" },
  { id: "3", sequence: 3, mine: false, sender: "Maya Shop", body: "Yes, medium is available in cream and olive. You can choose your size on the product page.", createdAt: "2026-10-11T04:02:00Z" },
  { id: "4", sequence: 4, mine: false, sender: "Maya Shop", body: "We usually ship within two business days.", createdAt: "2026-10-11T04:03:00Z" },
];
const fixture = window as unknown as {
  addChatFiles: typeof addChatFiles;
  chatExports: typeof chatExports;
  compatibility: typeof compatibility;
  checks: { sends: string[]; attachments: string[][] };
  mediaEnabled: boolean;
  mediaUploadFails: boolean;
  loseMediaResponse: boolean;
  setMode: (mode: string) => void;
};
fixture.addChatFiles = addChatFiles;
fixture.chatExports = chatExports;
fixture.compatibility = compatibility;
fixture.checks = { sends: [], attachments: [] };
fixture.mediaUploadFails = false;
fixture.loseMediaResponse = false;
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const asset = { id: "fixture-image", kind: "image" as const, filename: "Chat-photo.png", mime_type: "image/png", byte_size: 68, state: "ready" as const, error_code: null, width: 1, height: 1, duration_seconds: null, content_url: image, preview_url: image };
const mediaClient = {
  capabilities: async () => fixture.mediaEnabled,
  upload: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (fixture.mediaUploadFails) throw new Error("Synthetic upload unavailable. Retry this file.");
    return asset;
  },
  status: async () => asset, retry: async () => asset, remove: async () => {}, url: (path: string) => path,
};

function DashboardShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6"><h1 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Messages</h1>{children}</main>;
}
const Shell = document.documentElement.dataset.fixtureRole === "dashboard" ? DashboardShell : MessagePageShell;

function App() {
  const [selected, setSelected] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState(initial);
  const [mode, setMode] = useState("ready");
  fixture.setMode = setMode;
  fixture.mediaEnabled = mode === "media" || mode === "uncertainmedia";
  const entries = mode === "empty" ? [] : [
    { id: "maya", title: "Maya Shop", preview: "We usually ship within two business days.", activity: "2026-10-11T04:03:00Z", unread: 2, context: "Shop conversation", selected, onSelect: () => setSelected(true) },
    { id: "long", title: "A very long shop identity ".repeat(8), preview: "A long preview ".repeat(30), activity: "2026-10-10T04:03:00Z", unread: 125, context: "Order ASL-1042", readOnly: true, onSelect: () => setSelected(true) },
  ];
  function send(ids: string[]) {
    fixture.checks.attachments.push(ids);
    fixture.checks.sends.push(text);
    if (fixture.loseMediaResponse) {
      fixture.loseMediaResponse = false;
      setMode("uncertainmedia");
      return;
    }
    clearChatAttachments("fixture-media");
    if (mode === "uncertainmedia") setMode("media");
    setMessages(current => [...current, {
      id: `send${current.length}`, sequence: current.length + 1,
      mine: true, sender: "You", body: text, createdAt: new Date().toISOString(),
    }]);
    setText("");
  }
  const history = mode === "long" ? [...messages, {
    id: "long", sequence: 5, mine: true, sender: "You",
    body: "Unbroken".repeat(300), createdAt: "2026-10-11T04:04:00Z",
  }] : mode === "emptythread" ? [] : mode === "media" ? [...messages, { ...initial[0], id: "photo", sequence: 5, attachments: [asset] }] : messages;

  return (
    <>
      <header style={{ height: 64, background: "#4C1268", color: "white", padding: 20 }}>AISLEY</header>
      <Shell channel="shop" focusConversation={selected}>
        <ChatWorkspace
          entries={entries}
          selected={selected}
          inboxTitle="Shop conversations"
          inboxStatus={mode === "loading" ? <p role="status" className="p-4">Loading conversations…</p> : null}
          inboxError={mode === "error" ? "Messages could not be loaded." : undefined}
          onRetryInbox={() => setMode("ready")}
          onBack={() => setSelected(false)}
        >
          {selected ? <>
            <ChatThreadHeader title="Maya Shop" description="Private Shop conversation" />
            <ChatHistory
              messages={history} mediaClient={mediaClient}
              olderCursor={mode === "older"}
              onLoadOlder={() => setMessages(current => [{
                id: "old", sequence: 0, mine: false, sender: "Maya Shop",
                body: "Earlier message", createdAt: "2026-10-10T04:00:00Z",
              }, ...current])}
            />
            <ChatComposer
              media={{ client: mediaClient, draftKey: "fixture-media", context: { conversation_id: "synthetic" } }}
              recipient="Maya Shop" id="fixture-message" value={text}
              onChange={setText} onSubmit={send}
              sendAllowed={mode !== "readonly"} online={mode !== "offline"}
              uncertain={mode === "uncertain" || mode === "uncertainmedia"} sending={mode === "sending"}
              error={mode === "senderror" ? "Try again." : undefined}
            />
          </> : <ChatEmptyState title="Shop messages" description="Select a conversation to read and reply." />}
        </ChatWorkspace>
      </Shell>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
