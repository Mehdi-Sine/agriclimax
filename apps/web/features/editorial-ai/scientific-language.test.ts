import {expect,it} from "vitest";
import {numericTokens,unqualifiedAssertion,unsupportedFrenchDate} from "./scientific-language";
const regional=/(?:toute la région|moyenne régionale|hectares?)/i;
it("recognizes only an immediately preceding nominal denial",()=>{
 expect(unqualifiedAssertion("Il s’agit d’un extrême local, pas d’une moyenne régionale.",regional)).toBe(false);
 for(const text of ["Une moyenne régionale de 47,8 mm.","Pas d’une moyenne régionale, mais toute la région est affectée.","Pas d’une moyenne régionale. Toute la région est affectée.","Pas d’une mesure locale : moyenne régionale de 47,8 mm."])
  expect(unqualifiedAssertion(text,regional),text).toBe(true);
});
it("normalizes the Unicode minus without accepting a positive or rounded substitute",()=>{
 expect(numericTokens("−0,8 °C")).toEqual(numericTokens("-0,8 °C"));
 expect(numericTokens("−0,8 °C")).not.toEqual(numericTokens("0,8 °C"));
 expect(numericTokens("−0,8 °C")).not.toEqual(numericTokens("-0,754248 °C"));
 expect(unsupportedFrenchDate("du 15 au 22 novembre","2026-11-15 2026-11-21")).toBe(true);
});
