import 'server-only';
export type JsonValue = null | boolean | number | string | JsonValue[] | {[key:string]:JsonValue};
type Node = [0,string] | [1,null|boolean|number] | [2,number[]] | [3,number[]];
export interface HistoryProduct {version:'climate-history-product-1';root:number;nodes:Node[]}
/** Lossless dictionary of repeated references, supports and daily evidence; no rounding. */
export function packHistoryProduct(value:JsonValue):HistoryProduct {
 const nodes:Node[]=[],known=new Map<string,number>();
 function visit(v:JsonValue):number {
  let node:Node;
  if(typeof v==='string')node=[0,v];
  else if(v===null||typeof v==='boolean'||typeof v==='number'){
   if(typeof v==='number'&&!Number.isFinite(v))throw Error('PRODUCT_VALUE');
   node=[1,v];
  } else if(Array.isArray(v))node=[2,v.map(visit)];
  else node=[3,Object.entries(v).flatMap(([k,x])=>[visit(k),visit(x)])];
  const signature=JSON.stringify(node),hit=known.get(signature);if(hit!==undefined)return hit;
  const id=nodes.length;nodes.push(node);known.set(signature,id);return id;
 }
 const root=visit(value);return {version:'climate-history-product-1',root,nodes};
}
export function unpackHistoryProduct(product:HistoryProduct):JsonValue {
 if(product.version!=='climate-history-product-1'||product.nodes.length>1000000||!Number.isInteger(product.root)||product.root<0||product.root>=product.nodes.length)throw Error('PRODUCT_CONTRACT');
 const values:JsonValue[]=[];
 for(const [index,node] of product.nodes.entries()){
  function child(id:number):JsonValue {if(!Number.isInteger(id)||id<0||id>=index)throw Error('PRODUCT_REFERENCE');return values[id];}
  if(node[0]===0)values.push(node[1]);
  else if(node[0]===1){if(typeof node[1]==='number'&&!Number.isFinite(node[1]))throw Error('PRODUCT_VALUE');values.push(node[1]);}
  else if(node[0]===2)values.push(node[1].map(child));
  else {
   if(node[1].length%2)throw Error('PRODUCT_OBJECT');
   const entries:[string,JsonValue][]=[];
   for(let i=0;i<node[1].length;i+=2){const key=child(node[1][i]);if(typeof key!=='string')throw Error('PRODUCT_KEY');entries.push([key,child(node[1][i+1])]);}
   if(new Set(entries.map(e=>e[0])).size!==entries.length)throw Error('PRODUCT_DUPLICATE_KEY');
   values.push(Object.fromEntries(entries));
  }
 }
 return values[product.root];
}
