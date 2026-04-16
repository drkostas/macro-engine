/**
 * Cloudflare Worker: Garmin DI OAuth authentication proxy.
 *
 * Garmin blocks SSO token exchange from AWS/Azure/GCP IPs (Vercel, GitHub
 * Actions, Docker on cloud VMs). This Worker runs on Cloudflare's edge
 * network, which uses residential-class IPs that Garmin does not block.
 *
 * Endpoints:
 *
 *   POST /exchange   { ticket }
 *     Ticket-based flow. User signs into Garmin's SSO embed widget in their
 *     browser (residential IP, MFA handled natively by Garmin's UI), copies
 *     the resulting URL containing the ST-... ticket, and the app POSTs it
 *     here. Worker exchanges the ticket for a DI OAuth token and returns it.
 *
 *   POST /login      { email, password }
 *     Direct credential flow. User types email + password into the setup
 *     form, app POSTs them here. Worker hits Garmin's portal/api/login from
 *     the Cloudflare edge. Returns one of:
 *       { status: "success", di_token, di_refresh_token, di_client_id }
 *       { status: "needs_mfa", session_id, mfa_method }
 *       { status: "needs_captcha" }
 *       { status: "invalid_credentials" }
 *       { status: "rate_limited" }
 *       { status: "error", message }
 *
 *   POST /login-mfa  { session_id, mfa_code }
 *     Second step when Garmin required MFA. Looks up the stashed session in
 *     KV, verifies the code, exchanges the resulting ticket for a DI token.
 *
 * The Worker never retries on failure to avoid self-inflicted rate limits.
 *
 * Adapted from drkostas/hevy2garmin worker-di.
 */

// ── Types ─────────────────────────────────────────────────────────────────

interface Env {
  MFA_SESSIONS?: KVNamespace;
}

interface LoginBody {
  email?: string;
  password?: string;
}

interface MfaBody {
  session_id?: string;
  mfa_code?: string;
}

interface ExchangeBody {
  ticket?: string;
}

interface MfaSession {
  flavour: string;
  cookies: string;
  mfa_method: string;
  params: string;
  referer: string;
  user_agent: string;
  service_url: string;
  mfa_path: string;
  created_at: number;
}

interface FlavourConfig {
  signinPath: string;
  loginPath: string;
  mfaPath: string;
  clientId: string;
  serviceUrl: string;
  userAgent: string;
}

interface FlavourResult {
  response?: Response;
  fallback?: boolean;
}

interface DiResult {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  status?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const DI_TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const DI_GRANT_TYPE =
  "https://connectapi.garmin.com/di-oauth2-service/oauth/grant/service_ticket";
const CLIENT_ID = "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2";

const PORTAL_SSO = "https://sso.garmin.com";
const PORTAL_CLIENT_ID = "GarminConnect";
const PORTAL_SERVICE_URL = "https://connect.garmin.com/app";
const SSO_EMBED_SERVICE = "https://sso.garmin.com/sso/embed";

const MOBILE_SSO_CLIENT_ID = "GCM_ANDROID_DARK";
const MOBILE_SSO_SERVICE_URL =
  "https://mobile.integration.garmin.com/gcm/android";
const MOBILE_SSO_UA =
  "Mozilla/5.0 (Linux; Android 13; sdk_gphone64_arm64 Build/TE1A.220922.025; wv) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/132.0.0.0 Mobile Safari/537.36";

const DI_HEADERS: Record<string, string> = {
  "User-Agent": "GCM-Android-5.23",
  "X-Garmin-User-Agent":
    "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
  "X-Garmin-Paired-App-Version": "10861",
  "X-Garmin-Client-Platform": "Android",
  "X-App-Ver": "10861",
  "X-Lang": "en",
  "X-GCExperience": "GC5",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
  "Content-Type": "application/x-www-form-urlencoded",
  "Cache-Control": "no-cache",
};

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MFA_SESSION_TTL_SECONDS = 600;

// ── Main handler ──────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");

    try {
      if (path === "" || path === "/exchange") {
        return await handleExchange(request);
      }
      if (path === "/login") {
        return await handleLogin(request, env);
      }
      if (path === "/login-mfa") {
        return await handleLoginMfa(request, env);
      }
      return json({ error: `Unknown path: ${path}` }, 404);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Internal error";
      return json({ error: msg }, 500);
    }
  },
};

// ── /exchange ─────────────────────────────────────────────────────────────

async function handleExchange(request: Request): Promise<Response> {
  const { ticket } = (await request.json()) as ExchangeBody;
  if (!ticket) return json({ error: "No ticket" }, 400);
  if (typeof ticket !== "string" || !ticket.startsWith("ST-")) {
    return json(
      { error: "Ticket must be a Garmin CAS service ticket (starts with ST-)" },
      400,
    );
  }

  const di = await exchangeServiceTicket(ticket, SSO_EMBED_SERVICE);
  if (di.error) return json({ error: di.error }, di.status || 502);

  return json({
    di_token: di.access_token,
    di_refresh_token: di.refresh_token,
    di_client_id: extractClientIdFromJwt(di.access_token!) || CLIENT_ID,
    expires_in: di.expires_in,
    refresh_token_expires_in: di.refresh_token_expires_in,
    scope: di.scope,
  });
}

// ── /login ────────────────────────────────────────────────────────────────

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as LoginBody;
  const email = (body.email || "").trim();
  const password = body.password || "";
  if (!email || !password) {
    return json({ status: "error", message: "email and password required" }, 400);
  }

  // Try portal first, fall back to mobile on 427/429/error.
  const portalResult = await tryLoginFlavour(env, email, password, "portal");
  if (portalResult.fallback) {
    const mobileResult = await tryLoginFlavour(env, email, password, "mobile");
    return mobileResult.response!;
  }
  return portalResult.response!;
}

async function tryLoginFlavour(
  env: Env,
  email: string,
  password: string,
  flavour: string,
): Promise<FlavourResult> {
  const config: FlavourConfig =
    flavour === "mobile"
      ? {
          signinPath: "/mobile/sso/en_US/sign-in",
          loginPath: "/mobile/api/login",
          mfaPath: "/mobile/api/mfa/verifyCode",
          clientId: MOBILE_SSO_CLIENT_ID,
          serviceUrl: MOBILE_SSO_SERVICE_URL,
          userAgent: MOBILE_SSO_UA,
        }
      : {
          signinPath: "/portal/sso/en-US/sign-in",
          loginPath: "/portal/api/login",
          mfaPath: "/portal/api/mfa/verifyCode",
          clientId: PORTAL_CLIENT_ID,
          serviceUrl: PORTAL_SERVICE_URL,
          userAgent: DESKTOP_UA,
        };

  const signinUrl = `${PORTAL_SSO}${config.signinPath}`;
  const params = new URLSearchParams({
    clientId: config.clientId,
    locale: "en-US",
    service: config.serviceUrl,
  });
  const loginUrl = `${PORTAL_SSO}${config.loginPath}?${params}`;
  const referer = `${signinUrl}?clientId=${config.clientId}&service=${config.serviceUrl}`;

  // Step 1: GET sign-in page to establish session cookies.
  let sessionCookies = "";
  try {
    const getResp = await fetch(
      `${signinUrl}?clientId=${config.clientId}&service=${config.serviceUrl}`,
      {
        headers: {
          "User-Agent": config.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      },
    );
    sessionCookies = extractSetCookieHeader(getResp);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return {
      response: json(
        { status: "error", message: `[${flavour}] warmup GET failed: ${msg}` },
        502,
      ),
    };
  }

  // Step 2: POST credentials.
  const postHeaders: Record<string, string> = {
    "User-Agent": config.userAgent,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json",
    Origin: PORTAL_SSO,
    Referer: referer,
  };
  if (sessionCookies) postHeaders.Cookie = sessionCookies;

  let loginResp: Response;
  try {
    loginResp = await fetch(loginUrl, {
      method: "POST",
      headers: postHeaders,
      body: JSON.stringify({
        username: email,
        password,
        rememberMe: true,
        captchaToken: "",
      }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return {
      response: json(
        { status: "error", message: `[${flavour}] login POST failed: ${msg}` },
        502,
      ),
    };
  }

  // Step 3: Parse and branch.
  if (loginResp.status === 429) {
    if (flavour === "portal") return { fallback: true };
    return { response: json({ status: "rate_limited" }) };
  }

  let loginData: Record<string, unknown>;
  try {
    loginData = await loginResp.json() as Record<string, unknown>;
  } catch {
    const text = await loginResp.text().catch(() => "");
    return {
      response: json(
        {
          status: "error",
          message: `[${flavour}] non-JSON login response (HTTP ${loginResp.status}): ${text.slice(0, 200)}`,
        },
        502,
      ),
    };
  }

  const garminErr = loginData?.error as Record<string, unknown> | undefined;
  const garminErrCode = garminErr?.["status-code"] as string | undefined;

  if (garminErrCode === "429") {
    if (flavour === "portal") return { fallback: true };
    return { response: json({ status: "rate_limited" }) };
  }
  if (garminErrCode === "427") {
    if (flavour === "portal") return { fallback: true };
    return {
      response: json({
        status: "needs_captcha",
        message:
          "Garmin returned error 427 on both login flows. Use the manual sign-in fallback.",
      }),
    };
  }
  if (garminErrCode) {
    return {
      response: json(
        {
          status: "error",
          message: `[${flavour}] Garmin login returned error status-code ${garminErrCode}`,
          detail: JSON.stringify(loginData).slice(0, 400),
          http_status: loginResp.status,
        },
        502,
      ),
    };
  }

  const responseStatus = loginData?.responseStatus as Record<string, unknown> | undefined;
  const respType = responseStatus?.type as string | undefined;

  if (respType === "SUCCESSFUL") {
    const ticket = loginData.serviceTicketId as string | undefined;
    if (!ticket) {
      return {
        response: json(
          { status: "error", message: `[${flavour}] login succeeded but no serviceTicketId` },
          502,
        ),
      };
    }
    const di = await exchangeServiceTicket(ticket, config.serviceUrl);
    if (di.error) {
      return {
        response: json({ status: "error", message: di.error }, di.status || 502),
      };
    }
    return {
      response: json({
        status: "success",
        di_token: di.access_token,
        di_refresh_token: di.refresh_token,
        di_client_id: extractClientIdFromJwt(di.access_token!) || CLIENT_ID,
      }),
    };
  }

  if (respType === "MFA_REQUIRED") {
    const customerMfaInfo = loginData?.customerMfaInfo as Record<string, unknown> | undefined;
    const mfaMethod =
      (customerMfaInfo?.mfaLastMethodUsed as string) || "email";
    const postCookies = extractSetCookieHeader(loginResp);
    const mergedCookies = mergeCookieStrings(sessionCookies, postCookies);

    if (!env.MFA_SESSIONS) {
      return {
        response: json(
          {
            status: "error",
            message: "MFA_SESSIONS KV namespace not bound. Set it up in wrangler.toml.",
          },
          500,
        ),
      };
    }
    const sessionId = crypto.randomUUID();
    const sessionState: MfaSession = {
      flavour,
      cookies: mergedCookies,
      mfa_method: mfaMethod,
      params: params.toString(),
      referer,
      user_agent: config.userAgent,
      service_url: config.serviceUrl,
      mfa_path: config.mfaPath,
      created_at: Date.now(),
    };
    await env.MFA_SESSIONS.put(sessionId, JSON.stringify(sessionState), {
      expirationTtl: MFA_SESSION_TTL_SECONDS,
    });
    return {
      response: json({
        status: "needs_mfa",
        session_id: sessionId,
        mfa_method: mfaMethod,
      }),
    };
  }

  if (respType === "INVALID_USERNAME_PASSWORD") {
    return { response: json({ status: "invalid_credentials" }) };
  }

  const rawBody = JSON.stringify(loginData);
  if (
    /captcha/i.test(rawBody) ||
    respType === "CAPTCHA_REQUIRED" ||
    respType === "NEED_CAPTCHA"
  ) {
    return { response: json({ status: "needs_captcha" }) };
  }

  return {
    response: json(
      {
        status: "error",
        message: `[${flavour}] Unexpected responseStatus.type: ${respType || "(none)"}`,
        detail: rawBody.slice(0, 300),
      },
      502,
    ),
  };
}

// ── /login-mfa ────────────────────────────────────────────────────────────

async function handleLoginMfa(request: Request, env: Env): Promise<Response> {
  const { session_id: sessionId, mfa_code: code } =
    (await request.json()) as MfaBody;
  if (!sessionId || !code) {
    return json(
      { status: "error", message: "session_id and mfa_code required" },
      400,
    );
  }

  if (!env.MFA_SESSIONS) {
    return json(
      {
        status: "error",
        message: "MFA_SESSIONS KV namespace not bound. Set it up in wrangler.toml.",
      },
      500,
    );
  }

  const raw = await env.MFA_SESSIONS.get(sessionId);
  if (!raw) {
    return json(
      {
        status: "error",
        message: "MFA session expired or not found, please start over",
      },
      410,
    );
  }
  const session: MfaSession = JSON.parse(raw);

  const mfaPath = session.mfa_path || "/portal/api/mfa/verifyCode";
  const userAgent = session.user_agent || DESKTOP_UA;
  const mfaUrl = `${PORTAL_SSO}${mfaPath}?${session.params}`;
  const mfaHeaders: Record<string, string> = {
    "User-Agent": userAgent,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json",
    Origin: PORTAL_SSO,
    Referer: session.referer,
  };
  if (session.cookies) mfaHeaders.Cookie = session.cookies;

  let mfaResp: Response;
  try {
    mfaResp = await fetch(mfaUrl, {
      method: "POST",
      headers: mfaHeaders,
      body: JSON.stringify({
        mfaMethod: session.mfa_method || "email",
        mfaVerificationCode: code.trim(),
        rememberMyBrowser: true,
        reconsentList: [],
        mfaSetup: false,
      }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return json({ status: "error", message: `mfa verify failed: ${msg}` }, 502);
  }

  if (mfaResp.status === 429) {
    return json({ status: "rate_limited" });
  }

  let mfaData: Record<string, unknown>;
  try {
    mfaData = await mfaResp.json() as Record<string, unknown>;
  } catch {
    return json(
      { status: "error", message: `non-JSON mfa response HTTP ${mfaResp.status}` },
      502,
    );
  }

  const mfaResponseStatus = mfaData?.responseStatus as Record<string, unknown> | undefined;
  const mfaType = mfaResponseStatus?.type as string | undefined;

  if (mfaType !== "SUCCESSFUL") {
    return json(
      {
        status: "mfa_failed",
        message: `Garmin rejected the code (${mfaType || "unknown"})`,
      },
      400,
    );
  }

  const ticket = mfaData.serviceTicketId as string | undefined;
  if (!ticket) {
    return json(
      { status: "error", message: "MFA succeeded but no serviceTicketId returned" },
      502,
    );
  }

  const serviceUrl = session.service_url || PORTAL_SERVICE_URL;
  const di = await exchangeServiceTicket(ticket, serviceUrl);
  if (di.error) return json({ status: "error", message: di.error }, di.status || 502);
  await env.MFA_SESSIONS!.delete(sessionId).catch(() => {});

  return json({
    status: "success",
    di_token: di.access_token,
    di_refresh_token: di.refresh_token,
    di_client_id: extractClientIdFromJwt(di.access_token!) || CLIENT_ID,
  });
}

// ── Shared helpers ────────────────────────────────────────────────────────

async function exchangeServiceTicket(
  ticket: string,
  serviceUrl: string,
): Promise<DiResult> {
  const basicAuth = "Basic " + btoa(`${CLIENT_ID}:`);
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    service_ticket: ticket,
    grant_type: DI_GRANT_TYPE,
    service_url: serviceUrl,
  });

  let resp: Response;
  try {
    resp = await fetch(DI_TOKEN_URL, {
      method: "POST",
      headers: { ...DI_HEADERS, Authorization: basicAuth },
      body,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return { error: `DI exchange network error: ${msg}`, status: 502 };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return {
      error: `DI token exchange failed (${resp.status}): ${text.slice(0, 300)}`,
      status: 502,
    };
  }

  const di = (await resp.json()) as DiResult;
  if (!di.access_token || !di.refresh_token) {
    return { error: "DI response missing expected tokens", status: 502 };
  }
  return di;
}

function extractClientIdFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload.client_id || null;
  } catch {
    return null;
  }
}

function extractSetCookieHeader(resp: Response): string {
  const headers = resp.headers;
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
  const pairs: string[] = [];
  for (const line of setCookies) {
    if (!line) continue;
    const nameValue = line.split(";")[0].trim();
    if (nameValue) pairs.push(nameValue);
  }
  return pairs.join("; ");
}

function mergeCookieStrings(a: string, b: string): string {
  if (!a) return b || "";
  if (!b) return a || "";
  const map = new Map<string, string>();
  for (const str of [a, b]) {
    for (const pair of str
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      map.set(pair.slice(0, eq), pair);
    }
  }
  return [...map.values()].join("; ");
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}
