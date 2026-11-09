/** Lexical checks only: these helpers do not infer scientific facts. */
export function numericTokens(text:string) {
 return (text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g,"$1 $2 $3").replace(/,/g,".").match(/-?\d+(?:\.\d+)?/g)??[]).map(n=>String(Number(n)));
}
const months=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
export function unsupportedFrenchDate(text:string,allowed:string) {
 const dates=allowed.match(/\d{4}-\d{2}-\d{2}/g)??[];
 const pattern=new RegExp(`(?:(?:du|entre le)\\s+(\\d{1,2})\\s+(?:au|et le)\\s+)?(\\d{1,2})\\s+(${months.join("|")})(?:\\s+(\\d{4}))?`,"gi");
 for(const m of text.matchAll(pattern)) {
  const month=String(months.indexOf(m[3].toLowerCase())+1).padStart(2,"0");
  for(const day of [m[1],m[2]].filter(Boolean)) {
   const ending=`-${month}-${day.padStart(2,"0")}`;
   if(!dates.some(d=>d.endsWith(ending)&&(!m[4]||d.startsWith(m[4]+"-")))) return true;
  }
 }
 return false;
}
/** A negation qualifies its own clause, never an assertion after “mais” or a new sentence. */
export function unqualifiedAssertion(text:string,pattern:RegExp) {
 for(const match of text.matchAll(new RegExp(pattern.source,"gi"))) {
  const start=match.index!;
  const before=text.slice(0,start).split(/[.!?;,]|\b(?:mais|pourtant|cependant|toutefois)\b/i).at(-1)??"";
  const after=text.slice(start+match[0].length);
  const negated=/(?:\baucun(?:e|s)?\b|\bsans\b).{0,65}$/i.test(before)
   || /(?:\bne\b|\bn[’']).{0,45}\b(?:pas|jamais|aucun(?:e)?)\b.{0,65}$/i.test(before)
   || /\bnon\s+(?:un[e]?\s+)?(?:constat|observation).{0,25}$/i.test(before)
   || (/(?:\bne|\bn[’'])\s*$/i.test(before)&&/^[a-zà-ÿ]{0,8}\s+(?:pas|jamais|aucun(?:e|s)?)\b/i.test(after));
  if(!negated)return true;
 }
 return false;
}
