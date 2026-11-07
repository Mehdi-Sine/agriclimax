// Revalidate the source manifest on every request while avoiding retransmission of unchanged summaries.
export function watchResponse(request:Request,data:{identity:string}){
 const etag=JSON.stringify(data.identity),headers={'Cache-Control':'private, no-cache',ETag:etag};
 return request.headers.get('if-none-match')===etag?new Response(null,{status:304,headers}):Response.json(data,{headers});
}
