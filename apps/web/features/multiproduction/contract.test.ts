import { it, expect } from "vitest";
import Ajv from "ajv/dist/2020";
import { mkdirSync, writeFileSync } from "node:fs";
import schema from "../../../../contracts/jsonschema/multiproduction-registry.schema.json";
import { VERSION, PRODUCTIONS, RECIPES } from "./registry";
it("validates the versioned external registry contract", () => {
  const validate = new Ajv({ strict: true }).compile(schema);
  const registry = {
    version: VERSION,
    productions: PRODUCTIONS,
    recipes: RECIPES,
  };
  expect(validate(registry), JSON.stringify(validate.errors)).toBe(true);
  expect(validate({ ...registry, version: "unversioned" })).toBe(false);
  expect(
    validate({ ...registry, recipes: [{ ...RECIPES[0], windows: [31] }] }),
  ).toBe(false);
  if (process.env.AGRO02_EVIDENCE === "1") {
    mkdirSync("../../docs/codex/AGRO-02/evidence", { recursive: true });
    writeFileSync(
      "../../docs/codex/AGRO-02/evidence/catalogue.json",
      JSON.stringify(registry, null, 2) + "\n",
    );
  }
});
