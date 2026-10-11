// Safe synthetic auth/chat transport for the actual built role applications.
// Install before page scripts execute. No real chat/account writes reach the API.
export function installChatFixture(role) {
  const original = window.fetch.bind(window);
  const id = "20000000-0000-4000-8000-000000000001";
  const state = window.chatAppFixture = { sends: [], replays: {}, messages: [
    { id: "message-one", sequence: 1, body: "Hi! How can I help with your order?", mine: false, sender_role: "seller", created_at: "2026-10-11T04:00:00Z", context: null },
    { id: "message-two", sequence: 2, body: "Does the linen shirt come in medium?", mine: true, sender_role: role, created_at: "2026-10-11T04:01:00Z", context: null },
    { id: "message-three", sequence: 3, body: "Yes, medium is available in cream and olive.", mine: false, sender_role: "seller", created_at: "2026-10-11T04:02:00Z", context: null },
  ], reads: 0, deny: false, loseResponse: false, loading: false, empty: false, readOnly: false, error: false };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const thread = (path) => ({
    id, kind: path.includes("operational") ? "logistics_courier" : path.includes("logistics") ? `${role}_logistics` : path.includes("courier") ? `courier_${role}` : "customer_shop",
    counterparty_label: "Maya Shop", counterparty_role: "courier",
    shop: { id: "40000000-0000-4000-8000-000000000001", name: "Maya Shop", slug: "maya", ...(state.omitAvailability ? {} : { availability: state.availability ?? "online" }) }, customer_name: "Fixture Buyer",
    order_id: "50000000-0000-4000-8000-000000000001", order_reference: "ORDER-1042",
    pickup_request_id: "60000000-0000-4000-8000-000000000001", pickup_request_reference: "PICKUP-1042",
    task_id: "70000000-0000-4000-8000-000000000001", task_reference: "TASK-1042", leg: "final_mile",
    last_message_preview: state.messages.at(-1)?.body, last_message_at: "2026-10-11T04:02:00Z",
    last_sequence: state.messages.length, last_read_sequence: state.reads,
    unread_count: 2, send_allowed: !state.readOnly, read_only_reason: state.readOnly ? "TASK_NOT_ACTIVE" : null,
  });
  window.fetch = async (input, options = {}) => {
    const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
    if (!path.startsWith("/api/") && !path.startsWith("/sanctum/")) return original(input, options);
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (path.endsWith("/auth/me")) return json({ [role]: {
      id: "30000000-0000-4000-8000-000000000001", role, status: "active", displayName: "Fixture Buyer", avatarUrl: null,
      email: "fixture@example.test", profile: { first_name: "Fixture", last_name: "Buyer", profile_photo_url: null },
      shop: { id: "40000000-0000-4000-8000-000000000001", name: "Maya Shop", status: "active" },
      organization: { id: "80000000-0000-4000-8000-000000000001", business_name: "Fixture Logistics", hub: { id: "90000000-0000-4000-8000-000000000001", name: "Fixture Hub" } },
    } });
    if (path === "/api/v1/policy-consent/status") return json({ data: { all_required_accepted: true } });
    if (/^\/api\/v1\/products\/[^/]+$/.test(path)) return state.contextFails ? json({message:"Product unavailable"},404) : json({data:{id:path.split('/').at(-1),title:"Linen shirt",shop:thread(path).shop}});
    if (/^\/api\/v1\/customer\/orders\/[^/]+$/.test(path)) return json({data:{id:path.split('/').at(-1),reference:"ORDER-1042",shop:thread(path).shop}});
    if (path.endsWith("/chat-attachments")) return json({ data: { enabled: false } });
    if (path.includes("conversations")) {
      if (state.loading) await new Promise(done => setTimeout(done, 1000));
      if (state.deny) return json({ message: "This conversation is unavailable." }, 403);
      if (state.error) return json({ message: "Messages could not be loaded." }, 503);
      if (path.includes("/conversations/shops/")) return json({ data: { shop: thread(path).shop, conversation_id: state.existingShop ? id : null, send_allowed: !state.readOnly } });
      if (path.endsWith("/read")) { state.reads = state.messages.length; return json({ data: thread(path) }); }
      if (options.method === "POST") {
        const input = JSON.parse(options.body);
        const key = new Headers(options.headers).get("Idempotency-Key");
        state.sends.push({ key, input });
        if (state.replays[key]) return json(state.replays[key]);
        const message = { id: crypto.randomUUID(), sequence: state.messages.length + 1, body: input.body, mine: true, sender_role: role, context: null, created_at: new Date().toISOString() };
        state.messages.push(message);
        const result = { conversation: thread(path), message };
        state.replays[key] = result;
        if (state.loseResponse) { state.loseResponse = false; throw new TypeError("Lost synthetic response after commit"); }
        return json(result, 201);
      }
      if (path.endsWith("/messages")) return json({ items: state.messages, data: state.messages, next_cursor: null, meta: { next_cursor: null } });
      if (path.includes(id)) return json({ data: thread(path) });
      if (path.endsWith("/unread-count")) return json({ unread_count: 2 });
      return json({ items: state.empty ? [] : [thread(path)], data: state.empty ? [] : [thread(path)], next_cursor: null, unread_count: 2, meta: { next_cursor: null, unread_count: 2 } });
    }
    return json({ data: [], items: [], unread_count: 0, next_cursor: null, meta: { next_cursor: null, total: 0, unread_count: 0 }, cart: { items: [], itemCount: 0 } });
  };
}
