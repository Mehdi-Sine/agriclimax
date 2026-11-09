import "server-only";
import schema from "../../../../contracts/jsonschema/editorial-draft-1.schema.json";
import type { AIConfig } from "./config";
import type { Usage } from "./model";
import { INSTRUCTIONS } from "./prompt";
import {randomUUID} from "node:crypto";
import {auditSchema, rejectionReason, sha256} from "./request-audit";
export interface RequestMetadata {client_request_id:string;request_sha256:string;schema_sha256:string;model:string;max_output_tokens:number;started_at:string}
export interface ProviderResult {
  draft: unknown;
  model: string;
  response_id: string;
  usage: Usage|null;
}
export type Provider = (
  payload: string,
  config: AIConfig,
  context?: {beforeRequest:(metadata:RequestMetadata)=>Promise<void>;usageOptional?:boolean},
) => Promise<ProviderResult>;
export interface HTTPDiagnostic {status:number;code:string|null;type:string|null;param:string|null;request_id:string|null;client_request_id:string;reason:string;schema_context:string[]|null}
export class ProviderFailure extends Error {
  constructor(
    public code: string,
    public ambiguous = true,
    public evidence?: ProviderResult,
    public diagnostic?: HTTPDiagnostic,
  ) {
    super(code);
  }
}
/** Wire-only normalization: keep const/enum semantics while supplying explicit scalar types. */
export function providerSchema<T>(value:T):T {
  if(Array.isArray(value)) return value.map(providerSchema) as T;
  if(value===null||typeof value!=="object") return value;
  const object=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,providerSchema(v)]));
  if("const" in object) {object.enum=[object.const];delete object.const;}
  if(!("type" in object)&&Array.isArray(object.enum)&&object.enum.length) {
    const types=[...new Set(object.enum.map(v=>v===null?"null":typeof v))];
    if(types.length===1&&["string","number","boolean","null"].includes(types[0])) object.type=types[0];
  }
  return object as T;
}
export function requestBody(payload: string, c: AIConfig) {
  // Official Responses API, strict structured output, no tools and no implicit retries.
  const { $schema: dialect, title, ...outputSchema } = schema;
  void dialect;
  void title;
  const normalized=providerSchema(outputSchema);
  auditSchema(normalized);
  return {
    model: c.model,
    store: false,
    ...(c.request_profile
      ? {
          service_tier: "default",
          reasoning: { effort: "low" },
          prompt_cache_options: { mode: "explicit", ttl: "30m" },
        }
      : {}),
    instructions: INSTRUCTIONS,
    input: [{ role: "user", content: [{ type: "input_text", text: payload }] }],
    max_output_tokens: c.max_output_tokens,
    text: {
      format: {
        type: "json_schema",
        name: "EditorialDraft",
        strict: true,
        schema: normalized,
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
  return async (payload, c, context) => {
    const body=requestBody(payload,c), serialized=JSON.stringify(body), clientRequestId=randomUUID();
    await context?.beforeRequest({client_request_id:clientRequestId,request_sha256:sha256(serialized),schema_sha256:sha256(JSON.stringify(body.text.format.schema)),model:c.model,max_output_tokens:c.max_output_tokens,started_at:new Date().toISOString()});
    let response: Response;
    try {
      response = await transport("https://api.openai.com/v1/responses", {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-Client-Request-Id": clientRequestId,
        },
        body: serialized,
        signal: AbortSignal.timeout(c.timeout_ms),
      });
    } catch {
      throw new ProviderFailure("PROVIDER_TIMEOUT_OR_TRANSPORT");
    }
    if (!response.ok) {
      let error:Record<string,unknown>={};
      try {const body:unknown=await response.json();
        if(body&&typeof body==="object"&&"error" in body&&body.error&&typeof body.error==="object") error=body.error as Record<string,unknown>;
      } catch { /* No raw body or credential-bearing provider message enters diagnostics. */ }
      const safe=(v:unknown)=>typeof v==="string"&&/^[a-zA-Z0-9_.\[\]-]{1,160}$/.test(v)&&!/^sk[-_]|bearer/i.test(v)&&(!key||!v.includes(key))?v:null;
      throw new ProviderFailure(`PROVIDER_HTTP_${response.status}`,true,undefined,{
        status:response.status,code:safe(error.code),type:safe(error.type),param:safe(error.param),request_id:safe(response.headers.get("x-request-id")),
        client_request_id:clientRequestId,...rejectionReason(error.message,body.text.format.schema),
      });
    }
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
    const content = data.output?.flatMap((o) => o.content ?? []) ?? [];
    const texts = content.filter((c) => c.type === "output_text");
    const u = data.usage;
    const usage = u
      ? {
          input_tokens: u.input_tokens,
          output_tokens: u.output_tokens,
          reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0,
        }
      : undefined;
    const validUsage =
      usage &&
      Object.values(usage).every((v) => Number.isSafeInteger(v) && v >= 0) &&
      usage.reasoning_tokens <= usage.output_tokens;
    // Whitelisted metadata plus assistant output only; never store raw headers/error bodies.
    const evidence: ProviderResult | undefined =
      validUsage && data.id && data.model
        ? {
            model: data.model,
            response_id: data.id,
            usage: usage!,
            draft: texts
              .map((t) => t.text ?? "")
              .join("")
              .slice(0, 128000),
          }
        : undefined;
    if (data.status !== "completed")
      throw new ProviderFailure(
        data.status === "incomplete"
          ? "PROVIDER_TOKEN_LIMIT"
          : "PROVIDER_INCOMPLETE",
        true,
        evidence,
      );
    if (content.some((c) => c.type === "refusal"))
      throw new ProviderFailure("PROVIDER_REFUSAL", true, evidence);
    if (texts.length !== 1 || !data.id || !data.model || (!data.usage&&!context?.usageOptional))
      throw new ProviderFailure("PROVIDER_MISSING_METADATA", true, evidence);
    if (!validUsage&&!context?.usageOptional) throw new ProviderFailure("PROVIDER_INVALID_USAGE");
    try {
      return {
        draft: JSON.parse(texts[0].text!),
        model: data.model,
        response_id: data.id,
        usage: validUsage?usage!:null,
      };
    } catch {
      throw new ProviderFailure("PROVIDER_MALFORMED", true, evidence);
    }
  };
}
/** Read-only availability check: never submits a Responses request. No price/config dependency. */
export async function verifyModel(
  key: string,
  model: string,
  transport: typeof fetch = fetch,
) {
  if (!key) throw Error("API_KEY_MISSING");
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(model))
    throw Error("INVALID_MODEL_ID");
  let r: Response;
  try {
    r = await transport(
      `https://api.openai.com/v1/models/${encodeURIComponent(model)}`,
      {
        headers: { Authorization: `Bearer ${key}` },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    throw Error("MODEL_VERIFY_TRANSPORT_FAILED");
  }
  if (!r.ok)
    throw Error(
      r.status === 401
        ? "OPENAI_AUTHENTICATION_FAILED"
        : r.status === 403
          ? "OPENAI_MODEL_FORBIDDEN"
          : r.status === 404
            ? "OPENAI_MODEL_NOT_ACCESSIBLE"
            : `OPENAI_VERIFY_HTTP_${r.status}`,
    );
  let value: unknown;
  try {
    value = await r.json();
  } catch {
    throw Error("MODEL_VERIFY_MALFORMED");
  }
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    value.id !== model
  )
    throw Error("MODEL_MISMATCH");
  return {
    version: "openai-model-access-1",
    model,
    available: true,
    verified_at: new Date().toISOString(),
    generation_calls: 0,
  };
}

export function assertModelAccessReceipt(
  value: unknown,
  model: string,
  now = new Date(),
) {
  if (!value || typeof value !== "object")
    throw Error("MODEL_ACCESS_RECEIPT_EXPIRED_OR_MISMATCH");
  const r = value as Record<string, unknown>,
    age =
      typeof r.verified_at === "string"
        ? now.getTime() - Date.parse(r.verified_at)
        : NaN;
  if (
    r.version !== "openai-model-access-1" ||
    r.model !== model ||
    r.available !== true ||
    r.generation_calls !== 0 ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 86400000
  )
    throw Error("MODEL_ACCESS_RECEIPT_EXPIRED_OR_MISMATCH");
}
