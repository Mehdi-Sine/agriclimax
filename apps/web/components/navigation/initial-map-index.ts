export function initialMapIndex(slides:readonly {id:string}[], id?:string):number {
  if (!id) return 0;
  const found=slides.findIndex(slide=>slide.id===id);
  return found===-1?0:found;
}
