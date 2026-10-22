'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {quote,validate,fields}=require('./pricing.cjs');
const options=require('./options.cjs');
function createServer({priceFile,password,secure=true}){
 if(!password||password.length<16)throw Error('Задайте OWNER_PASSWORD длиной от 16 символов');
 const root=path.resolve(__dirname,'../v0.5'),sessions=new Map();let loginWindow=0,loginAttempts=0;
 const rates=()=>validate(JSON.parse(fs.readFileSync(priceFile,'utf8')));rates();
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   try{
    if(req.method!=='POST'&&req.method!=='GET')return send(405,{error:'Метод не поддерживается'});
    if(req.headers.origin&&req.headers.origin!==`${secure?'https':'http'}://${req.headers.host}`)return send(403,{error:'Запрос отклонён'});
    let body={};if(req.method==='POST'){let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>16000000)return send(413,{error:'Проект слишком большой'});chunks.push(c);}body=JSON.parse(Buffer.concat(chunks).toString());}
    const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('owner='))?.slice(6);
    const owner=token&&sessions.get(token)>Date.now();
    if(url.pathname==='/api/login'&&req.method==='POST'){
     if(Date.now()-loginWindow>60000){loginWindow=Date.now();loginAttempts=0;}if(++loginAttempts>20)return send(429,{error:'Слишком много попыток. Подождите минуту.'});
     const a=crypto.createHash('sha256').update(String(body.password||'')).digest(),b=crypto.createHash('sha256').update(password).digest();
     if(!crypto.timingSafeEqual(a,b))return send(401,{error:'Неверный пароль'});
     for(const [key,expiry] of sessions)if(expiry<Date.now())sessions.delete(key);
     const t=crypto.randomBytes(32).toString('hex');sessions.set(t,Date.now()+3600000);res.setHeader('Set-Cookie',`owner=${t}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=3600${secure?'; Secure':''}`);return send(200,{ok:true});
    }
    if(url.pathname==='/api/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie','owner=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');return send(200,{ok:true});}
    if(url.pathname==='/api/quote'&&req.method==='POST'){const q=quote(body.project,rates(),body.kind||'kitchen');return send(200,{currency:q.currency,total:q.total,incomplete:q.incomplete});}
    if(!owner)return send(401,{error:'Войдите как владелец'});
    if(url.pathname==='/api/prices'){
     if(req.method==='GET')return send(200,{rates:rates(),fields,options});
     const r=validate(body);const temp=priceFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(r,null,2),{mode:0o600});fs.renameSync(temp,priceFile);return send(200,{ok:true});
    }
    if(url.pathname==='/api/owner-quote'&&req.method==='POST')return send(200,quote(body.project,rates(),body.kind||'kitchen',body.quantities||{}));
    return send(404,{error:'Не найдено'});
   }catch(e){return send(400,{error:e instanceof SyntaxError?'Неверные данные':e.message.includes('ENOENT')?'Прайс временно недоступен':e.message});}
  }
  if(req.method!=='GET')return send(405,{error:'Метод не поддерживается'});
  let file;
  try{const relative=decodeURIComponent(url.pathname);file=relative==='/owner'?path.join(__dirname,'owner.html'):relative==='/owner.js'?path.join(__dirname,'owner.js'):path.resolve(root,'.'+relative+(relative.endsWith('/')?'index.html':''));if(file!==path.join(__dirname,'owner.html')&&file!==path.join(__dirname,'owner.js')&&!file.startsWith(root+path.sep))return send(404,{error:'Не найдено'});const data=fs.readFileSync(file);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{return send(404,{error:'Не найдено'});}
 });
}
if(require.main===module){
 const port=Number(process.env.PORT||8080),local=process.env.LOCAL_HTTP==='1';
 const server=createServer({priceFile:process.env.PRICE_FILE,password:process.env.OWNER_PASSWORD,secure:!local});
 server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Порт занят. Остановите прежний сервер (Ctrl+C) и запустите снова.':error.message);process.exitCode=1;});
 server.listen(port,local?'127.0.0.1':'0.0.0.0',()=>console.log(local?'Сервер запущен. Кухня: http://localhost:'+port+'/kitchen/ | Корпус: http://localhost:'+port+'/ | Владелец: http://localhost:'+port+'/owner':'Сервер запущен на порту '+port));
}
module.exports={createServer};
