import {describe,it,expect} from "vitest";
import {initialMapIndex} from "./initial-map-index";
describe("Cartes du jour : navigation dans les archives",()=>{
 const slides=[{id:"carte-pluie"},{id:"carte-froid"},{id:"carte-secheresse"}];
 it("ouvre une carte archivée sélectionnée depuis le Journal",()=>expect(initialMapIndex(slides,"carte-secheresse")).toBe(2));
 it("n'invente pas de carte pour un identifiant inconnu",()=>expect(initialMapIndex(slides,"inconnue")).toBe(0));
 it("gère une archive vide sans carte de remplacement",()=>expect(initialMapIndex([],"absente")).toBe(0));
 it("ouvre par défaut la première carte disponible",()=>expect(initialMapIndex(slides)).toBe(0));
});
