import Link from "next/link";
import "../../styles/editorial-ui.css";

type Space = "journal" | "cartes" | "climat" | "productions" | "documentation";
const items: { id:Space; label:string; href:string }[] = [
  {id:"journal",label:"Le Journal",href:"/journal"},
  {id:"cartes",label:"Cartes du jour",href:"/cartes-du-jour"},
  {id:"climat",label:"Explorer le climat",href:"/climat"},
  {id:"productions",label:"Productions",href:"/productions"},
  {id:"documentation",label:"Aide et documentation",href:"/aide-et-documentation"}
];
export function EditorialHeader({active,links}:{active?:Space;links?:Partial<Record<Space,string>>}) {
  return <div className="editorial-chrome">
    <div className="editorial-stripes" aria-hidden="true"/>
    <header className="editorial-site-head">
      <Link className="editorial-logo" href="/journal" aria-label="AgriclimaX, retour au Journal">Agriclima<span>X</span><small>Le journal du climat agricole</small></Link>
      <p>Le climat en perspective.<br/>L’agriculture en contexte.</p>
    </header>
    <nav className="editorial-nav" aria-label="Navigation principale">
      {items.map(item=><Link key={item.id} href={links?.[item.id]??item.href} aria-current={active===item.id?"page":undefined}>{item.label}</Link>)}
    </nav>
  </div>;
}
