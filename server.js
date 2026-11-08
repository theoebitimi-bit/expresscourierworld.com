require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const db = new Database(process.env.DB_FILE || path.join(__dirname, "express-courier.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS shipments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, tracking_number TEXT UNIQUE NOT NULL,
 recipient TEXT NOT NULL, destination TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Shipment information received',
 updated_at TEXT NOT NULL, events TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS enquiries (
 id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, name TEXT NOT NULL,
 email TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ec_sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expired INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ec_sessions_expired_idx ON ec_sessions(expired);
`);

class SQLiteSessionStore extends session.Store {
  get(sid, cb) { try { const row=db.prepare("SELECT sess,expired FROM ec_sessions WHERE sid=?").get(sid); if(!row || row.expired < Date.now()) return cb(null,null); cb(null,JSON.parse(row.sess)); } catch (e) { cb(e); } }
  set(sid,sess,cb=()=>{}) { try { const expires=sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now()+86400000; db.prepare("INSERT INTO ec_sessions(sid,sess,expired) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expired=excluded.expired").run(sid, JSON.stringify(sess), expires); cb(); } catch(e) { cb(e); } }
  destroy(sid,cb=()=>{}) { try { db.prepare("DELETE FROM ec_sessions WHERE sid=?").run(sid); cb(); } catch(e){ cb(e); } }
  touch(sid,sess,cb=()=>{}) { this.set(sid,sess,cb); }
}

if (process.env.NODE_ENV === "production") {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error("Set SESSION_SECRET to a random value of at least 32 characters.");
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD_HASH) throw new Error("Set ADMIN_EMAIL and a bcrypt ADMIN_PASSWORD_HASH before production launch.");
  app.set("trust proxy", 1);
}
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc:["'self'"], styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"], fontSrc:["'self'","https://fonts.gstatic.com"], imgSrc:["'self'","data:","https://*.googleusercontent.com"], scriptSrc:["'self'","'unsafe-inline'"], connectSrc:["'self'","https://api.whatsapp.com","https://wa.me"], frameSrc:["'self'","https://www.youtube.com"], objectSrc:["'none'"] } } }));
app.use(express.json({ limit: "30kb" }));
app.use(express.urlencoded({ extended: false, limit: "30kb" }));
app.use(session({
  name: "ec_admin", store: new SQLiteSessionStore(),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(48).toString("hex"),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly:true, sameSite:"strict", secure:process.env.NODE_ENV === "production", maxAge:60*60*1000 }
}));
app.use("/api/", rateLimit({ windowMs:15*60*1000, limit:100, standardHeaders:"draft-7", legacyHeaders:false }));

const publicDir = fs.existsSync(path.join(__dirname, "public")) ? path.join(__dirname, "public") : __dirname;
app.use(express.static(publicDir));

const clean=(v,max=500)=>String(v ?? "").trim().slice(0,max);
const adminOnly=(req,res,next)=>req.session?.admin ? next() : res.status(401).json({error:"Staff sign-in required."});
const csrf=(req,res,next)=>{
  if(!req.path.startsWith("/admin/") && req.path!=="/enquiry") return next();
  const token=req.get("x-csrf-token");
  if(!req.session.csrfToken || !token || token.length!==req.session.csrfToken.length || !crypto.timingSafeEqual(Buffer.from(token),Buffer.from(req.session.csrfToken))) return res.status(403).json({error:"Invalid security token. Refresh the page and try again."});
  next();
};
app.use("/api",csrf);

app.get("/api/config",(req,res)=>{
  if(!req.session.csrfToken) req.session.csrfToken=crypto.randomBytes(32).toString("hex");
  res.json({supportEmail:process.env.SUPPORT_EMAIL||"paulermicheals@gmail.com",whatsappNumber:process.env.WHATSAPP_NUMBER||"447453961866",liveChatScriptUrl:process.env.LIVE_CHAT_SCRIPT_URL||"",csrfToken:req.session.csrfToken});
});
app.get("/api/health",(req,res)=>res.json({status:"ok"}));
app.get("/api/track/:number",(req,res)=>{
  const number=clean(req.params.number,40).toUpperCase();
  const row=db.prepare("SELECT tracking_number,destination,status,updated_at,events FROM shipments WHERE tracking_number=?").get(number);
  if(!row) return res.status(404).json({error:"No shipment was found for that tracking number. Check the number or contact customer support."});
  res.json({...row,events:JSON.parse(row.events)});
});

app.post("/api/enquiry",async(req,res)=>{
  const kind=clean(req.body.kind,30),name=clean(req.body.name,100),email=clean(req.body.email,160);
  const message=clean(req.body.message,2500);
  if(!["quote","support","booking"].includes(kind)||!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||message.length<5) return res.status(400).json({error:"Please provide your name, a valid email address and a clear message."});
  db.prepare("INSERT INTO enquiries(kind,name,email,message,created_at) VALUES(?,?,?,?,?)").run(kind,name,email,message,new Date().toISOString());
  let emailSent=false;
  if(process.env.SMTP_HOST&&process.env.SUPPORT_EMAIL){
   try{const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==="true",auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined});
    await transporter.sendMail({from:process.env.MAIL_FROM||process.env.SMTP_USER,to:process.env.SUPPORT_EMAIL,replyTo:email,subject:`Express Courier ${kind} enquiry`,text:`Name: ${name}\nEmail: ${email}\nMessage:\n${message}`});
    emailSent=true;
   }catch(e){console.error("Email notification failed:",e.message);}
  }
  res.json({message:emailSent?"Thank you. Your request has been received and forwarded to our team.":"Thank you. Your request has been saved. Our team will follow up after support email is configured."});
});

app.post("/api/admin/login",rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:"draft-7",legacyHeaders:false}),async(req,res)=>{
  const email=clean(req.body.email,160).toLowerCase(),password=String(req.body.password||"");
  const adminEmail=(process.env.ADMIN_EMAIL||"").toLowerCase(),hash=process.env.ADMIN_PASSWORD_HASH||"";
  let valid=false; try{valid=!!hash&&await bcrypt.compare(password,hash);}catch{}
  if(!adminEmail||!valid||email!==adminEmail) return res.status(401).json({error:"Invalid staff credentials."});
  req.session.regenerate(err=>{if(err)return res.status(500).json({error:"Unable to start secure session."});req.session.admin=true;req.session.csrfToken=crypto.randomBytes(32).toString("hex");res.json({message:"Signed in."});});
});
app.post("/api/admin/logout",adminOnly,(req,res)=>req.session.destroy(()=>res.json({message:"Signed out."})));
app.get("/api/admin/shipments",adminOnly,(req,res)=>{
  const rows=db.prepare("SELECT tracking_number,recipient,destination,status,updated_at,events FROM shipments ORDER BY id DESC LIMIT 200").all();
  res.json(rows.map(r=>({...r,events:JSON.parse(r.events)})));
});
app.get("/api/admin/enquiries",adminOnly,(req,res)=>res.json(db.prepare("SELECT id,kind,name,email,message,created_at FROM enquiries ORDER BY id DESC LIMIT 200").all()));
app.post("/api/admin/shipments",adminOnly,(req,res)=>{
  const tracking=clean(req.body.trackingNumber,40).toUpperCase(),recipient=clean(req.body.recipient,100),destination=clean(req.body.destination,150),status=clean(req.body.status||"Shipment information received",120);
  if(!/^[A-Z0-9-]{5,40}$/.test(tracking)||!recipient||!destination)return res.status(400).json({error:"Enter a valid tracking number, recipient and destination."});
  const now=new Date().toISOString(),events=[{status,location:destination,timestamp:now,note:"Shipment record created by authorized staff."}];
  try{db.prepare("INSERT INTO shipments(tracking_number,recipient,destination,status,updated_at,events) VALUES(?,?,?,?,?,?)").run(tracking,recipient,destination,status,now,JSON.stringify(events));res.json({message:"Shipment added."});}
  catch{res.status(409).json({error:"That tracking number already exists."});}
});
app.post("/api/admin/shipments/:number/events",adminOnly,(req,res)=>{
  const number=clean(req.params.number,40).toUpperCase(),status=clean(req.body.status,100),location=clean(req.body.location,150),note=clean(req.body.note,500);
  if(!status||!location)return res.status(400).json({error:"Status and location are required."});
  const row=db.prepare("SELECT events FROM shipments WHERE tracking_number=?").get(number);if(!row)return res.status(404).json({error:"Shipment not found."});
  const events=JSON.parse(row.events);events.unshift({status,location,timestamp:new Date().toISOString(),note});const now=new Date().toISOString();
  db.prepare("UPDATE shipments SET status=?,updated_at=?,events=? WHERE tracking_number=?").run(status,now,JSON.stringify(events),number);res.json({message:"Tracking event added."});
});

app.get("*",(req,res)=>res.sendFile(path.join(publicDir, "index.html")));
const port=Number(process.env.PORT||3000);app.listen(port,()=>console.log(`Express Courier running on port ${port}`));
