import { afterEach, describe, expect, it, vi } from "vitest";
import { createCodexAuthenticatedFetch, createPiAccountCarrierToken } from "./codex-controller";

const credentials = {
  access: "real-oauth-access-token",
  refresh: "refresh-token",
  expires: Date.now() + 60_000,
  accountId: "acct_test",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Pi Codex authentication adapter", () => {
  it("creates a token payload that Pi can decode with direct atob", () => {
    const token = createPiAccountCarrierToken(credentials.accountId);
    const payloadPart = token.split(".")[1];
    expect(payloadPart).toBeDefined();
    const payload = JSON.parse(atob(payloadPart ?? "")) as Record<string, unknown>;
    const auth = payload["https://api.openai.com/auth"] as Record<string, unknown>;
    expect(auth.chatgpt_account_id).toBe(credentials.accountId);
  });

  it("replaces the local carrier with the real OAuth credential at the network boundary", async () => {
    const mockedFetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", mockedFetch);

    const authenticatedFetch = createCodexAuthenticatedFetch(credentials);
    await authenticatedFetch("https://chatgpt.com/backend-api/codex/responses", {
      method: "POST",
      headers: {
        authorization: "Bearer local-carrier",
        "chatgpt-account-id": "wrong-account",
      },
    });

    expect(mockedFetch).toHaveBeenCalledOnce();
    const init = mockedFetch.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${credentials.access}`);
    expect(headers.get("chatgpt-account-id")).toBe(credentials.accountId);
  });
});
