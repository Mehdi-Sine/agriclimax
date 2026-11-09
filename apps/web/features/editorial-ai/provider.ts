import "server-only";
import schema from "../../../../contracts/jsonschema/editorial-draft-1.schema.json";
import type { AIConfig } from "./config";
import type { Usage } from "./model";
import { INSTRUCTIONS } from "./prompt";
export interface ProviderResult {
  draft: unknown;
  model: string;
  response_id: string;
  usage: Usage;
}
export type Provider = (
  payload: string,
  config: AIConfig,
) => Promise<ProviderResult>;
export class ProviderFailure extends Error {
  constructor(
    public code: string,
    public ambiguous = true,
  ) {
    super(code);
  }
}
export function requestBody(payload: string, c: AIConfig) {
  // Official Responses API, strict structured output, no tools and no implicit retries.
  const { $schema: dialect, title, ...outputSchema } = schema;
  void dialect;
  void title;
  return {
    model: c.model,
    store: false,
    instructions: INSTRUCTIONS,
    input: [{ role: "user", content: [{ type: "input_text", text: payload }] }],
    max_output_tokens: c.max_output_tokens,
    text: {
      format: {
        type: "json_schema",
        name: "EditorialDraft",
        strict: true,
        schema: outputSchema,
      },
    },
  };
}
/** UTF-8 byte bound: byte-level tokenizers cannot exceed one token per byte.
 * Add a fixed envelope reserve; reject unsupported models through explicit pricing/model verification. */
export function inputTokenBound(payload: string, c: AIConfig) {
  return (
    Buffer.byteLength(JSON.stringify(requestBody(payload, c)), "utf8") + 4096
  );
}
export function openAIProvider(
  key: string,
  transport: typeof fetch = fetch,
): Provider {
  return async (payload, c) => {
    let response: Response;
    try {
      response = await transport("https://api.openai.com/v1/responses", {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody(payload, c)),
        signal: AbortSignal.timeout(c.timeout_ms),
      });
    } catch {
      throw new ProviderFailure("PROVIDER_TIMEOUT_OR_TRANSPORT");
    }
    if (!response.ok)
      throw new ProviderFailure(`PROVIDER_HTTP_${response.status}`);
    let data: {
      status?: string;
      id?: string;
      model?: string;
      output?: { type: string; content?: { type: string; text?: string }[] }[];
      usage?: {
        input_tokens: number;
        output_tokens: number;
        output_tokens_details?: { reasoning_tokens?: number };
      };
    };
    try {
      data = await response.json();
    } catch {
      throw new ProviderFailure("PROVIDER_MALFORMED");
    }
    if (data.status !== "completed")
      throw new ProviderFailure(
        data.status === "incomplete"
          ? "PROVIDER_TOKEN_LIMIT"
          : "PROVIDER_INCOMPLETE",
      );
    const content = data.output?.flatMap((o) => o.content ?? []) ?? [];
    if (content.some((c) => c.type === "refusal"))
      throw new ProviderFailure("PROVIDER_REFUSAL");
    const texts = content.filter((c) => c.type === "output_text");
    if (texts.length !== 1 || !data.id || !data.model || !data.usage)
      throw new ProviderFailure("PROVIDER_MISSING_METADATA");
    const u = data.usage,
      usage = {
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0,
      };
    if (
      Object.values(usage).some((v) => !Number.isSafeInteger(v) || v < 0) ||
      usage.reasoning_tokens > usage.output_tokens
    )
      throw new ProviderFailure("PROVIDER_INVALID_USAGE");
    try {
      return {
        draft: JSON.parse(texts[0].text!),
        model: data.model,
        response_id: data.id,
        usage,
      };
    } catch {
      throw new ProviderFailure("PROVIDER_MALFORMED");
    }
  };
}
/** Read-only model availability check, called only by explicitly enabled live CLI. */
export async function verifyModel(key: string, model: string) {
  const r = await fetch(
    `https://api.openai.com/v1/models/${encodeURIComponent(model)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw Error("MODEL_UNAVAILABLE");
  const value = (await r.json()) as { id?: string };
  if (value.id !== model) throw Error("MODEL_MISMATCH");
}
