import { fromNodeHeaders } from "better-auth/node";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { BootstrapResponseSchema, DeviceRegistrationRequestSchema } from "@polar/contracts";
import { eq } from "drizzle-orm";
import type { PolarAuth } from "./auth.js";
import type { ServerConfig } from "./config.js";
import type { PolarDatabase } from "./db/client.js";
import { polarUser } from "./db/schema.js";
import { bootstrapAccount, registerDevice } from "./domain/bootstrap.js";
import { Inngest } from "inngest";
import { installMissionRoutes } from "./missions.js";
import { installWorkspaceContextRoutes } from "./workspace-context.js";
import { installWorkspaceRoutes } from "./workspaces.js";

interface AppOptions {
  auth: PolarAuth;
  db: PolarDatabase;
  config: ServerConfig;
}

export function createApp(options?: AppOptions) {
  const app = Fastify({ logger: true, bodyLimit: 32 * 1024 });
  app.get("/health", async () => ({ status: "ok" }));

  if (!options) return app;
  const { auth, db, config } = options;
  const inngest = new Inngest({
    id: "polar",
    eventKey: config.inngestEventKey,
    signingKey: config.inngestSigningKey,
    isDev: config.environment === "development",
  });

  app.addHook("onRequest", async (request, reply) => {
    const desktopEnvironment = request.headers["x-polar-environment"];
    if (desktopEnvironment !== undefined && desktopEnvironment !== config.environment) {
      return reply.status(409).send({
        error: "ENVIRONMENT_MISMATCH",
        message: "This Polar desktop belongs to a different server environment.",
      });
    }
  });

  app.route({
    method: ["GET", "POST", "OPTIONS"],
    url: "/api/auth/*",
    async handler(request, reply) {
      // Plugin endpoints must preserve the browser CSRF boundary too. Native
      // bearer requests carry no cookies and do not rely on browser authority.
      if (
        request.method === "POST" &&
        request.headers.cookie &&
        request.headers.origin !== config.betterAuthUrl
      ) {
        return reply.status(403).send({ error: "INVALID_ORIGIN" });
      }
      try {
        const url = new URL(request.url, config.betterAuthUrl);
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (key.toLowerCase() === "host" || value === undefined) continue;
          for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
        }
        const body = request.body === undefined ? undefined : JSON.stringify(request.body);
        const forwarded = new Request(url, {
          method: request.method,
          headers,
          ...(body === undefined ? {} : { body }),
        });
        const response = await auth.handler(forwarded);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "set-cookie" && key.toLowerCase() !== "content-length") {
            reply.header(key, value);
          }
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) reply.header("set-cookie", cookies);
        return reply.status(response.status).send(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        request.log.error({ err: error }, "Authentication handler failed");
        return reply.status(500).send({ error: "AUTH_FAILURE", message: "Authentication failed." });
      }
    },
  });

  app.get("/device", async (_request, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      )
      .header("X-Content-Type-Options", "nosniff")
      .type("text/html; charset=utf-8")
      .send(devicePage);
  });

  app.get("/device/device.js", async (_request, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .type("application/javascript; charset=utf-8")
      .send(devicePageScriptForClient(config.desktopClientId));
  });

  app.get("/login", async (request, reply) => {
    const code = (request.query as { user_code?: string }).user_code;
    const destination = code
      ? `/device?user_code=${encodeURIComponent(code.slice(0, 191))}`
      : "/device";
    return reply.redirect(destination);
  });

  app.get("/api/app/bootstrap", async (request, reply) => {
    const user = await authenticatedUser(auth, request, reply);
    if (!user) return;
    try {
      return BootstrapResponseSchema.parse(await bootstrapAccount(db, user));
    } catch (error) {
      request.log.error({ err: error }, "Polar account bootstrap failed");
      return reply.status(503).send({
        error: "BOOTSTRAP_UNAVAILABLE",
        message: "Polar could not prepare your workspace. Retry shortly.",
      });
    }
  });

  app.post("/api/app/devices", async (request, reply) => {
    const user = await authenticatedUser(auth, request, reply);
    if (!user) return;
    const parsed = DeviceRegistrationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "INVALID_DEVICE", message: "Device details are invalid." });
    }
    try {
      const [existing] = await db
        .select({ id: polarUser.id })
        .from(polarUser)
        .where(eq(polarUser.authUserId, user.id))
        .limit(1);
      const userId = existing?.id ?? (await bootstrapAccount(db, user)).user.id;
      return await registerDevice(db, userId, parsed.data);
    } catch (error) {
      request.log.error({ err: error }, "Device registration failed");
      return reply.status(503).send({
        error: "DEVICE_REGISTRATION_FAILED",
        message: "Polar could not register this device. Retry shortly.",
      });
    }
  });

  installMissionRoutes(app, auth, db, config, inngest);
  installWorkspaceContextRoutes(app, auth, db);
  installWorkspaceRoutes(app, auth, db);

  return app;
}

async function authenticatedUser(auth: PolarAuth, request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) {
    reply
      .status(401)
      .send({ error: "UNAUTHENTICATED", message: "Sign in to Polar and try again." });
    return null;
  }
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

const devicePage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign in to Polar</title>
<style>
:root{color-scheme:light;--canvas:#e9e9e6;--surface:#f7f7f4;--ink:#111;--secondary:#6f6f6a;--line:#d8d8d3;--red:#c92d26;font-family:Geist,Inter,system-ui,sans-serif}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;min-height:100vh;background:var(--canvas);color:var(--ink);display:grid;place-items:center;padding:24px}.panel{width:min(100%,440px);padding:34px;background:var(--surface);border:1px solid var(--line);border-radius:18px}.mark{font:500 12px ui-monospace,monospace;letter-spacing:.12em}.eyebrow{margin-top:34px;color:var(--secondary);font:11px ui-monospace,monospace;letter-spacing:.08em}h1{font-size:28px;letter-spacing:-.04em;margin:10px 0 8px}.copy{color:var(--secondary);font-size:14px;line-height:1.55;margin:0 0 22px}.field{display:grid;gap:7px;margin:14px 0;font-size:13px}.field input{height:44px;width:100%;padding:0 12px;border:1px solid var(--line);border-radius:9px;background:white;color:var(--ink);font:inherit}.actions{display:flex;gap:10px;margin-top:18px}.actions button{min-height:44px;flex:1;border:1px solid var(--ink);border-radius:9px;padding:0 14px;background:var(--ink);color:white;font:500 14px inherit;cursor:pointer}.actions button.secondary{background:transparent;color:var(--ink);border-color:var(--line)}button:focus-visible,input:focus-visible{outline:2px solid #6e9fd4;outline-offset:3px}.status{min-height:22px;margin-top:16px;color:var(--secondary);font-size:13px;line-height:1.5}.status.error{color:var(--red)}.device{display:none;margin:18px 0;padding:14px;border:1px solid var(--line);border-radius:10px}.device strong{display:block;margin-bottom:5px}.device span{font-size:13px;color:var(--secondary)}.fine{margin-top:22px;color:var(--secondary);font-size:12px;line-height:1.55}@media(max-width:480px){.panel{padding:26px 22px}h1{font-size:24px}}
</style></head><body><main class="panel"><div class="mark">POLAR</div><p class="eyebrow">ACCOUNT / DEVICE APPROVAL</p><h1 id="title">Sign in to Polar</h1><p class="copy" id="copy">Use your Polar account to securely connect this desktop.</p>
<form id="auth-form"><label class="field">Device code<input id="user-code" name="user_code" autocomplete="one-time-code" autocapitalize="characters" maxlength="191" required></label><label class="field" id="name-field" hidden>Name<input id="name" autocomplete="name" maxlength="120"></label><label class="field">Email<input id="email" type="email" autocomplete="email" maxlength="320" required></label><label class="field">Password<input id="password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required></label><div class="actions"><button id="submit-auth" type="submit">Sign in</button><button class="secondary" id="toggle-signup" type="button">Create account</button></div></form>
<section class="device" id="device"><strong id="device-name">Polar Desktop</strong><span id="device-scope">A Polar desktop app is asking to connect to your account.</span><div class="actions"><button id="approve" type="button">Approve device</button><button class="secondary" id="deny" type="button">Deny</button></div></section><p class="status" id="status" role="status" aria-live="polite"></p><p class="fine">Only approve a code shown by Polar on a desktop you are connecting now. Never approve a code sent in a message or shown by someone else.</p></main><script src="/device/device.js" defer></script></body></html>`;

const devicePageScript = `const form=document.querySelector("#auth-form"),codeInput=document.querySelector("#user-code"),statusLine=document.querySelector("#status"),devicePanel=document.querySelector("#device"),title=document.querySelector("#title"),copy=document.querySelector("#copy"),toggle=document.querySelector("#toggle-signup");let signingUp=false;const query=new URLSearchParams(location.search);if(query.has("user_code"))codeInput.value=query.get("user_code");toggle.addEventListener("click",()=>{signingUp=!signingUp;document.querySelector("#submit-auth").textContent=signingUp?"Create account":"Sign in";toggle.textContent=signingUp?"I already have an account":"Create account";document.querySelector("#password").autocomplete=signingUp?"new-password":"current-password";document.querySelector("#name-field").hidden=!signingUp;document.querySelector("#name").required=signingUp});function message(value,error=false){statusLine.textContent=value;statusLine.classList.toggle("error",error)}async function request(path,body){let response;try{response=await fetch(path,{method:body?"POST":"GET",credentials:"same-origin",headers:body?{"content-type":"application/json"}:{},body:body?JSON.stringify(body):undefined})}catch{message("Polar could not reach the server. Check your connection and retry.",true);return{response:{ok:false,status:0},data:{}}}let data={};try{data=await response.json()}catch{}return{response,data}}async function inspectDevice(){const code=codeInput.value.trim();if(!code)return false;const session=await request("/api/auth/get-session");if(!session.response.ok){message("Polar could not check your session. Check your connection and retry.",true);return false}if(!session.data?.session){message("Sign in or create a Polar account to continue.");return false}const{response}=await request("/api/auth/device?user_code="+encodeURIComponent(code));if(response.status===401){message("Sign in or create a Polar account to continue.");return false}if(!response.ok){message("That device code is invalid or expired. Check the code in Polar and try again.",true);return false}document.querySelector("#device-name").textContent="Polar Desktop";document.querySelector("#device-scope").textContent="Code "+code+" is requesting a Polar account session. Confirm the code is visible in your Polar desktop app.";devicePanel.style.display="block";form.style.display="none";title.textContent="Approve this device?";copy.textContent="Check that this code matches the one shown on your own Polar desktop.";message("Device request verified.");return true}form.addEventListener("submit",async event=>{event.preventDefault();message(signingUp?"Creating your Polar account…":"Signing in…");const payload={email:document.querySelector("#email").value.trim(),password:document.querySelector("#password").value};if(signingUp)payload.name=document.querySelector("#name").value.trim();const{response,data}=await request(signingUp?"/api/auth/sign-up/email":"/api/auth/sign-in/email",payload);if(!response.ok||data.error){message(signingUp?"Account creation failed. Check the details and retry.":"Sign-in failed. Check your email and password and retry.",true);return}message("Signed in. Checking the device request…");await inspectDevice()});document.querySelector("#approve").addEventListener("click",async()=>{message("Approving device…");const{response}=await request("/api/auth/device/approve",{userCode:codeInput.value.trim()});if(!response.ok){message("Could not approve this device. The code may have expired; retry from Polar.",true);return}message("Device approved. You can return to Polar.");document.querySelector("#approve").disabled=true;document.querySelector("#deny").disabled=true});document.querySelector("#deny").addEventListener("click",async()=>{message("Denying device…");const{response}=await request("/api/auth/device/deny",{userCode:codeInput.value.trim()});if(!response.ok){message("Could not deny this request. The code may have expired.",true);return}message("Device request denied.");document.querySelector("#approve").disabled=true;document.querySelector("#deny").disabled=true});if(query.has("user_code")){inspectDevice()}`;

function devicePageScriptForClient(clientId: string) {
  const safeClientId = JSON.stringify(clientId);
  return devicePageScript
    .replace(
      'const{response}=await request("/api/auth/device?user_code="+encodeURIComponent(code));',
      'const{response,data}=await request("/api/auth/device?user_code="+encodeURIComponent(code));',
    )
    .replace(
      'document.querySelector("#device-name").textContent="Polar Desktop";document.querySelector("#device-scope").textContent="Code "+code+" is requesting a Polar account session. Confirm the code is visible in your Polar desktop app.";',
      `if(data.client_id!==${safeClientId}){message("This code cannot be approved by this account. Start again from Polar.",true);return false}document.querySelector("#device-name").textContent="Polar Desktop";document.querySelector("#device-scope").textContent=(data.scope?"Requested access: "+data.scope:"Requested access: a Polar account session.")+" Confirm code "+code+" is visible in your own Polar desktop app.";`,
    );
}
