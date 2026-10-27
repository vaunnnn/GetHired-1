const http = require("node:http");
let expired = true, calls = [], mode = "expired";
let bindings = new Map(), issued = 0, csrfCalls = 0, writeCalls = 0, active = 0, maxActive = 0, overlaps = 0, held = false, waiters = [];
const current = {user:{id:"11111111-1111-4111-8111-111111111111",role:"admin",displayName:"Audit",email:"audit@example.test",student:null},session:{expiresAt:"2099-01-01T00:00:00.000Z",rememberMe:false}};
http.createServer(async (req,res)=>{
  const path = new URL(req.url,"http://fixture").pathname;
  const respond=(status,data,error)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify({requestId:"audit",...(error?{error:{code:error,message:error}}:{data})}));};
  if(path==="/control/reset") {
    const url=new URL(req.url,"http://fixture");mode=url.searchParams.get("mode")??"expired";expired=mode!=="current";calls=[];
    bindings = new Map(); issued = csrfCalls = writeCalls = active = maxActive = overlaps = 0; held = false;
    return respond(200,{});
  }
  if(path==="/control/trace") return respond(200,calls);
  if(path==="/control/state") return respond(200,{issued,csrfCalls,writeCalls,active,maxActive,overlaps});
  if(path==="/control/hold") { held = new URL(req.url,"http://fixture").searchParams.get("value")==="true"; if(!held) { waiters.forEach(done=>done()); waiters=[]; } return respond(200,{}); }
  calls.push({path,method:req.method,start:Date.now()});
  if(mode==="browser") {
    let id = /(?:^|;\s*)phase4-binding=(\d+)/.exec(req.headers.cookie??"")?.[1];
    const issue = signedIn => { id = String(++issued); bindings.set(id,{signedIn}); res.setHeader("Set-Cookie",`phase4-binding=${id}; Path=/; HttpOnly; SameSite=Lax`); };
    if(path==="/api/auth/csrf") { csrfCalls++; if(!bindings.has(id)) issue(false); return respond(200,{csrfToken:`fixture-${id}`}); }
    if(path==="/api/auth/me") return bindings.get(id)?.signedIn ? respond(200,current) : respond(401,null,"UNAUTHENTICATED");
    if(!bindings.has(id) || req.headers["x-csrf-token"]!==`fixture-${id}`) return respond(403,null,"CSRF_FAILED");
    if(path==="/api/auth/login") { overlaps+=active; issue(true); return respond(200,current); }
    if(path==="/api/auth/logout") { overlaps+=active; bindings.delete(id); res.setHeader("Set-Cookie","phase4-binding=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"); return respond(200,{loggedOut:true}); }
    if(path==="/api/admin/companies" && req.method==="PATCH") {
      writeCalls++;
      if(!bindings.get(id)?.signedIn) return respond(401,null,"UNAUTHENTICATED");
      const query = new URL(req.url,"http://fixture").searchParams;
      if(query.has("csrfFailure")) return respond(403,null,"CSRF_FAILED");
      if(query.has("uncertain")) { res.writeHead(503,{"Content-Type":"text/html"}); return res.end("Fixture response lost after possible commit"); }
      maxActive=Math.max(maxActive,++active);
      if(held) await new Promise(done=>waiters.push(done));
      await new Promise(done=>setTimeout(done,75)); active--;
      return respond(200,{});
    }
    return respond(501,null,"NOT_IMPLEMENTED");
  }
  await new Promise(resolve=>setTimeout(resolve,75));
  if(mode==="outage") return respond(503,null,"SERVICE_UNAVAILABLE");
  if(path==="/api/auth/csrf") return respond(200,{csrfToken:"fixture-only"});
  if(path==="/api/auth/me") return expired?respond(401,null,"SESSION_EXPIRED"):respond(200,current);
  if(path==="/api/auth/refresh" && req.method==="POST") {expired=false;return respond(200,current);}
  if(path==="/api/admin/companies" && req.method==="PATCH") return respond(200,{});
  respond(501,null,"NOT_IMPLEMENTED");
}).listen(process.env.PORT);
