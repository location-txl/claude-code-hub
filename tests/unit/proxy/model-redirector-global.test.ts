import { describe, expect, test, vi } from "vitest";
import type { Provider } from "@/types/provider";
import { ModelRedirector } from "@/app/v1/_lib/proxy/model-redirector";
import { ProxySession } from "@/app/v1/_lib/proxy/session";

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  },
}));

function createSession(params: { model: string; url?: string; message?: Record<string, unknown> }) {
  const model = params.model;
  const requestUrl = new URL(params.url ?? "http://localhost/v1/messages");
  const requestMessage = params.message ?? { model };

  const session = new (
    ProxySession as unknown as {
      new (init: {
        startTime: number;
        method: string;
        requestUrl: URL;
        headers: Headers;
        headerLog: string;
        request: { message: Record<string, unknown>; log: string; model: string | null };
        userAgent: string | null;
        context: unknown;
        clientAbortSignal: AbortSignal | null;
      }): ProxySession;
    }
  )({
    startTime: Date.now(),
    method: "POST",
    requestUrl,
    headers: new Headers(),
    headerLog: "",
    request: { message: requestMessage, log: "(test)", model },
    userAgent: null,
    context: {},
    clientAbortSignal: null,
  });

  return session;
}

function createProvider(params: {
  id: number;
  name: string;
  providerType: Provider["providerType"];
  modelRedirects?: Record<string, string> | null;
}): Provider {
  return {
    id: params.id,
    name: params.name,
    providerType: params.providerType,
    modelRedirects: params.modelRedirects ?? null,
    priority: 0,
    weight: 1,
    costMultiplier: 1,
    groupTag: null,
  } as unknown as Provider;
}

describe("ModelRedirector.getModelForProviderSelection", () => {
  test("供应商存在该源模型规则时，应保持使用源模型（供应商级优先）", () => {
    const provider = createProvider({
      id: 1,
      name: "p1",
      providerType: "claude",
      modelRedirects: { "claude-a": "provider-target" },
    });

    const model = ModelRedirector.getModelForProviderSelection("claude-a", provider, {
      "claude-a": "global-target",
    });

    expect(model).toBe("claude-a");
  });

  test("供应商不存在该源模型规则时，应使用全局重定向后的模型", () => {
    const provider = createProvider({
      id: 1,
      name: "p1",
      providerType: "claude",
      modelRedirects: null,
    });

    const model = ModelRedirector.getModelForProviderSelection("claude-a", provider, {
      "claude-a": "global-target",
    });

    expect(model).toBe("global-target");
  });
});

describe("ModelRedirector.apply - 全局模型重定向", () => {
  test("当供应商级规则存在时，应覆盖全局规则", () => {
    const session = createSession({ model: "claude-a" });
    const provider = createProvider({
      id: 1,
      name: "p1",
      providerType: "claude",
      modelRedirects: { "claude-a": "provider-target" },
    });
    session.addProviderToChain(provider, { reason: "initial_selection" });

    const changed = ModelRedirector.apply(session, provider, { "claude-a": "global-target" });

    expect(changed).toBe(true);
    expect(session.getOriginalModel()).toBe("claude-a");
    expect(session.getCurrentModel()).toBe("provider-target");
    expect(session.request.note).toContain("Provider");
  });

  test("当供应商级规则不存在时，应使用全局规则", () => {
    const session = createSession({ model: "claude-a" });
    const provider = createProvider({ id: 1, name: "p1", providerType: "claude" });
    session.addProviderToChain(provider, { reason: "initial_selection" });

    const changed = ModelRedirector.apply(session, provider, { "claude-a": "global-target" });

    expect(changed).toBe(true);
    expect(session.getOriginalModel()).toBe("claude-a");
    expect(session.getCurrentModel()).toBe("global-target");
    expect(session.request.note).toContain("Global");
  });

  test("从供应商级规则切换到无规则供应商时，应回落到全局规则而非回到原始模型", () => {
    const session = createSession({ model: "claude-a" });
    const providerA = createProvider({
      id: 1,
      name: "pA",
      providerType: "claude",
      modelRedirects: { "claude-a": "provider-target" },
    });
    const providerB = createProvider({ id: 2, name: "pB", providerType: "claude" });

    session.addProviderToChain(providerA, { reason: "initial_selection" });
    ModelRedirector.apply(session, providerA, { "claude-a": "global-target" });

    session.addProviderToChain(providerB, { reason: "retry_failed", attemptNumber: 2 });
    ModelRedirector.apply(session, providerB, { "claude-a": "global-target" });

    expect(session.getOriginalModel()).toBe("claude-a");
    expect(session.getCurrentModel()).toBe("global-target");
  });

  test("Gemini：应基于原始 URL 路径重写模型段", () => {
    const session = createSession({
      model: "gemini-2.5-flash",
      url: "http://localhost/v1beta/models/gemini-2.5-flash:generateContent",
      message: {},
    });
    const provider = createProvider({ id: 1, name: "g1", providerType: "gemini" });
    session.addProviderToChain(provider, { reason: "initial_selection" });

    ModelRedirector.apply(session, provider, { "gemini-2.5-flash": "gemini-2.0-flash" });

    expect(session.getOriginalModel()).toBe("gemini-2.5-flash");
    expect(session.getCurrentModel()).toBe("gemini-2.0-flash");
    expect(session.requestUrl.pathname).toBe("/v1beta/models/gemini-2.0-flash:generateContent");
  });
});
