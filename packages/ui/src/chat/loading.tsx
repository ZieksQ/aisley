import { ChatComposer } from "./composer";
import { ChatThreadHeader } from "./presentation";

export function ChatLoadingThread({ title = "Conversation", status = "Loading conversation…", showHeader = true }: {
  title?: string;
  status?: string;
  showHeader?: boolean;
}) {
  return (
    <>
      {showHeader ? <ChatThreadHeader title={title} /> : null}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#FAF8FB] px-4 py-5 dark:bg-[#141416]" aria-busy="true">
        <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">{status}</p>
      </div>
      <ChatComposer value="" onChange={() => {}} onSubmit={() => {}} recipient={title} sendAllowed={false} readOnlyReason={status} />
    </>
  );
}
