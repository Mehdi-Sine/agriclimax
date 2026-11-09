import "server-only";
import { createHash } from "node:crypto";

const keywords = new Set(["type", "properties", "required", "additionalProperties", "items", "enum", "minLength", "maxLength", "maxItems"]);
const scalarTypes = ["string", "number", "integer", "boolean", "null"];
/** Deliberately restricted to our contract's documented Structured Outputs subset. */
export function auditSchema(schema: unknown) {
  let objects = 0, properties = 0, maxDepth = 0, enumValues = 0, stringCharacters = 0;
  function visit(value: unknown, depth: number) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("INVALID_PROVIDER_SCHEMA");
    const s = value as Record<string, unknown>;
    if (Object.keys(s).some(k => !keywords.has(k))) throw Error("UNSUPPORTED_PROVIDER_SCHEMA_KEYWORD");
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.length || types.some(t => typeof t !== "string" || ![...scalarTypes, "object", "array"].includes(t))) throw Error("PROVIDER_SCHEMA_TYPE_REQUIRED");
    maxDepth = Math.max(maxDepth, depth);
    if (s.type === "object") {
      objects++;
      if (!s.properties || typeof s.properties !== "object" || Array.isArray(s.properties) || s.additionalProperties !== false || !Array.isArray(s.required)) throw Error("PROVIDER_SCHEMA_OBJECT_CONTRACT");
      const entries = Object.entries(s.properties);
      if (s.required.length !== entries.length || new Set(s.required).size !== entries.length || entries.some(([k]) => !(s.required as unknown[]).includes(k))) throw Error("PROVIDER_SCHEMA_ALL_FIELDS_REQUIRED");
      properties += entries.length;
      for (const [k, v] of entries) { stringCharacters += k.length; visit(v, depth + 1); }
    } else if (s.type === "array") visit(s.items, depth + 1);
    if (s.enum) {
      if (!Array.isArray(s.enum) || !s.enum.length) throw Error("PROVIDER_SCHEMA_ENUM");
      enumValues += s.enum.length;
      const chars = s.enum.reduce((n: number, v: unknown) => n + (typeof v === "string" ? v.length : 0), 0);
      stringCharacters += chars;
      if (s.enum.length > 250 && chars > 15000) throw Error("PROVIDER_SCHEMA_ENUM_LIMIT");
    }
  }
  if (!schema || typeof schema !== "object" || !("type" in schema) || schema.type !== "object") throw Error("PROVIDER_SCHEMA_ROOT_OBJECT_REQUIRED");
  visit(schema, 1);
  if (properties > 5000 || maxDepth > 10 || enumValues > 1000 || stringCharacters > 120000) throw Error("PROVIDER_SCHEMA_LIMIT");
  return {objects, properties, max_depth: maxDepth, enum_values: enumValues, string_characters: stringCharacters};
}

export const sha256 = (text: string|Uint8Array) => createHash("sha256").update(text).digest("hex");

/** Never retain the provider's free-form message. Extract only a known cause and schema vocabulary. */
export function rejectionReason(message: unknown, schema: unknown) {
  const text = typeof message === "string" ? message.slice(0, 16000) : "";
  const categories: [RegExp, string][] = [
    [/additionalProperties.*(?:required|false|missing)/i, "SCHEMA_ADDITIONAL_PROPERTIES_FALSE_REQUIRED"],
    [/required.*(?:missing|supplied|include|array|every)|(?:missing|extra).*required/i, "SCHEMA_REQUIRED_PROPERTIES_MISMATCH"],
    [/["']type["'].*(?:required|missing)|(?:missing|required).*["']type["']/i, "SCHEMA_TYPE_REQUIRED"],
    [/unsupported parameter|unknown parameter|unrecognized request argument/i, "UNSUPPORTED_PARAMETER"],
    [/not supported.*(?:schema|keyword)|(?:schema|keyword).*not supported/i, "UNSUPPORTED_SCHEMA_KEYWORD"],
    [/context length|context window|maximum context/i, "CONTEXT_LIMIT"],
    [/max_output_tokens/i, "OUTPUT_TOKEN_LIMIT"],
    [/does not exist|do not have access|model.*not found/i, "MODEL_ACCESS"],
  ];
  const vocabulary = new Set<string>(["properties", "items"]);
  function collect(s: unknown) {
    if (!s || typeof s !== "object" || Array.isArray(s)) return;
    const v = s as Record<string, unknown>;
    if (v.properties && typeof v.properties === "object") for (const [k, child] of Object.entries(v.properties)) {vocabulary.add(k); collect(child);}
    collect(v.items);
  }
  collect(schema);
  const context = text.match(/In context=\(([^)]{0,1200})\)/i)?.[1];
  const tokens = context ? [...context.matchAll(/['"]([^'"]{1,80})['"]|(\d+)/g)].map(m => m[1] ?? m[2]) : [];
  return {reason: categories.find(([pattern]) => pattern.test(text))?.[1] ?? "UNCLASSIFIED_PROVIDER_REJECTION",
    schema_context: tokens.length && tokens.every(t => vocabulary.has(t) || /^\d{1,4}$/.test(t)) ? tokens.slice(0, 20) : null};
}
