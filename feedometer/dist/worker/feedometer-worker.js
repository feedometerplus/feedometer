var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// boolean-parser/boolean-parser.js
var require_boolean_parser = __commonJS({
  "boolean-parser/boolean-parser.js"(exports, module) {
    (function(root, factory) {
      if (typeof define === "function" && define.amd) {
        define([], factory);
      } else if (typeof module === "object" && module.exports) {
        module.exports = factory();
      } else {
        root.BooleanParser = factory();
      }
    })(typeof self !== "undefined" ? self : exports, function() {
      "use strict";
      const TOKEN_TERM = "TERM";
      const TOKEN_PHRASE = "PHRASE";
      const TOKEN_AND = "AND";
      const TOKEN_OR = "OR";
      const TOKEN_NOT = "NOT";
      const TOKEN_LPAREN = "LPAREN";
      const TOKEN_RPAREN = "RPAREN";
      function hasExplicitBooleanOperators(query) {
        if (!query || typeof query !== "string") return false;
        return /\b(AND|OR|NOT)\b|[()"'!|+]/.test(query) || /(?:^|\s)-[a-zA-Z0-9]/.test(query);
      }
      __name(hasExplicitBooleanOperators, "hasExplicitBooleanOperators");
      function normalizeQuery(query) {
        if (!query || typeof query !== "string") return "";
        const q = query.trim();
        if (!q) return "";
        if (hasExplicitBooleanOperators(q)) {
          return q;
        }
        const clean = q.replace(/,/g, " ");
        const terms = clean.split(/\s+/).filter(Boolean);
        return terms.join(" AND ");
      }
      __name(normalizeQuery, "normalizeQuery");
      function tokenize(query) {
        if (!query || typeof query !== "string") return [];
        const q = normalizeQuery(query);
        const tokens = [];
        let i = 0;
        const len = q.length;
        while (i < len) {
          const ch = q[i];
          if (/\s/.test(ch) || ch === ",") {
            i++;
            continue;
          }
          if (ch === "(") {
            tokens.push({ type: TOKEN_LPAREN, val: "(" });
            i++;
            continue;
          }
          if (ch === ")") {
            tokens.push({ type: TOKEN_RPAREN, val: ")" });
            i++;
            continue;
          }
          if (ch === '"' || ch === "'") {
            const quoteChar = ch;
            i++;
            let phrase = "";
            while (i < len && q[i] !== quoteChar) {
              phrase += q[i];
              i++;
            }
            if (i < len && q[i] === quoteChar) i++;
            tokens.push({ type: TOKEN_PHRASE, val: phrase.toLowerCase() });
            continue;
          }
          if (ch === "|") {
            tokens.push({ type: TOKEN_OR, val: "OR" });
            i++;
            continue;
          }
          if (ch === "+") {
            tokens.push({ type: TOKEN_AND, val: "AND" });
            i++;
            continue;
          }
          if (ch === "!") {
            tokens.push({ type: TOKEN_NOT, val: "NOT" });
            i++;
            continue;
          }
          if (ch === "-" && i + 1 < len && !/\s/.test(q[i + 1])) {
            tokens.push({ type: TOKEN_NOT, val: "NOT" });
            i++;
            continue;
          }
          let word = "";
          while (i < len && !/[\s,()"'!|+]/.test(q[i])) {
            word += q[i];
            i++;
          }
          const upper = word.toUpperCase();
          if (upper === "AND") {
            tokens.push({ type: TOKEN_AND, val: "AND" });
          } else if (upper === "OR") {
            tokens.push({ type: TOKEN_OR, val: "OR" });
          } else if (upper === "NOT") {
            tokens.push({ type: TOKEN_NOT, val: "NOT" });
          } else if (word) {
            tokens.push({ type: TOKEN_TERM, val: word.toLowerCase() });
          }
        }
        return tokens;
      }
      __name(tokenize, "tokenize");
      function parseAST(tokens) {
        let pos = 0;
        function peek() {
          return tokens[pos] || null;
        }
        __name(peek, "peek");
        function consume(expectedType) {
          const tok = peek();
          if (!tok) return null;
          if (expectedType && tok.type !== expectedType) return null;
          pos++;
          return tok;
        }
        __name(consume, "consume");
        function parseOrExpr() {
          let left = parseAndExpr();
          while (peek() && peek().type === TOKEN_OR) {
            consume(TOKEN_OR);
            const right = parseAndExpr();
            left = { type: "OR", left, right };
          }
          return left;
        }
        __name(parseOrExpr, "parseOrExpr");
        function parseAndExpr() {
          let left = parseNotExpr();
          while (peek() && (peek().type === TOKEN_AND || peek().type === TOKEN_TERM || peek().type === TOKEN_PHRASE || peek().type === TOKEN_LPAREN || peek().type === TOKEN_NOT)) {
            if (peek().type === TOKEN_AND) consume(TOKEN_AND);
            const right = parseNotExpr();
            if (right) {
              left = { type: "AND", left, right };
            }
          }
          return left;
        }
        __name(parseAndExpr, "parseAndExpr");
        function parseNotExpr() {
          if (peek() && peek().type === TOKEN_NOT) {
            consume(TOKEN_NOT);
            const operand = parsePrimary();
            return { type: "NOT", operand };
          }
          return parsePrimary();
        }
        __name(parseNotExpr, "parseNotExpr");
        function parsePrimary() {
          const tok = peek();
          if (!tok) return null;
          if (tok.type === TOKEN_LPAREN) {
            consume(TOKEN_LPAREN);
            const expr = parseOrExpr();
            if (peek() && peek().type === TOKEN_RPAREN) consume(TOKEN_RPAREN);
            return expr;
          }
          if (tok.type === TOKEN_TERM) {
            consume(TOKEN_TERM);
            return { type: "TERM", value: tok.val };
          }
          if (tok.type === TOKEN_PHRASE) {
            consume(TOKEN_PHRASE);
            return { type: "PHRASE", value: tok.val };
          }
          pos++;
          return null;
        }
        __name(parsePrimary, "parsePrimary");
        return parseOrExpr();
      }
      __name(parseAST, "parseAST");
      function evaluateAST(ast, targetText) {
        if (!ast) return true;
        const text = (targetText || "").toLowerCase();
        switch (ast.type) {
          case "TERM":
            return text.includes(ast.value);
          case "PHRASE":
            return text.includes(ast.value);
          case "AND":
            return evaluateAST(ast.left, text) && evaluateAST(ast.right, text);
          case "OR":
            return evaluateAST(ast.left, text) || evaluateAST(ast.right, text);
          case "NOT":
            return !evaluateAST(ast.operand, text);
          default:
            return true;
        }
      }
      __name(evaluateAST, "evaluateAST");
      return {
        tokenize,
        parse(query) {
          const tokens = tokenize(query);
          return parseAST(tokens);
        },
        matches(query, targetTextOrFields) {
          if (!query || !query.trim()) return true;
          let text = "";
          if (typeof targetTextOrFields === "string") {
            text = targetTextOrFields;
          } else if (Array.isArray(targetTextOrFields)) {
            text = targetTextOrFields.filter(Boolean).join(" ");
          } else if (typeof targetTextOrFields === "object" && targetTextOrFields !== null) {
            text = Object.values(targetTextOrFields).filter((v) => typeof v === "string").join(" ");
          }
          const ast = this.parse(query);
          return evaluateAST(ast, text);
        },
        filter(query, items, textExtractor) {
          if (!query || !query.trim()) return items;
          const ast = this.parse(query);
          return items.filter((item) => {
            const text = textExtractor ? textExtractor(item) : JSON.stringify(item);
            return evaluateAST(ast, text);
          });
        }
      };
    });
  }
});

// workers/lib/response.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400"
};
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}
__name(handleOptions, "handleOptions");
function jsonResponse(data, status = 200, customHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...customHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status = 400, code = "ERROR") {
  return jsonResponse({
    status: "error",
    code,
    message
  }, status);
}
__name(errorResponse, "errorResponse");

// workers/lib/crypto.js
async function sha256Hex(data) {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return bufferToHex(buffer);
}
__name(sha256Hex, "sha256Hex");
function generateRandomHex(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateRandomHex, "generateRandomHex");
function bufferToHex(buffer) {
  const arr = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(bufferToHex, "bufferToHex");
function hexToBytes(hex) {
  const clean = (hex || "").replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}
__name(hexToBytes, "hexToBytes");
function timingSafeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
__name(timingSafeEqualHex, "timingSafeEqualHex");
var PBKDF2_ITERATIONS = 1e5;
async function derivePbkdf2Hex(password, saltBytes, iterations) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations,
      hash: "SHA-256"
    },
    key,
    256
  );
  return bufferToHex(bits);
}
__name(derivePbkdf2Hex, "derivePbkdf2Hex");
async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await derivePbkdf2Hex(password, saltBytes, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${bufferToHex(saltBytes)}:${hashHex}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedPasswordHash) {
  if (!storedPasswordHash || !password) return false;
  if (storedPasswordHash.startsWith("pbkdf2:")) {
    const parts = storedPasswordHash.split(":");
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10) || PBKDF2_ITERATIONS;
    const saltHex = parts[2];
    const expected = parts[3];
    const actual = await derivePbkdf2Hex(password, hexToBytes(saltHex), iterations);
    return timingSafeEqualHex(actual, expected);
  }
  if (!storedPasswordHash.includes(":")) return false;
  const [salt, expectedHash] = storedPasswordHash.split(":");
  const actualHash = await sha256Hex(`${salt}:${password}`);
  return timingSafeEqualHex(actualHash, expectedHash);
}
__name(verifyPassword, "verifyPassword");

// workers/lib/session.js
async function verifySessionToken(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  let rawToken = "";
  if (authHeader.startsWith("Bearer ")) {
    rawToken = authHeader.slice(7).trim();
  } else if (request.headers.get("X-Session-Token")) {
    rawToken = request.headers.get("X-Session-Token").trim();
  }
  if (!rawToken || !env.DB) return null;
  try {
    const tokenHash = await sha256Hex(rawToken);
    const now = Date.now();
    const session = await env.DB.prepare(`
      SELECT s.id as session_id, s.user_id, s.expires_at, s.device_name, s.ip_address,
             u.email, u.first_name, u.last_name, u.display_name, u.dob, u.dob_locked,
             u.avatar_url, u.email_verified, u.status, u.created_at
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
    `).bind(tokenHash, now).first();
    if (!session) return null;
    env.DB.prepare("UPDATE user_sessions SET last_seen = ? WHERE id = ?").bind(now, session.session_id).run().catch(() => {
    });
    const displayName = session.display_name || session.first_name || session.email.split("@")[0];
    const avatarUrl = session.avatar_url || "";
    return {
      userId: session.user_id,
      email: session.email,
      sessionId: session.session_id,
      user: {
        id: session.user_id,
        email: session.email,
        email_verified: session.email_verified,
        first_name: session.first_name || "",
        last_name: session.last_name || "",
        display_name: displayName,
        name: displayName,
        dob: session.dob || "",
        dob_locked: session.dob_locked || 0,
        avatar_url: avatarUrl,
        picture: avatarUrl,
        created_at: session.created_at
      }
    };
  } catch (e) {
    console.error("Session verification error:", e.message);
    return null;
  }
}
__name(verifySessionToken, "verifySessionToken");

// workers/lib/audit.js
function getClientInfo(request) {
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "127.0.0.1";
  const ua = request.headers.get("User-Agent") || "Unknown Browser";
  let device = "Desktop Device";
  if (/iPhone|iPad|iPod/i.test(ua)) device = "Apple iOS Device";
  else if (/Android/i.test(ua)) device = "Android Device";
  else if (/Windows/i.test(ua)) device = "Windows PC";
  else if (/Macintosh|Mac OS/i.test(ua)) device = "Apple Mac";
  else if (/Linux/i.test(ua)) device = "Linux Machine";
  return { ip, ua, device };
}
__name(getClientInfo, "getClientInfo");
async function logAudit(env, userId, eventType, details, request) {
  if (!env.DB) return;
  try {
    const auditId = `aud_${generateRandomHex(12)}`;
    const { ip, ua } = request ? getClientInfo(request) : { ip: "system", ua: "system" };
    const now = Date.now();
    const metaStr = typeof details === "string" ? details : JSON.stringify(details || {});
    await env.DB.prepare(`
      INSERT INTO user_audit_logs (id, user_id, event_type, ip_address, user_agent, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(auditId, userId, eventType, ip, ua, metaStr, now).run();
  } catch (e) {
    console.error("Audit log failed:", e.message);
  }
}
__name(logAudit, "logAudit");

// workers/modules/auth/credentials.js
var SESSION_TTL_DAYS = 30;
var SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1e3;
var MAX_FAILED_ATTEMPTS = 5;
var LOCKOUT_DURATION_MS = 15 * 60 * 1e3;
async function handleRegister(request, env) {
  if (!env.DB) return errorResponse("D1 Database binding missing", 500);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse("Invalid JSON body", 400);
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const firstName = (body.first_name || body.name || "").trim();
  const lastName = (body.last_name || "").trim();
  if (!email || !email.includes("@") || !email.includes(".")) {
    return errorResponse("Valid email address is required", 400);
  }
  if (!password || password.length < 8) {
    return errorResponse("Password must be at least 8 characters long", 400);
  }
  try {
    const existingUser = await env.DB.prepare("SELECT id, email FROM users WHERE email = ?").bind(email).first();
    if (existingUser) {
      const existingPassword = await env.DB.prepare("SELECT user_id FROM user_passwords WHERE user_id = ?").bind(existingUser.id).first();
      if (existingPassword) {
        return errorResponse("An account with this email already exists. Please log in.", 409);
      } else {
        return errorResponse("An account with this email already exists via Google Sign-In. Please sign in with Google or set a password in Settings.", 409);
      }
    }
    const userId = `u_${generateRandomHex(12)}`;
    const passwordHash = await hashPassword(password);
    const now = Date.now();
    const { ip, ua, device } = getClientInfo(request);
    await env.DB.prepare(`
      INSERT INTO users (id, email, email_verified, first_name, last_name, display_name, status, created_at, last_login)
      VALUES (?, ?, 0, ?, ?, ?, 'active', ?, ?)
    `).bind(userId, email, firstName, lastName, firstName || email.split("@")[0], now, now).run();
    await env.DB.prepare(`
      INSERT INTO user_passwords (user_id, password_hash, password_changed_at, failed_attempts, locked_until)
      VALUES (?, ?, ?, 0, NULL)
    `).bind(userId, passwordHash, now).run();
    await env.DB.prepare(`
      INSERT INTO user_preferences (user_id, theme, reading_mode, font_size, default_view, timezone, language, date_format, email_notifications, auto_mark_read, updated_at)
      VALUES (?, 'system', 'cards', 'medium', 'home', 'UTC', 'en', 'YYYY-MM-DD', 1, 0, ?)
    `).bind(userId, now).run();
    const verifyToken = generateRandomHex(32);
    const verifyHash = await sha256Hex(verifyToken);
    const verifyId = `ev_${generateRandomHex(12)}`;
    await env.DB.prepare(`
      INSERT INTO email_verifications (id, user_id, token_hash, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).bind(verifyId, userId, verifyHash, now + 24 * 60 * 60 * 1e3, now).run();
    const rawToken = generateRandomHex(32);
    const tokenHash = await sha256Hex(rawToken);
    const sessionId = `sess_${generateRandomHex(12)}`;
    const expiresAt = now + SESSION_TTL_MS;
    await env.DB.prepare(`
      INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, device_name, created_at, expires_at, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(sessionId, userId, tokenHash, ip, ua, device, now, expiresAt, now).run();
    await logAudit(env, userId, "REGISTRATION_SUCCESS", { method: "password", ip }, request);
    return jsonResponse({
      status: "success",
      token: rawToken,
      user: {
        id: userId,
        email,
        email_verified: 0,
        first_name: firstName,
        last_name: lastName,
        display_name: firstName || email.split("@")[0],
        avatar_url: "",
        dob: "",
        dob_locked: 0,
        created_at: now
      }
    }, 201);
  } catch (err) {
    console.error("Registration failed:", err.message);
    return errorResponse("Failed to create account: " + err.message, 500);
  }
}
__name(handleRegister, "handleRegister");
async function handleLogin(request, env) {
  if (!env.DB) return errorResponse("D1 Database binding missing", 500);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse("Invalid JSON body", 400);
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) {
    return errorResponse("Email and password are required", 400);
  }
  try {
    const user = await env.DB.prepare(`
      SELECT id, email, email_verified, first_name, last_name, display_name, dob, dob_locked, avatar_url, status, created_at
      FROM users WHERE email = ?
    `).bind(email).first();
    if (!user || user.status !== "active") {
      return errorResponse("Invalid email or password", 401);
    }
    const passRecord = await env.DB.prepare(`
      SELECT password_hash, failed_attempts, locked_until FROM user_passwords WHERE user_id = ?
    `).bind(user.id).first();
    if (!passRecord) {
      return errorResponse("This account was created via Google Sign-In. Please sign in with Google or use password recovery in Settings.", 400);
    }
    const now = Date.now();
    if (passRecord.locked_until && passRecord.locked_until > now) {
      const remainingMinutes = Math.ceil((passRecord.locked_until - now) / 6e4);
      return errorResponse(`Account is temporarily locked due to repeated failed logins. Please try again in ${remainingMinutes} minute(s).`, 423);
    }
    const isValid = await verifyPassword(password, passRecord.password_hash);
    if (!isValid) {
      const attempts = (passRecord.failed_attempts || 0) + 1;
      let lockedUntil = null;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = now + LOCKOUT_DURATION_MS;
      }
      await env.DB.prepare("UPDATE user_passwords SET failed_attempts = ?, locked_until = ? WHERE user_id = ?").bind(attempts, lockedUntil, user.id).run();
      await logAudit(env, user.id, "LOGIN_FAILED", { attempts, locked: Boolean(lockedUntil) }, request);
      return errorResponse("Invalid email or password", 401);
    }
    await env.DB.prepare("UPDATE user_passwords SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?").bind(user.id).run();
    await env.DB.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind(now, user.id).run();
    const { ip, ua, device } = getClientInfo(request);
    const rawToken = generateRandomHex(32);
    const tokenHash = await sha256Hex(rawToken);
    const sessionId = `sess_${generateRandomHex(12)}`;
    const expiresAt = now + SESSION_TTL_MS;
    await env.DB.prepare(`
      INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, device_name, created_at, expires_at, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(sessionId, user.id, tokenHash, ip, ua, device, now, expiresAt, now).run();
    await logAudit(env, user.id, "LOGIN_SUCCESS", { method: "password", ip, device }, request);
    return jsonResponse({
      status: "success",
      token: rawToken,
      user: {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        display_name: user.display_name || user.first_name || user.email.split("@")[0],
        dob: user.dob || "",
        dob_locked: user.dob_locked || 0,
        avatar_url: user.avatar_url || "",
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error("Login failed:", err.message);
    return errorResponse("Login failed: " + err.message, 500);
  }
}
__name(handleLogin, "handleLogin");
async function handleLogout(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) {
    return jsonResponse({ status: "success", message: "Logged out" });
  }
  try {
    await env.DB.prepare("DELETE FROM user_sessions WHERE id = ?").bind(session.sessionId).run();
    await logAudit(env, session.userId, "LOGOUT", {}, request);
    return jsonResponse({ status: "success", message: "Logged out successfully" });
  } catch (e) {
    return errorResponse("Failed to delete session", 500);
  }
}
__name(handleLogout, "handleLogout");
var RESET_TOKEN_TTL_MS = 60 * 60 * 1e3;
async function handleForgotPassword(request, env) {
  if (!env.DB) return errorResponse("D1 Database binding missing", 500);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse("Invalid JSON body", 400);
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@") || !email.includes(".")) {
    return errorResponse("Valid email address is required", 400);
  }
  const now = Date.now();
  const genericSuccess = {
    status: "success",
    message: "If an account exists with this email address, password reset instructions have been generated."
  };
  try {
    const user = await env.DB.prepare("SELECT id, email, status FROM users WHERE email = ?").bind(email).first();
    if (!user || user.status !== "active") {
      return jsonResponse(genericSuccess, 200);
    }
    const passRecord = await env.DB.prepare("SELECT user_id FROM user_passwords WHERE user_id = ?").bind(user.id).first();
    if (!passRecord) {
      return jsonResponse({
        status: "success",
        message: "This account is registered via Google Sign-In. Please sign in using Google."
      }, 200);
    }
    await env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0").bind(user.id).run();
    const rawResetToken = generateRandomHex(32);
    const tokenHash = await sha256Hex(rawResetToken);
    const resetId = `prt_${generateRandomHex(12)}`;
    const expiresAt = now + RESET_TOKEN_TTL_MS;
    await env.DB.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).bind(resetId, user.id, tokenHash, expiresAt, now).run();
    await logAudit(env, user.id, "PASSWORD_RESET_REQUESTED", { email }, request);
    return jsonResponse({
      status: "success",
      message: "Password reset link generated successfully.",
      reset_token: rawResetToken,
      expires_at: expiresAt
    }, 200);
  } catch (err) {
    console.error("Forgot password failed:", err.message);
    return errorResponse("Failed to process password reset request: " + err.message, 500);
  }
}
__name(handleForgotPassword, "handleForgotPassword");
async function handleVerifyResetToken(request, env) {
  if (!env.DB) return errorResponse("D1 Database binding missing", 500);
  const url = new URL(request.url);
  const token = (url.searchParams.get("token") || "").trim();
  if (!token || token.length < 16) {
    return errorResponse("Valid reset token is required", 400);
  }
  try {
    const tokenHash = await sha256Hex(token);
    const now = Date.now();
    const record = await env.DB.prepare(`
      SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.email
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token_hash = ?
    `).bind(tokenHash).first();
    if (!record) {
      return errorResponse("Invalid password reset token.", 404);
    }
    if (record.used === 1) {
      return errorResponse("This password reset link has already been used. Please request a new one.", 400);
    }
    if (record.expires_at < now) {
      return errorResponse("This password reset link has expired. Please request a new one.", 400);
    }
    const emailParts = record.email.split("@");
    const maskedName = emailParts[0].length <= 2 ? emailParts[0].charAt(0) + "*" : emailParts[0].charAt(0) + "***" + emailParts[0].slice(-1);
    const maskedEmail = maskedName + "@" + emailParts[1];
    return jsonResponse({
      status: "success",
      valid: true,
      email: maskedEmail
    });
  } catch (err) {
    console.error("Verify reset token failed:", err.message);
    return errorResponse("Failed to verify reset token: " + err.message, 500);
  }
}
__name(handleVerifyResetToken, "handleVerifyResetToken");
async function handleResetPassword(request, env) {
  if (!env.DB) return errorResponse("D1 Database binding missing", 500);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse("Invalid JSON body", 400);
  }
  const token = (body.token || "").trim();
  const newPassword = body.new_password || body.password || "";
  if (!token) {
    return errorResponse("Reset token is required", 400);
  }
  if (!newPassword || newPassword.length < 8) {
    return errorResponse("Password must be at least 8 characters long", 400);
  }
  try {
    const tokenHash = await sha256Hex(token);
    const now = Date.now();
    const record = await env.DB.prepare(`
      SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.email, u.email_verified, u.first_name, u.last_name, u.display_name, u.dob, u.dob_locked, u.avatar_url, u.created_at
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token_hash = ?
    `).bind(tokenHash).first();
    if (!record) {
      return errorResponse("Invalid password reset token.", 404);
    }
    if (record.used === 1) {
      return errorResponse("This password reset link has already been used. Please request a new one.", 400);
    }
    if (record.expires_at < now) {
      return errorResponse("This password reset link has expired. Please request a new one.", 400);
    }
    const userId = record.user_id;
    const newPasswordHash = await hashPassword(newPassword);
    await env.DB.prepare(`
      UPDATE user_passwords
      SET password_hash = ?, password_changed_at = ?, failed_attempts = 0, locked_until = NULL
      WHERE user_id = ?
    `).bind(newPasswordHash, now, userId).run();
    await env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE id = ?").bind(record.id).run();
    await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(userId).run();
    const { ip, ua, device } = getClientInfo(request);
    const rawSessionToken = generateRandomHex(32);
    const sessionTokenHash = await sha256Hex(rawSessionToken);
    const sessionId = `sess_${generateRandomHex(12)}`;
    const expiresAt = now + SESSION_TTL_MS;
    await env.DB.prepare(`
      INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, device_name, created_at, expires_at, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(sessionId, userId, sessionTokenHash, ip, ua, device, now, expiresAt, now).run();
    await logAudit(env, userId, "PASSWORD_RESET_SUCCESS", { ip, device }, request);
    return jsonResponse({
      status: "success",
      message: "Password has been reset successfully.",
      token: rawSessionToken,
      user: {
        id: userId,
        email: record.email,
        email_verified: record.email_verified,
        first_name: record.first_name || "",
        last_name: record.last_name || "",
        display_name: record.display_name || record.first_name || record.email.split("@")[0],
        dob: record.dob || "",
        dob_locked: record.dob_locked || 0,
        avatar_url: record.avatar_url || "",
        created_at: record.created_at
      }
    }, 200);
  } catch (err) {
    console.error("Reset password failed:", err.message);
    return errorResponse("Failed to reset password: " + err.message, 500);
  }
}
__name(handleResetPassword, "handleResetPassword");

// workers/modules/auth/google.js
async function verifyGoogleAccessToken(accessToken, env) {
  const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: "Bearer " + accessToken }
  });
  if (!userinfoRes.ok) return null;
  const profile = await userinfoRes.json();
  if (!profile || !profile.sub || !profile.email) return null;
  const expectedAud = env.GOOGLE_CLIENT_ID || "";
  if (expectedAud) {
    try {
      const infoRes = await fetch(
        "https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(accessToken)
      );
      if (infoRes.ok) {
        const info = await infoRes.json();
        const audience = info.aud || info.azp || "";
        if (audience && audience !== expectedAud) return null;
      }
    } catch (e) {
    }
  }
  const verified = profile.email_verified === true || profile.email_verified === "true";
  if (!verified) return null;
  return profile;
}
__name(verifyGoogleAccessToken, "verifyGoogleAccessToken");
async function handleGoogleAuth(request, env) {
  if (!env.DB) return errorResponse("D1 Database binding missing", 500);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse("Invalid JSON body", 400);
  }
  const accessToken = (body.access_token || "").trim();
  if (!accessToken) {
    return errorResponse("Google access token is required", 400);
  }
  let googleProfile;
  try {
    googleProfile = await verifyGoogleAccessToken(accessToken, env);
  } catch (e) {
    return errorResponse("Google token verification failed", 401);
  }
  if (!googleProfile) {
    return errorResponse("Invalid or unverified Google account", 401);
  }
  const email = String(googleProfile.email || "").trim().toLowerCase();
  const name = String(googleProfile.name || "").trim();
  const picture = String(googleProfile.picture || "").trim();
  const sub = String(googleProfile.sub || "").trim();
  if (!email || !email.includes("@") || !sub) {
    return errorResponse("Google profile is missing email or subject ID", 400);
  }
  try {
    const now = Date.now();
    const { ip, ua, device } = getClientInfo(request);
    const existingProvider = await env.DB.prepare(`
      SELECT user_id FROM user_auth_providers WHERE provider = 'google' AND provider_user_id = ?
    `).bind(sub).first();
    let userId;
    let user;
    if (existingProvider) {
      userId = existingProvider.user_id;
      user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
      const updatedAvatar = picture || (user ? user.avatar_url : "") || "";
      await env.DB.prepare("UPDATE users SET last_login = ?, email_verified = 1, avatar_url = COALESCE(NULLIF(?, ''), avatar_url) WHERE id = ?").bind(now, updatedAvatar, userId).run();
      await env.DB.prepare("UPDATE user_auth_providers SET provider_metadata = ?, provider_email = ? WHERE provider = 'google' AND provider_user_id = ?").bind(JSON.stringify({ name, picture }), email, sub).run();
    } else {
      user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
      if (user) {
        userId = user.id;
        const providerId = `prov_${generateRandomHex(12)}`;
        await env.DB.prepare(`
          INSERT INTO user_auth_providers (id, user_id, provider, provider_user_id, provider_email, provider_metadata, created_at)
          VALUES (?, ?, 'google', ?, ?, ?, ?)
        `).bind(providerId, userId, sub, email, JSON.stringify({ name, picture }), now).run();
        const newAvatar = picture || user.avatar_url || "";
        await env.DB.prepare("UPDATE users SET last_login = ?, email_verified = 1, avatar_url = ? WHERE id = ?").bind(now, newAvatar, userId).run();
        await logAudit(env, userId, "PROVIDER_LINKED", { provider: "google", email }, request);
      } else {
        userId = `u_${generateRandomHex(12)}`;
        const firstName = name ? name.split(" ")[0] : email.split("@")[0];
        const lastName = name ? name.split(" ").slice(1).join(" ") : "";
        await env.DB.prepare(`
          INSERT INTO users (id, email, email_verified, first_name, last_name, display_name, dob_locked, avatar_url, status, created_at, last_login)
          VALUES (?, ?, 1, ?, ?, ?, 0, ?, 'active', ?, ?)
        `).bind(userId, email, firstName, lastName, name || firstName, picture, now, now).run();
        const providerId = `prov_${generateRandomHex(12)}`;
        await env.DB.prepare(`
          INSERT INTO user_auth_providers (id, user_id, provider, provider_user_id, provider_email, provider_metadata, created_at)
          VALUES (?, ?, 'google', ?, ?, ?, ?)
        `).bind(providerId, userId, sub, email, JSON.stringify({ name, picture }), now).run();
        await env.DB.prepare(`
          INSERT INTO user_preferences (user_id, theme, reading_mode, font_size, default_view, timezone, language, date_format, email_notifications, auto_mark_read, updated_at)
          VALUES (?, 'system', 'cards', 'medium', 'home', 'UTC', 'en', 'YYYY-MM-DD', 1, 0, ?)
        `).bind(userId, now).run();
        await logAudit(env, userId, "REGISTRATION_SUCCESS", { method: "google", email }, request);
      }
    }
    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
    const rawToken = generateRandomHex(32);
    const tokenHash = await sha256Hex(rawToken);
    const sessionId = `sess_${generateRandomHex(12)}`;
    const expiresAt = now + SESSION_TTL_MS;
    await env.DB.prepare(`
      INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, device_name, created_at, expires_at, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(sessionId, userId, tokenHash, ip, ua, device, now, expiresAt, now).run();
    await logAudit(env, userId, "LOGIN_SUCCESS", { method: "google", ip, device }, request);
    return jsonResponse({
      status: "success",
      token: rawToken,
      user: {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        display_name: user.display_name || user.first_name || user.email.split("@")[0],
        dob: user.dob || "",
        dob_locked: user.dob_locked || 0,
        avatar_url: user.avatar_url || picture || "",
        picture: user.avatar_url || picture || "",
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error("Google Auth error:", err.message);
    return errorResponse("Google authentication failed: " + err.message, 500);
  }
}
__name(handleGoogleAuth, "handleGoogleAuth");

// workers/modules/auth/sessions.js
async function handleListSessions(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401);
  try {
    const list = await env.DB.prepare(`
      SELECT id, ip_address, user_agent, device_name, created_at, expires_at, last_seen
      FROM user_sessions WHERE user_id = ? ORDER BY last_seen DESC
    `).bind(session.userId).all();
    const mapped = (list.results || []).map((s) => ({
      ...s,
      is_current: s.id === session.sessionId
    }));
    return jsonResponse({ status: "success", sessions: mapped });
  } catch (err) {
    return errorResponse("Failed to list sessions", 500);
  }
}
__name(handleListSessions, "handleListSessions");
async function handleRevokeSession(request, sessionId, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401);
  try {
    await env.DB.prepare("DELETE FROM user_sessions WHERE id = ? AND user_id = ?").bind(sessionId, session.userId).run();
    await logAudit(env, session.userId, "SESSION_REVOKED", { sessionId }, request);
    return jsonResponse({ status: "success", message: "Session revoked" });
  } catch (err) {
    return errorResponse("Failed to revoke session", 500);
  }
}
__name(handleRevokeSession, "handleRevokeSession");
async function handleRevokeOtherSessions(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401);
  try {
    await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ? AND id != ?").bind(session.userId, session.sessionId).run();
    await logAudit(env, session.userId, "OTHER_SESSIONS_REVOKED", {}, request);
    return jsonResponse({ status: "success", message: "All other sessions have been revoked" });
  } catch (err) {
    return errorResponse("Failed to revoke other sessions", 500);
  }
}
__name(handleRevokeOtherSessions, "handleRevokeOtherSessions");

// workers/modules/auth/preferences.js
async function handleMe(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) {
    return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  }
  try {
    const providers = await env.DB.prepare(`
      SELECT provider, provider_email, created_at FROM user_auth_providers WHERE user_id = ?
    `).bind(session.userId).all();
    const prefs = await env.DB.prepare(`
      SELECT theme, reading_mode, font_size, default_view, timezone, language, date_format, email_notifications, auto_mark_read
      FROM user_preferences WHERE user_id = ?
    `).bind(session.userId).first();
    const hasPassword = Boolean(await env.DB.prepare("SELECT user_id FROM user_passwords WHERE user_id = ?").bind(session.userId).first());
    return jsonResponse({
      status: "success",
      user: session.user,
      providers: providers.results || [],
      preferences: prefs || {},
      has_password: hasPassword
    });
  } catch (e) {
    return errorResponse("Failed to retrieve user profile: " + e.message, 500);
  }
}
__name(handleMe, "handleMe");
async function handleProfileUpdate(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse("Invalid JSON body", 400);
  }
  try {
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(session.userId).first();
    if (!user) return errorResponse("User not found", 404);
    const firstName = body.first_name !== void 0 ? body.first_name.trim() : user.first_name;
    const lastName = body.last_name !== void 0 ? body.last_name.trim() : user.last_name;
    const displayName = body.display_name !== void 0 ? body.display_name.trim() : user.display_name;
    const avatarUrl = body.avatar_url !== void 0 ? body.avatar_url.trim() : user.avatar_url;
    let dob = user.dob;
    let dobLocked = user.dob_locked || 0;
    if (body.dob && body.dob !== user.dob) {
      if (user.dob_locked === 1) {
        return errorResponse("Date of Birth has already been verified and locked. Please contact support.", 403);
      }
      dob = body.dob.trim();
      dobLocked = 1;
    }
    const now = Date.now();
    await env.DB.prepare(`
      UPDATE users
      SET first_name = ?, last_name = ?, display_name = ?, dob = ?, dob_locked = ?, avatar_url = ?, updated_at = ?
      WHERE id = ?
    `).bind(firstName, lastName, displayName, dob, dobLocked, avatarUrl, now, session.userId).run();
    await logAudit(env, session.userId, "PROFILE_UPDATED", { firstName, lastName, displayName, dobLocked }, request);
    return jsonResponse({
      status: "success",
      user: {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        dob,
        dob_locked: dobLocked,
        avatar_url: avatarUrl,
        created_at: user.created_at
      }
    });
  } catch (err) {
    return errorResponse("Failed to update profile: " + err.message, 500);
  }
}
__name(handleProfileUpdate, "handleProfileUpdate");
async function handlePasswordChange(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse("Invalid JSON body", 400);
  }
  const currentPassword = body.current_password || "";
  const newPassword = body.new_password || "";
  if (!newPassword || newPassword.length < 8) {
    return errorResponse("New password must be at least 8 characters long", 400);
  }
  try {
    const passRecord = await env.DB.prepare("SELECT password_hash FROM user_passwords WHERE user_id = ?").bind(session.userId).first();
    const now = Date.now();
    const newHash = await hashPassword(newPassword);
    if (passRecord) {
      if (!currentPassword) {
        return errorResponse("Current password is required", 400);
      }
      const isValid = await verifyPassword(currentPassword, passRecord.password_hash);
      if (!isValid) {
        return errorResponse("Current password is incorrect", 403);
      }
      await env.DB.prepare("UPDATE user_passwords SET password_hash = ?, password_changed_at = ?, failed_attempts = 0 WHERE user_id = ?").bind(newHash, now, session.userId).run();
    } else {
      await env.DB.prepare("INSERT INTO user_passwords (user_id, password_hash, password_changed_at, failed_attempts, locked_until) VALUES (?, ?, ?, 0, NULL)").bind(session.userId, newHash, now).run();
    }
    await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ? AND id != ?").bind(session.userId, session.sessionId).run();
    await logAudit(env, session.userId, "PASSWORD_CHANGED", { other_sessions_revoked: true }, request);
    return jsonResponse({
      status: "success",
      message: "Password updated successfully. All other active sessions have been revoked."
    });
  } catch (err) {
    return errorResponse("Failed to change password: " + err.message, 500);
  }
}
__name(handlePasswordChange, "handlePasswordChange");
async function handleGetPreferences(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401);
  try {
    const prefs = await env.DB.prepare("SELECT * FROM user_preferences WHERE user_id = ?").bind(session.userId).first();
    return jsonResponse({ status: "success", preferences: prefs || {} });
  } catch (err) {
    return errorResponse("Failed to load preferences", 500);
  }
}
__name(handleGetPreferences, "handleGetPreferences");
async function handleUpdatePreferences(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse("Invalid JSON body", 400);
  }
  try {
    const now = Date.now();
    const existing = await env.DB.prepare("SELECT * FROM user_preferences WHERE user_id = ?").bind(session.userId).first() || {};
    const theme = body.theme || existing.theme || "system";
    const readingMode = body.reading_mode || existing.reading_mode || "cards";
    const fontSize = body.font_size || existing.font_size || "medium";
    const defaultView = body.default_view || existing.default_view || "home";
    const timezone = body.timezone || existing.timezone || "UTC";
    const language = body.language || existing.language || "en";
    const dateFormat = body.date_format || existing.date_format || "YYYY-MM-DD";
    const emailNotifications = body.email_notifications !== void 0 ? body.email_notifications : existing.email_notifications ?? 1;
    const autoMarkRead = body.auto_mark_read !== void 0 ? body.auto_mark_read : existing.auto_mark_read ?? 0;
    await env.DB.prepare(`
      INSERT INTO user_preferences (user_id, theme, reading_mode, font_size, default_view, timezone, language, date_format, email_notifications, auto_mark_read, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = excluded.theme,
        reading_mode = excluded.reading_mode,
        font_size = excluded.font_size,
        default_view = excluded.default_view,
        timezone = excluded.timezone,
        language = excluded.language,
        date_format = excluded.date_format,
        email_notifications = excluded.email_notifications,
        auto_mark_read = excluded.auto_mark_read,
        updated_at = excluded.updated_at
    `).bind(session.userId, theme, readingMode, fontSize, defaultView, timezone, language, dateFormat, emailNotifications, autoMarkRead, now).run();
    return jsonResponse({
      status: "success",
      preferences: {
        theme,
        reading_mode: readingMode,
        font_size: fontSize,
        default_view: defaultView,
        timezone,
        language,
        date_format: dateFormat,
        email_notifications: emailNotifications,
        auto_mark_read: autoMarkRead
      }
    });
  } catch (err) {
    return errorResponse("Failed to update preferences: " + err.message, 500);
  }
}
__name(handleUpdatePreferences, "handleUpdatePreferences");
async function handleDeleteAccount(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401);
  if (!env.DB) return errorResponse("D1 Database binding missing", 500);
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  const confirmEmail = (body.email || "").trim().toLowerCase();
  if (!confirmEmail || confirmEmail !== String(session.email || "").toLowerCase()) {
    return errorResponse("Type your account email to confirm deletion", 400);
  }
  const userId = session.userId;
  try {
    await logAudit(env, userId, "ACCOUNT_DELETE_REQUESTED", { email: confirmEmail }, request);
    const cleanup = [
      "DELETE FROM user_sessions WHERE user_id = ?",
      "DELETE FROM user_passwords WHERE user_id = ?",
      "DELETE FROM user_auth_providers WHERE user_id = ?",
      "DELETE FROM user_preferences WHERE user_id = ?",
      "DELETE FROM email_verifications WHERE user_id = ?",
      "DELETE FROM password_reset_tokens WHERE user_id = ?",
      "DELETE FROM user_feed_assignments WHERE user_id = ?",
      "DELETE FROM user_feeds WHERE user_id = ?",
      "DELETE FROM folders WHERE user_id = ?",
      "DELETE FROM starred_articles WHERE user_id = ?",
      "DELETE FROM saved_articles WHERE user_id = ?",
      "DELETE FROM read_history WHERE user_id = ?"
    ];
    for (const sql of cleanup) {
      try {
        await env.DB.prepare(sql).bind(userId).run();
      } catch (e) {
      }
    }
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    return jsonResponse({ status: "success", message: "Account deleted" });
  } catch (err) {
    return errorResponse("Failed to delete account: " + err.message, 500);
  }
}
__name(handleDeleteAccount, "handleDeleteAccount");

// workers/services/rss-parser.js
function parseXmlFeed(xmlText) {
  if (!xmlText || typeof xmlText !== "string") {
    return { title: "", description: "", link: "", items: [] };
  }
  const cleanCdata = /* @__PURE__ */ __name((str) => {
    if (!str) return "";
    return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
  }, "cleanCdata");
  const decodeEntities2 = /* @__PURE__ */ __name((str) => {
    if (!str) return "";
    return str.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&apos;/gi, "'").replace(/&amp;/gi, "&").replace(/&#x2F;/gi, "/").replace(/&#(\d+);/g, (_, num) => {
      try {
        return String.fromCharCode(parseInt(num, 10));
      } catch (_2) {
        return _2;
      }
    });
  }, "decodeEntities");
  const extractTag = /* @__PURE__ */ __name((block, tagName) => {
    const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${tagName}>`, "i");
    const match2 = block.match(regex);
    return match2 ? cleanCdata(match2[1]) : "";
  }, "extractTag");
  const extractAttr = /* @__PURE__ */ __name((block, tagName, attrName) => {
    const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${tagName}[^>]*?\\s+${attrName}=["']([^"']+)["'][^>]*?\\/?>`, "i");
    const match2 = block.match(regex);
    return match2 ? decodeEntities2(match2[1].trim()) : "";
  }, "extractAttr");
  const extractImage = /* @__PURE__ */ __name((block) => {
    const mediaContent = block.match(/<(?:[a-zA-Z0-9_]+:)?content\b[^>]*?\burl=["']([^"']+)["'][^>]*>/i);
    if (mediaContent && mediaContent[1]) {
      const u = decodeEntities2(mediaContent[1].trim());
      const tagStr = mediaContent[0];
      if (/image/i.test(tagStr) || /\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(u) || !/video|audio/i.test(tagStr) && !tagStr.includes('medium="audio"') && !tagStr.includes('medium="video"')) {
        return u;
      }
    }
    const mediaThumb = block.match(/<(?:[a-zA-Z0-9_]+:)?thumbnail\b[^>]*?\burl=["']([^"']+)["'][^>]*>/i);
    if (mediaThumb && mediaThumb[1]) return decodeEntities2(mediaThumb[1].trim());
    const encMatch = block.match(/<enclosure\b[^>]*?\burl=["']([^"']+)["'][^>]*>/i);
    if (encMatch && encMatch[1]) {
      const tagStr = encMatch[0];
      if (/type=["']image\//i.test(tagStr) || /\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(encMatch[1])) {
        return decodeEntities2(encMatch[1].trim());
      }
    }
    const itunesMatch = block.match(/<(?:[a-zA-Z0-9_]+:)?image\b[^>]*?\bhref=["']([^"']+)["'][^>]*>/i);
    if (itunesMatch && itunesMatch[1]) return decodeEntities2(itunesMatch[1].trim());
    const rawBodies = [
      extractTag(block, "encoded"),
      extractTag(block, "content"),
      extractTag(block, "description"),
      extractTag(block, "summary")
    ].filter(Boolean).join(" ");
    if (rawBodies) {
      const decodedBodies = decodeEntities2(rawBodies);
      const combinedHtml = rawBodies + " " + decodedBodies;
      const imgMatch = combinedHtml.match(/<img[^>]+(?:src|data-src|data-orig-file|data-lazy-src)=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        const candidate = decodeEntities2(imgMatch[1].trim());
        if (!candidate.includes("feedburner.com") && !candidate.includes("1x1") && !/pixel|spacer|beacon|quantserve/i.test(candidate)) {
          return candidate;
        }
      }
    }
    return "";
  }, "extractImage");
  const extractAudio = /* @__PURE__ */ __name((block) => {
    const encUrl = extractAttr(block, "enclosure", "url");
    const encType = extractAttr(block, "enclosure", "type");
    if (encUrl && encType && encType.toLowerCase().startsWith("audio/")) {
      return { url: encUrl, type: encType };
    }
    return null;
  }, "extractAudio");
  const feedTitle = extractTag(xmlText, "title");
  const feedDesc = extractTag(xmlText, "description") || extractTag(xmlText, "subtitle");
  let feedLink = extractAttr(xmlText, "link", "href") || extractTag(xmlText, "link");
  const isAtom = xmlText.includes("<entry");
  const itemTag = isAtom ? "entry" : "item";
  const itemRegex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${itemTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${itemTag}>`, "gi");
  const items = [];
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemBlock = match[1];
    const title = extractTag(itemBlock, "title");
    let link = extractAttr(itemBlock, "link", "href") || extractTag(itemBlock, "link");
    const guid = extractTag(itemBlock, "guid") || extractTag(itemBlock, "id") || link;
    const content = extractTag(itemBlock, "encoded") || extractTag(itemBlock, "content") || "";
    const summary = extractTag(itemBlock, "description") || extractTag(itemBlock, "summary") || content;
    const published = extractTag(itemBlock, "pubDate") || extractTag(itemBlock, "published") || extractTag(itemBlock, "updated") || extractTag(itemBlock, "date");
    const author = extractTag(itemBlock, "author") || extractTag(itemBlock, "creator") || extractTag(itemBlock, "publisher") || "";
    const image = extractImage(itemBlock);
    const audio = extractAudio(itemBlock);
    if (title || link) {
      items.push({
        title,
        link,
        guid,
        summary,
        content,
        published,
        author,
        image,
        audio
      });
    }
  }
  return {
    title: feedTitle,
    description: feedDesc,
    link: feedLink,
    items
  };
}
__name(parseXmlFeed, "parseXmlFeed");

// workers/services/feed-imaging.js
var TRUSTED_MEDIA_HOSTS = /i\.guim\.co\.uk|ichef\.bbci\.co\.uk|espncdn\.com|media\.npr\.org|static01\.nyt\.com|wsj\.net|reuters\.com|theguardian\.com|cdn\.vox-cdn\.com|arstechnica\.net|techcrunch\.com|wp\.com/i;
var JUNK_URL_HINTS = /favicon|sprite|gravatar|gstatic\.com\/favicon|doubleclick|scorecardresearch|pixel\.(gif|png|jpe?g)|spacer|1x1|tracking|quantserve|beacon/i;
var SIGNED_URL_HINTS = /[?&](s|sig|signature|token|hmac|auth|hash)=/i;
function cleanImageUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  let url = raw.trim().replace(/&amp;/g, "&").replace(/&quot;/g, "").replace(/&#39;/g, "'");
  if (url.indexOf("//") === 0) url = "https:" + url;
  return url;
}
__name(cleanImageUrl, "cleanImageUrl");
function isJunkImageUrl(raw) {
  const url = cleanImageUrl(raw);
  if (!url || !/^https?:\/\//i.test(url)) return true;
  const lower = url.toLowerCase();
  if (TRUSTED_MEDIA_HOSTS.test(lower)) {
    return /pixel|spacer|1x1|tracking|beacon/i.test(lower);
  }
  if (JUNK_URL_HINTS.test(lower)) return true;
  if (/\.(svg)(\?|$)/i.test(lower) && /icon|logo|badge|button|arrow|chevron/i.test(lower)) return true;
  if (/\/(1|2|8|16|24|32)x\1\b/i.test(lower)) return true;
  if (/[?&](w|width|h|height)=([1-9]|[12][0-9])\b/i.test(lower)) return true;
  return false;
}
__name(isJunkImageUrl, "isJunkImageUrl");
function upscaleImageUrl(raw) {
  let url = cleanImageUrl(raw);
  if (!url) return "";
  if (SIGNED_URL_HINTS.test(url) || /i\.guim\.co\.uk/i.test(url)) return url;
  url = url.replace(/ichef\.bbci\.co\.uk\/news\/\d+\//i, "ichef.bbci.co.uk/news/1024/");
  url = url.replace(/ichef\.bbci\.co\.uk\/ace\/standard\/\d+\//i, "ichef.bbci.co.uk/ace/standard/1024/");
  url = url.replace(/_\d{3,4}x\d{3,4}(_\d+-\d+)?(\.(jpe?g|png|webp))/i, "_1296x729_16-9$2");
  url = url.replace(/([?&])(w|width)=\d+/ig, "$1$2=1200");
  url = url.replace(/([?&])(h|height)=\d+/ig, "$1$2=800");
  url = url.replace(/resize=\d+,\d+/i, "resize=1200,800");
  url = url.replace(/-\d{2,4}x\d{2,4}(\.(jpe?g|png|webp))/i, "$1");
  url = url.replace(/\/s\d{2,3}(-c)?\//i, "/s1200/");
  url = url.replace(/\/(default|mqdefault|sddefault)\.jpg/i, "/hqdefault.jpg");
  return url;
}
__name(upscaleImageUrl, "upscaleImageUrl");
function youtubeThumbnailFromUrl(articleUrl) {
  if (!articleUrl || typeof articleUrl !== "string") return "";
  const match = articleUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (!match || !match[1]) return "";
  return "https://img.youtube.com/vi/" + match[1] + "/hqdefault.jpg";
}
__name(youtubeThumbnailFromUrl, "youtubeThumbnailFromUrl");
function firstImageInHtml(html) {
  if (!html || typeof html !== "string") return "";
  const decoded = html.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&");
  const combined = html + " " + decoded;
  const match = combined.match(/<img[^>]+(?:src|data-src|data-orig-file|data-lazy-src)=["']([^"']+)["']/i);
  if (!match || !match[1]) return "";
  const url = cleanImageUrl(match[1]);
  if (!url || isJunkImageUrl(url)) return "";
  return upscaleImageUrl(url);
}
__name(firstImageInHtml, "firstImageInHtml");
function acceptPhoto(raw) {
  const cleaned = cleanImageUrl(raw);
  if (!cleaned || isJunkImageUrl(cleaned)) return "";
  return upscaleImageUrl(cleaned);
}
__name(acceptPhoto, "acceptPhoto");
function pickBestArticleImage(article) {
  if (!article) return "";
  const fromFields = acceptPhoto(article.image_url) || acceptPhoto(article.image) || acceptPhoto(article.thumbnail);
  if (fromFields) return fromFields;
  const fromYoutube = youtubeThumbnailFromUrl(article.url || article.link);
  if (fromYoutube) return fromYoutube;
  const html = [
    article.content,
    article.snippet,
    article.summary,
    article.description
  ].filter(Boolean).join(" ");
  return firstImageInHtml(html);
}
__name(pickBestArticleImage, "pickBestArticleImage");

// workers/services/article-normalizer.js
var TRACKING_PARAMS = /* @__PURE__ */ new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
  "source",
  "mc_cid",
  "mc_eid",
  "_ga",
  "ved",
  "usg"
]);
function canonicalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = "";
    const keysToDelete = [];
    for (const key of parsed.searchParams.keys()) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((k) => parsed.searchParams.delete(k));
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;
    return parsed.toString();
  } catch (e) {
    return rawUrl.trim().split("#")[0];
  }
}
__name(canonicalizeUrl, "canonicalizeUrl");
function decodeHtmlEntities(str) {
  if (!str) return "";
  return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#x2F;/g, "/").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, num) => String.fromCharCode(num));
}
__name(decodeHtmlEntities, "decodeHtmlEntities");
function sanitizeText(str) {
  if (!str) return "";
  return decodeHtmlEntities(str).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
__name(sanitizeText, "sanitizeText");
async function generateArticleHash(link, feedUrl = "", fallbackTitle = "") {
  const canonical = canonicalizeUrl(link);
  if (canonical) {
    return await sha256Hex(canonical);
  }
  const fallbackStr = `${feedUrl}::${fallbackTitle}`;
  return await sha256Hex(fallbackStr);
}
__name(generateArticleHash, "generateArticleHash");
async function normalizeArticle(rawItem, sourceInfo = {}) {
  const canonicalLink = canonicalizeUrl(rawItem.link || rawItem.guid);
  const title = sanitizeText(rawItem.title) || "Untitled Article";
  const summary = sanitizeText(rawItem.summary || rawItem.description || "");
  const id = await generateArticleHash(canonicalLink, sourceInfo.feed_url || "", title);
  const author = sanitizeText(rawItem.author || "");
  let published = (/* @__PURE__ */ new Date()).toISOString();
  if (rawItem.published) {
    const d = new Date(rawItem.published);
    if (!isNaN(d.getTime())) {
      published = d.toISOString();
    }
  }
  const chosenImage = pickBestArticleImage({
    image: rawItem.image,
    image_url: rawItem.image,
    thumbnail: rawItem.thumbnail,
    content: rawItem.content || rawItem.summary || "",
    snippet: summary,
    url: canonicalLink || rawItem.link || "",
    link: canonicalLink || rawItem.link || ""
  }) || "";
  return {
    id,
    title,
    summary,
    description: summary,
    link: canonicalLink || rawItem.link || "",
    url: canonicalLink || rawItem.link || "",
    published,
    pubDate: published,
    publishedAt: published,
    author,
    source: {
      id: sourceInfo.id || "unknown",
      title: sourceInfo.title || "Feed Source",
      website_url: sourceInfo.website_url || "",
      logo_url: sourceInfo.logo_url || ""
    },
    image: chosenImage,
    image_url: chosenImage
  };
}
__name(normalizeArticle, "normalizeArticle");

// workers/services/cache-manager.js
var FEEDOMETER_BOT_UA = "Mozilla/5.0 (compatible; FeedometerBot/1.0; +https://feedometer.pages.dev)";
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
async function fetchWithTimeout(url, headers, timeoutMs = 8e3) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
__name(fetchWithTimeout, "fetchWithTimeout");
function isValidFeedXml(text) {
  if (!text || typeof text !== "string" || text.length < 50) return false;
  const lower = text.toLowerCase();
  return lower.includes("<rss") || lower.includes("<feed") || lower.includes("<channel") || lower.includes("<item") || lower.includes("<entry");
}
__name(isValidFeedXml, "isValidFeedXml");
async function executeAdaptiveUpstreamFetch(rawUrl) {
  let targetUrl = (rawUrl || "").trim();
  let lastStatus = 0;
  let lastError = null;
  try {
    const res1 = await fetchWithTimeout(targetUrl, {
      "User-Agent": FEEDOMETER_BOT_UA,
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    }, 7e3);
    lastStatus = res1.status;
    if (res1.ok && res1.status === 200) {
      const xml = await res1.text();
      if (isValidFeedXml(xml)) {
        return { xml, status: res1.status, tier: 1 };
      }
    }
  } catch (e) {
    lastError = e;
  }
  try {
    let httpsUrl = targetUrl;
    if (httpsUrl.startsWith("http://")) {
      httpsUrl = httpsUrl.replace("http://", "https://");
    }
    let origin = "";
    try {
      origin = new URL(httpsUrl).origin;
    } catch (_) {
    }
    const res2 = await fetchWithTimeout(httpsUrl, {
      "User-Agent": BROWSER_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": origin || httpsUrl,
      "Upgrade-Insecure-Requests": "1"
    }, 8e3);
    lastStatus = res2.status;
    if (res2.ok && res2.status === 200) {
      const xml = await res2.text();
      if (isValidFeedXml(xml)) {
        return { xml, status: res2.status, tier: 2 };
      }
    }
  } catch (e) {
    lastError = e;
  }
  const bridges = [
    "https://api.allorigins.win/raw?url=" + encodeURIComponent(targetUrl),
    "https://corsproxy.io/?" + encodeURIComponent(targetUrl)
  ];
  for (const bridge of bridges) {
    try {
      const res3 = await fetchWithTimeout(bridge, { "User-Agent": BROWSER_UA }, 6e3);
      lastStatus = res3.status;
      if (res3.ok) {
        const xml = await res3.text();
        if (isValidFeedXml(xml)) {
          return { xml, status: res3.status, tier: 3 };
        }
      }
    } catch (_) {
    }
  }
  throw new Error(lastError ? lastError.message : `Upstream returned status ${lastStatus} without valid XML`);
}
__name(executeAdaptiveUpstreamFetch, "executeAdaptiveUpstreamFetch");
async function fetchFeedWithCache(source, env, ctx, ttlSeconds = 900) {
  const cacheKey = `feed:${source.feed_url}`;
  if (env.FEEDS_KV) {
    try {
      const cached = await env.FEEDS_KV.get(cacheKey, "json");
      if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
        return cached;
      }
    } catch (e) {
      console.warn("KV read error:", e.message);
    }
  }
  const startTime = Date.now();
  let httpStatus = 0;
  let isSuccess = false;
  let errorMessage = null;
  try {
    const { xml: xmlText, status: fetchStatus } = await executeAdaptiveUpstreamFetch(source.feed_url);
    httpStatus = fetchStatus;
    const parsed = parseXmlFeed(xmlText);
    const normalizedItems = [];
    for (const rawItem of parsed.items || []) {
      const norm = await normalizeArticle(rawItem, source);
      normalizedItems.push(norm);
    }
    const payload = {
      source: {
        id: source.id,
        title: source.title || parsed.title || "Feed Source",
        feed_url: source.feed_url,
        website_url: source.website_url || parsed.link || "",
        category: source.category || "general",
        logo_url: source.logo_url || ""
      },
      items: normalizedItems,
      fetched_at: Date.now()
    };
    isSuccess = true;
    if (env.FEEDS_KV && ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(
        env.FEEDS_KV.put(cacheKey, JSON.stringify(payload), {
          expirationTtl: ttlSeconds
        }).catch((err) => console.error("KV write error:", err))
      );
    }
    return payload;
  } catch (err) {
    errorMessage = err.message;
    console.error(`Feed fetch failure for [${source.feed_url}]:`, err.message);
    return {
      source: {
        id: source.id,
        title: source.title || "Feed Source",
        feed_url: source.feed_url
      },
      items: [],
      error: err.message,
      fetched_at: Date.now()
    };
  } finally {
    if (env.DB && ctx && typeof ctx.waitUntil === "function" && source.id) {
      const responseMs = Date.now() - startTime;
      const now = Date.now();
      ctx.waitUntil(
        env.DB.prepare(`
          INSERT INTO source_health (
            source_id, last_success_at, last_failure_at, consecutive_failures, last_http_status, response_ms, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_id) DO UPDATE SET
            last_success_at = CASE WHEN ? THEN ? ELSE last_success_at END,
            last_failure_at = CASE WHEN ? THEN last_failure_at ELSE ? END,
            consecutive_failures = CASE WHEN ? THEN 0 ELSE consecutive_failures + 1 END,
            last_http_status = ?,
            response_ms = ?,
            error_message = ?
        `).bind(
          source.id,
          isSuccess ? now : null,
          isSuccess ? null : now,
          isSuccess ? 0 : 1,
          httpStatus,
          responseMs,
          errorMessage,
          // ON CONFLICT parameters:
          isSuccess ? 1 : 0,
          now,
          isSuccess ? 1 : 0,
          now,
          isSuccess ? 1 : 0,
          httpStatus,
          responseMs,
          errorMessage
        ).run().catch((e) => console.warn("Health telemetry D1 write failed:", e.message))
      );
    }
  }
}
__name(fetchFeedWithCache, "fetchFeedWithCache");

// workers/services/feed-fusion.js
async function fuseFeedStreams(sources, env, ctx, options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 100);
  const cursor = options.cursor || null;
  if (!Array.isArray(sources) || sources.length === 0) {
    return {
      status: "success",
      count: 0,
      total_sources: 0,
      next_cursor: null,
      has_more: false,
      items: []
    };
  }
  const fetchPromises = sources.map((src) => fetchFeedWithCache(src, env, ctx));
  const settledResults = await Promise.allSettled(fetchPromises);
  const seenHashes = /* @__PURE__ */ new Set();
  const seenTitleKeys = /* @__PURE__ */ new Set();
  const rawMergedItems = [];
  for (const res of settledResults) {
    if (res.status === "fulfilled" && res.value && Array.isArray(res.value.items)) {
      for (const item of res.value.items) {
        if (item.id && seenHashes.has(item.id)) continue;
        const simplifiedTitle = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
        if (simplifiedTitle && seenTitleKeys.has(simplifiedTitle)) continue;
        if (item.id) seenHashes.add(item.id);
        if (simplifiedTitle) seenTitleKeys.add(simplifiedTitle);
        rawMergedItems.push(item);
      }
    }
  }
  rawMergedItems.sort((a, b) => {
    const timeA = new Date(a.published).getTime() || 0;
    const timeB = new Date(b.published).getTime() || 0;
    return timeB - timeA;
  });
  let startIndex = 0;
  if (cursor) {
    const [cursorEpochStr, cursorHash] = cursor.split("_");
    const cursorEpoch = parseInt(cursorEpochStr, 10);
    const matchIdx = rawMergedItems.findIndex((item) => {
      const itemEpoch = new Date(item.published).getTime() || 0;
      if (cursorEpoch && itemEpoch < cursorEpoch) return true;
      if (cursorHash && item.id === cursorHash) return true;
      return false;
    });
    if (matchIdx !== -1) {
      startIndex = matchIdx;
    }
  }
  const pagedItems = rawMergedItems.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < rawMergedItems.length;
  let nextCursor = null;
  if (hasMore && pagedItems.length > 0) {
    const lastItem = pagedItems[pagedItems.length - 1];
    const lastEpoch = new Date(lastItem.published).getTime() || Date.now();
    nextCursor = `${lastEpoch}_${lastItem.id}`;
  }
  return {
    status: "success",
    count: pagedItems.length,
    total_sources: sources.length,
    next_cursor: nextCursor,
    has_more: hasMore,
    items: pagedItems
  };
}
__name(fuseFeedStreams, "fuseFeedStreams");

// workers/services/channel-catalog.js
var CHANNELS = [
  {
    id: "Tech",
    label: "Technology & AI",
    keywordSource: "tech|ai|artificial intelligence|software|hardware|apple|google|microsoft|nvidia|openai|code|computing|robot|cyber|app|developer|llm|cloud|semiconductor|chip|startup",
    sources: [
      { id: "src_tc", title: "TechCrunch", feed_url: "https://techcrunch.com/feed/", category: "Tech" },
      { id: "src_hn", title: "Hacker News", feed_url: "https://news.ycombinator.com/rss", category: "Tech" },
      { id: "src_ars", title: "Ars Technica", feed_url: "https://feeds.arstechnica.com/arstechnica/index", category: "Tech" }
    ]
  },
  {
    id: "Finance",
    label: "Markets & Finance",
    keywordSource: "market|finance|stock|wall street|inflation|bank|fed|invest|trade|fund|shares|economy|dollar|rate|revenue|profit|earnings|treasury|gdp|asset|business|billion|million",
    sources: [
      { id: "src_yahoo_fin", title: "Yahoo Finance", feed_url: "https://finance.yahoo.com/news/rssindex", category: "Finance" },
      { id: "src_marketwatch", title: "MarketWatch", feed_url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", category: "Finance" },
      { id: "src_cnbc", title: "CNBC", feed_url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", category: "Finance" }
    ]
  },
  {
    id: "World",
    label: "World News",
    keywordSource: "world|global|international|bbc|reuters|war|peace|president|minister|ukraine|russia|israel|gaza|china|un |treaty|country|police|government|attack|mosque|pakistan|philippines",
    sources: [
      { id: "src_bbc", title: "BBC News", feed_url: "http://feeds.bbci.co.uk/news/world/rss.xml", category: "World" },
      { id: "src_npr", title: "NPR", feed_url: "https://feeds.npr.org/1001/rss.xml", category: "World" },
      { id: "src_aljazeera", title: "Al Jazeera", feed_url: "https://www.aljazeera.com/xml/rss/all.xml", category: "World" }
    ]
  },
  {
    id: "Science",
    label: "Science & Space",
    keywordSource: "science|space|nasa|astronomy|physics|biology|climate|earth|moon|mars|planet|dna|quantum|health|study|research|telescope|species|solar|galaxy|medical|disease",
    sources: [
      { id: "src_nasa", title: "NASA", feed_url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", category: "Science" },
      { id: "src_space", title: "Space.com", feed_url: "https://www.space.com/feeds/all", category: "Science" },
      { id: "src_nature", title: "Nature", feed_url: "https://www.nature.com/nature.rss", category: "Science" }
    ]
  },
  {
    id: "Crypto",
    label: "Crypto & Web3",
    keywordSource: "crypto|bitcoin|ethereum|blockchain|btc|eth|token|web3|defi|binance|coin|wallet|nft|solana|mining|ledger|sec",
    sources: [
      { id: "src_coindesk", title: "CoinDesk", feed_url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "Crypto" },
      { id: "src_cointelegraph", title: "Cointelegraph", feed_url: "https://cointelegraph.com/rss", category: "Crypto" },
      { id: "src_decrypt", title: "Decrypt", feed_url: "https://decrypt.co/feed", category: "Crypto" }
    ]
  }
];
var CHANNEL_REGEX = CHANNELS.map((ch) => ({
  id: ch.id,
  regex: new RegExp(ch.keywordSource, "i")
}));
function normalizeChannelId(raw) {
  const value = String(raw || "").trim();
  if (!value || /^all$/i.test(value)) return "all";
  const lower = value.toLowerCase();
  const found = CHANNELS.find((ch) => {
    return ch.id.toLowerCase() === lower || ch.label.toLowerCase() === lower;
  });
  return found ? found.id : "all";
}
__name(normalizeChannelId, "normalizeChannelId");
function getChannelSources(channelId) {
  const id = normalizeChannelId(channelId);
  if (id === "all") {
    return CHANNELS.reduce((list, ch2) => list.concat(ch2.sources), []);
  }
  const ch = CHANNELS.find((c) => c.id === id);
  return ch ? ch.sources.slice() : [];
}
__name(getChannelSources, "getChannelSources");
function tagItemChannels(item) {
  const sourceTitle = item && item.source && item.source.title || item.sourceTitle || item.source_title || "";
  const sourceCat = item && item.source && item.source.category || item.category || "";
  const text = [item && item.title, item && item.summary, item && item.snippet, sourceTitle].filter(Boolean).join(" ");
  const tags = [];
  CHANNEL_REGEX.forEach((ch) => {
    const fromKeywords = text && ch.regex.test(text);
    const fromSource = sourceCat && String(sourceCat).toLowerCase() === ch.id.toLowerCase();
    if (fromKeywords || fromSource) tags.push(ch.id);
  });
  return tags;
}
__name(tagItemChannels, "tagItemChannels");
function applyChannelTags(streamResult) {
  if (!streamResult || !Array.isArray(streamResult.items)) return streamResult;
  streamResult.items = streamResult.items.map((item) => {
    const channel_tags = tagItemChannels(item);
    const category = channel_tags[0] || item.category || item.source && item.source.category || "General";
    return Object.assign({}, item, { channel_tags, category });
  });
  return streamResult;
}
__name(applyChannelTags, "applyChannelTags");
function filterStreamByChannel(streamResult, channelId) {
  const id = normalizeChannelId(channelId);
  if (!streamResult || id === "all") return streamResult;
  const items = (streamResult.items || []).filter((item) => {
    const tags = item.channel_tags || [];
    return tags.indexOf(id) !== -1 || String(item.category || "").toLowerCase() === id.toLowerCase();
  });
  return Object.assign({}, streamResult, {
    items,
    count: items.length,
    channel: id
  });
}
__name(filterStreamByChannel, "filterStreamByChannel");

// workers/modules/streams.js
async function resolveSources(request, env, folderId) {
  const session = await verifySessionToken(request, env);
  if (session && env.DB) {
    if (folderId) {
      const rows = await env.DB.prepare(`
        WITH RECURSIVE SubFolders AS (
          SELECT id FROM folders WHERE id = ? AND user_id = ?
          UNION ALL
          SELECT f.id FROM folders f
          JOIN SubFolders sf ON f.parent_folder_id = sf.id
          WHERE f.user_id = ?
        )
        SELECT DISTINCT s.id, s.title, s.feed_url, s.website_url, s.category, s.logo_url
        FROM sources s
        JOIN user_feed_assignments ufa ON s.id = ufa.feed_id
        JOIN SubFolders sf ON ufa.folder_id = sf.id
        WHERE ufa.user_id = ? AND s.status = 'active'
      `).bind(folderId, session.userId, session.userId, session.userId).all();
      if (rows.results && rows.results.length) return rows.results;
    } else {
      const rows = await env.DB.prepare(`
        SELECT s.id, s.title, s.feed_url, s.website_url, s.category, s.logo_url
        FROM sources s
        JOIN user_feeds uf ON s.id = uf.source_id
        WHERE uf.user_id = ? AND s.status = 'active'
        ORDER BY uf.followed_at DESC
      `).bind(session.userId).all();
      if (rows.results && rows.results.length) return rows.results;
    }
  }
  return getChannelSources("all");
}
__name(resolveSources, "resolveSources");
async function handleStream(request, url, env, ctx) {
  const folderId = url.searchParams.get("folder_id");
  const rawUrls = url.searchParams.get("urls");
  const channel = normalizeChannelId(url.searchParams.get("channel"));
  const limit = url.searchParams.get("limit") || 50;
  const cursor = url.searchParams.get("cursor") || null;
  try {
    let sources = [];
    if (rawUrls) {
      const urlsList = rawUrls.split(",").map((u) => u.trim()).filter(Boolean);
      sources = urlsList.map((feedUrl, idx) => ({
        id: `src_custom_${idx}`,
        title: "Feed Source",
        feed_url: feedUrl
      }));
    } else {
      sources = await resolveSources(request, env, folderId);
      if (!sources.length) sources = getChannelSources("all");
    }
    let streamResult = await fuseFeedStreams(sources, env, ctx, { limit, cursor });
    streamResult = applyChannelTags(streamResult);
    streamResult = filterStreamByChannel(streamResult, channel);
    streamResult.channel = channel;
    return jsonResponse(streamResult);
  } catch (err) {
    console.error("Stream generation failed:", err.message);
    try {
      let streamResult = await fuseFeedStreams(getChannelSources("all"), env, ctx, { limit, cursor });
      streamResult = applyChannelTags(streamResult);
      streamResult = filterStreamByChannel(streamResult, channel);
      return jsonResponse(streamResult);
    } catch (e2) {
      return errorResponse("Failed to generate stream", 500);
    }
  }
}
__name(handleStream, "handleStream");

// workers/modules/subscriptions.js
async function handleListSubscriptions(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const rows = await env.DB.prepare(`
      SELECT 
        uf.id AS subscription_id,
        uf.followed_at,
        s.id AS source_id,
        s.title,
        s.feed_url,
        s.website_url,
        s.category,
        s.logo_url,
        s.is_verified,
        sh.last_http_status,
        sh.response_ms,
        sh.consecutive_failures
      FROM user_feeds uf
      JOIN sources s ON uf.source_id = s.id
      LEFT JOIN source_health sh ON s.id = sh.source_id
      WHERE uf.user_id = ?
      ORDER BY uf.followed_at DESC
    `).bind(session.userId).all();
    return jsonResponse({
      status: "success",
      subscriptions: rows.results || []
    });
  } catch (err) {
    console.error("List subscriptions error:", err.message);
    return errorResponse("Failed to list subscriptions", 500);
  }
}
__name(handleListSubscriptions, "handleListSubscriptions");
async function handleCreateSubscription(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const body = await request.json();
    const feedUrl = (body.feed_url || "").trim();
    const title = (body.title || "RSS Feed").trim();
    const category = (body.category || "general").trim();
    const folderId = body.folder_id || null;
    if (!feedUrl || !feedUrl.startsWith("http")) {
      return errorResponse("A valid HTTP/HTTPS feed URL is required", 400);
    }
    let source = await env.DB.prepare("SELECT id, title, feed_url FROM sources WHERE feed_url = ?").bind(feedUrl).first();
    let sourceId = source ? source.id : null;
    if (!sourceId) {
      sourceId = `src_${generateRandomHex(12)}`;
      try {
        await env.DB.prepare(`
          INSERT INTO sources (id, title, feed_url, category, status)
          VALUES (?, ?, ?, ?, 'active')
        `).bind(sourceId, title, feedUrl, category).run();
      } catch (e) {
        const existing = await env.DB.prepare("SELECT id FROM sources WHERE feed_url = ?").bind(feedUrl).first();
        if (existing) sourceId = existing.id;
      }
      await env.DB.prepare("INSERT OR IGNORE INTO source_health (source_id) VALUES (?)").bind(sourceId).run().catch(() => {
      });
    }
    const subscriptionId = `uf_${generateRandomHex(12)}`;
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_feeds (id, user_id, source_id, followed_at)
      VALUES (?, ?, ?, ?)
    `).bind(subscriptionId, session.userId, sourceId, Date.now()).run();
    if (folderId) {
      const assignmentId = `ufa_${generateRandomHex(12)}`;
      await env.DB.prepare(`
        INSERT OR IGNORE INTO user_feed_assignments (id, user_id, feed_id, folder_id, assigned_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(assignmentId, session.userId, sourceId, folderId, Date.now()).run();
    }
    return jsonResponse({
      status: "success",
      message: "Subscribed to feed successfully",
      subscription: {
        id: subscriptionId,
        source_id: sourceId,
        title,
        feed_url: feedUrl
      }
    }, 201);
  } catch (err) {
    console.error("Create subscription error:", err.message);
    return errorResponse("Failed to create subscription", 500);
  }
}
__name(handleCreateSubscription, "handleCreateSubscription");
async function handleDeleteSubscription(request, subscriptionOrSourceId, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    let sub = await env.DB.prepare("SELECT id, source_id FROM user_feeds WHERE (id = ? OR source_id = ?) AND user_id = ?").bind(subscriptionOrSourceId, subscriptionOrSourceId, session.userId).first();
    if (!sub) {
      return errorResponse("Subscription not found", 404, "NOT_FOUND");
    }
    await env.DB.prepare("DELETE FROM user_feeds WHERE id = ? AND user_id = ?").bind(sub.id, session.userId).run();
    await env.DB.prepare("DELETE FROM user_feed_assignments WHERE feed_id = ? AND user_id = ?").bind(sub.source_id, session.userId).run();
    return jsonResponse({ status: "success", message: "Unsubscribed successfully" });
  } catch (err) {
    console.error("Delete subscription error:", err.message);
    return errorResponse("Failed to delete subscription", 500);
  }
}
__name(handleDeleteSubscription, "handleDeleteSubscription");

// workers/modules/folders.js
async function handleListFolders(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const foldersResult = await env.DB.prepare(`
      SELECT 
        f.id,
        f.name,
        f.parent_folder_id,
        f.icon,
        f.sort_order,
        COUNT(ufa.id) AS feed_count
      FROM folders f
      LEFT JOIN user_feed_assignments ufa ON f.id = ufa.folder_id AND ufa.user_id = f.user_id
      WHERE f.user_id = ?
      GROUP BY f.id
      ORDER BY f.sort_order ASC, f.created_at ASC
    `).bind(session.userId).all();
    return jsonResponse({
      status: "success",
      folders: foldersResult.results || []
    });
  } catch (err) {
    console.error("List folders error:", err.message);
    return errorResponse("Failed to list folders", 500);
  }
}
__name(handleListFolders, "handleListFolders");
async function handleCreateFolder(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    const icon = (body.icon || "\u{1F4C1}").trim();
    const parentFolderId = body.parent_folder_id || null;
    const sortOrder = typeof body.sort_order === "number" ? body.sort_order : 0;
    if (!name) {
      return errorResponse("Folder name is required", 400);
    }
    if (parentFolderId) {
      const parent = await env.DB.prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?").bind(parentFolderId, session.userId).first();
      if (!parent) {
        return errorResponse("Parent folder does not exist", 400);
      }
    }
    const folderId = `fol_${generateRandomHex(12)}`;
    await env.DB.prepare(`
      INSERT INTO folders (id, user_id, name, parent_folder_id, icon, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(folderId, session.userId, name, parentFolderId, icon, sortOrder, Date.now()).run();
    return jsonResponse({
      status: "success",
      message: "Folder created successfully",
      folder: {
        id: folderId,
        name,
        icon,
        parent_folder_id: parentFolderId,
        sort_order: sortOrder
      }
    }, 201);
  } catch (err) {
    console.error("Create folder error:", err.message);
    return errorResponse("Failed to create folder", 500);
  }
}
__name(handleCreateFolder, "handleCreateFolder");
async function handleDeleteFolder(request, folderId, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const folder = await env.DB.prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?").bind(folderId, session.userId).first();
    if (!folder) {
      return errorResponse("Folder not found", 404, "NOT_FOUND");
    }
    await env.DB.prepare("DELETE FROM folders WHERE id = ? AND user_id = ?").bind(folderId, session.userId).run();
    return jsonResponse({ status: "success", message: "Folder deleted successfully" });
  } catch (err) {
    console.error("Delete folder error:", err.message);
    return errorResponse("Failed to delete folder", 500);
  }
}
__name(handleDeleteFolder, "handleDeleteFolder");
async function handleAssignFeed(request, folderId, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const body = await request.json();
    const feedId = body.feed_id || body.source_id;
    if (!feedId) return errorResponse("Feed/Source ID is required", 400);
    const folder = await env.DB.prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?").bind(folderId, session.userId).first();
    if (!folder) return errorResponse("Folder not found", 404, "NOT_FOUND");
    const assignmentId = `ufa_${generateRandomHex(12)}`;
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_feed_assignments (id, user_id, feed_id, folder_id, assigned_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(assignmentId, session.userId, feedId, folderId, Date.now()).run();
    return jsonResponse({ status: "success", message: "Feed assigned to folder" });
  } catch (err) {
    console.error("Assign feed error:", err.message);
    return errorResponse("Failed to assign feed to folder", 500);
  }
}
__name(handleAssignFeed, "handleAssignFeed");
async function handleUnassignFeed(request, folderId, feedId, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    await env.DB.prepare(`
      DELETE FROM user_feed_assignments 
      WHERE folder_id = ? AND feed_id = ? AND user_id = ?
    `).bind(folderId, feedId, session.userId).run();
    return jsonResponse({ status: "success", message: "Feed unassigned from folder" });
  } catch (err) {
    console.error("Unassign feed error:", err.message);
    return errorResponse("Failed to unassign feed from folder", 500);
  }
}
__name(handleUnassignFeed, "handleUnassignFeed");

// workers/services/metadata-scraper.js
function decodeEntities(str) {
  return String(str || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
__name(decodeEntities, "decodeEntities");
function pickMetaContent(html, property) {
  const re1 = new RegExp(`property=["']` + property + `["'][^>]*content=["']([^"']+)`, "i");
  const re2 = new RegExp(`content=["']([^"']+)["'][^>]*property=["']` + property + `["']`, "i");
  const re3 = new RegExp(`name=["']` + property + `["'][^>]*content=["']([^"']+)`, "i");
  const match = html.match(re1) || html.match(re2) || html.match(re3);
  return match ? decodeEntities(match[1]).trim() : "";
}
__name(pickMetaContent, "pickMetaContent");
async function fetchPageMetadata(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5e3);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FeedOmeter/2.1; +https://feedometer.com)",
        "Accept": "text/html,application/xhtml+xml"
      },
      redirect: "follow",
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 25e4);
    const titleTag = (html.match(/<title[^>]*>([^<]+)/i) || [])[1] || "";
    const title = pickMetaContent(html, "og:title") || decodeEntities(titleTag).replace(/\s+[|\-].*$/, "").trim();
    const image = pickBestArticleImage({
      image: pickMetaContent(html, "og:image") || pickMetaContent(html, "twitter:image"),
      content: html.slice(0, 4e4),
      url
    });
    const snippet = pickMetaContent(html, "og:description") || pickMetaContent(html, "description");
    const siteName = pickMetaContent(html, "og:site_name");
    if (!title && !image) return null;
    return { title, image_url: image, snippet, site_name: siteName };
  } catch (e) {
    return null;
  }
}
__name(fetchPageMetadata, "fetchPageMetadata");

// workers/services/article-repository.js
function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "127.0.0.1";
}
__name(getClientIp, "getClientIp");
function mergeArticlePayload(body) {
  const nested = body && body.article_data && typeof body.article_data === "object" ? body.article_data : {};
  const merged = Object.assign({}, nested);
  const src = body || {};
  Object.keys(src).forEach((key) => {
    if (key === "article_data") return;
    if (src[key] !== void 0 && src[key] !== null && src[key] !== "") {
      merged[key] = src[key];
    }
  });
  const url = decodeEntities((merged.url || merged.link || nested.url || nested.link || "").trim());
  merged.url = url;
  merged.link = url;
  if (nested.source && nested.source.id && !merged.source_id) merged.source_id = nested.source.id;
  if (nested.source && nested.source.title && !merged.source_title) merged.source_title = nested.source.title;
  if (nested.sourceTitle && !merged.source_title) merged.source_title = nested.sourceTitle;
  return merged;
}
__name(mergeArticlePayload, "mergeArticlePayload");
function hostToSourceId(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    return "src_" + host.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48);
  } catch (e) {
    return "";
  }
}
__name(hostToSourceId, "hostToSourceId");
function isCatalogArticleId(id) {
  return typeof id === "string" && id.indexOf("art_") === 0;
}
__name(isCatalogArticleId, "isCatalogArticleId");
async function ensureGeneralSource(env) {
  const id = "src_general";
  try {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO sources (id, title, feed_url, website_url, source_type, category, is_verified, status)
      VALUES (?, 'General Web Feeds', '', '', 'rss', 'general', 0, 'active')
    `).bind(id).run();
  } catch (e) {
  }
  return id;
}
__name(ensureGeneralSource, "ensureGeneralSource");
function hydrateCatalogItem(row) {
  if (!row) return row;
  if (!row.image_url) {
    row.image_url = pickBestArticleImage(row);
  }
  return row;
}
__name(hydrateCatalogItem, "hydrateCatalogItem");
async function hydrateAndPersist(env, row) {
  const item = hydrateCatalogItem(row);
  const needsTitle = !item.title || item.title === "Untitled Article";
  const needsImage = !item.image_url;
  if (!needsTitle && !needsImage) return item;
  const meta = await fetchPageMetadata(item.url);
  if (!meta) return item;
  const title = needsTitle && meta.title ? meta.title : item.title;
  const image = needsImage && meta.image_url ? meta.image_url : item.image_url;
  const snippet = !item.snippet && meta.snippet ? meta.snippet : item.snippet;
  try {
    await env.DB.prepare("UPDATE articles SET title = ?, image_url = ?, snippet = ? WHERE id = ?").bind(title || item.title, image || "", snippet || "", item.id).run();
  } catch (e) {
  }
  item.title = title;
  item.image_url = image;
  item.snippet = snippet;
  if (meta.site_name && item.source_title === "General Web Feeds") {
    item.source_title = meta.site_name;
  }
  return item;
}
__name(hydrateAndPersist, "hydrateAndPersist");
async function resolveSourceId(env, articleData, url) {
  let sourceId = articleData.source_id || articleData.source && articleData.source.id || "";
  if (sourceId) {
    const srcRow = await env.DB.prepare("SELECT id FROM sources WHERE id = ?").bind(sourceId).first();
    if (srcRow) return srcRow.id;
    sourceId = "";
  }
  if (articleData.feed_url) {
    const src = await env.DB.prepare("SELECT id FROM sources WHERE feed_url = ?").bind(articleData.feed_url).first();
    if (src) return src.id;
  }
  const derivedId = hostToSourceId(url);
  const sourceTitle = (articleData.source_title || articleData.sourceTitle || articleData.source && articleData.source.title || "").trim();
  if (derivedId) {
    const byId = await env.DB.prepare("SELECT id FROM sources WHERE id = ?").bind(derivedId).first();
    if (byId) return derivedId;
    try {
      const host = new URL(url).origin;
      await env.DB.prepare(`
        INSERT OR IGNORE INTO sources (id, title, feed_url, website_url, source_type, category, is_verified, status)
        VALUES (?, ?, ?, ?, 'rss', 'general', 0, 'active')
      `).bind(derivedId, sourceTitle || derivedId.replace(/^src_/, ""), url, host).run();
      return derivedId;
    } catch (e) {
    }
  }
  return ensureGeneralSource(env);
}
__name(resolveSourceId, "resolveSourceId");
async function ensureArticleInCatalog(env, articleData) {
  if (!articleData) return null;
  const url = decodeEntities((articleData.url || articleData.link || "").trim());
  if (!url) return null;
  const canonicalHash = articleData.canonical_url_hash || await sha256Hex(url.toLowerCase().split("?")[0]);
  let title = String(articleData.title || "").trim();
  let imageUrl = pickBestArticleImage(articleData);
  let snippet = String(articleData.snippet || articleData.summary || articleData.description || "").slice(0, 4e3);
  const content = String(articleData.content || "").slice(0, 2e4);
  if (!title || title === "Untitled Article" || !imageUrl) {
    const meta = await fetchPageMetadata(url);
    if (meta) {
      if (!title || title === "Untitled Article") title = meta.title || title;
      if (!imageUrl) imageUrl = meta.image_url || "";
      if (!snippet) snippet = (meta.snippet || "").slice(0, 4e3);
      if (meta.site_name && !articleData.source_title) articleData.source_title = meta.site_name;
    }
  }
  const existing = await env.DB.prepare("SELECT id, title, image_url, snippet FROM articles WHERE canonical_url_hash = ?").bind(canonicalHash).first();
  if (existing) {
    const nextTitle = (!existing.title || existing.title === "Untitled Article") && title ? title : existing.title;
    const nextImage = !existing.image_url && imageUrl ? imageUrl : existing.image_url;
    const nextSnippet = !existing.snippet && snippet ? snippet : existing.snippet;
    if (nextTitle !== existing.title || nextImage !== existing.image_url || nextSnippet !== existing.snippet) {
      await env.DB.prepare(`
        UPDATE articles SET title = ?, image_url = ?, snippet = ? WHERE id = ?
      `).bind(nextTitle || existing.title, nextImage || "", nextSnippet || "", existing.id).run();
    }
    return existing.id;
  }
  const sourceId = await resolveSourceId(env, articleData, url);
  const articleId = `art_${generateRandomHex(12)}`;
  const now = Date.now();
  let publishedAt = now;
  const rawPub = articleData.published_at || articleData.published || articleData.pubDate;
  if (rawPub) {
    const parsed = new Date(rawPub).getTime();
    if (!Number.isNaN(parsed)) publishedAt = parsed;
  }
  await env.DB.prepare(`
    INSERT INTO articles (id, canonical_url_hash, source_id, title, url, author, snippet, content, image_url, published_at, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(canonical_url_hash) DO UPDATE SET
      title = CASE WHEN articles.title = 'Untitled Article' AND excluded.title != '' THEN excluded.title ELSE articles.title END,
      image_url = CASE WHEN (articles.image_url IS NULL OR articles.image_url = '') THEN excluded.image_url ELSE articles.image_url END,
      snippet = CASE WHEN (articles.snippet IS NULL OR articles.snippet = '') THEN excluded.snippet ELSE articles.snippet END,
      content = CASE WHEN (articles.content IS NULL OR articles.content = '') THEN excluded.content ELSE articles.content END
  `).bind(
    articleId,
    canonicalHash,
    sourceId,
    title || "Untitled Article",
    url,
    articleData.author || articleData.creator || "",
    snippet,
    content,
    imageUrl,
    publishedAt,
    now
  ).run();
  const final = await env.DB.prepare("SELECT id FROM articles WHERE canonical_url_hash = ?").bind(canonicalHash).first();
  return final ? final.id : articleId;
}
__name(ensureArticleInCatalog, "ensureArticleInCatalog");
async function resolveCatalogArticleId(env, body) {
  const payload = mergeArticlePayload(body);
  if (payload.url) {
    const catalogId = await ensureArticleInCatalog(env, payload);
    if (catalogId) return catalogId;
  }
  if (isCatalogArticleId(payload.article_id)) {
    const row = await env.DB.prepare("SELECT id FROM articles WHERE id = ?").bind(payload.article_id).first();
    if (row) return row.id;
  }
  return null;
}
__name(resolveCatalogArticleId, "resolveCatalogArticleId");
async function recordArticleEvent(env, userId, sourceId, articleId, eventType, request) {
  if (!env.DB || !articleId) return;
  try {
    const eventId = `evt_${generateRandomHex(12)}`;
    const ip = request ? getClientIp(request) : "127.0.0.1";
    await env.DB.prepare(`
      INSERT INTO article_events (id, user_id, source_id, article_id, event_type, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(eventId, userId || null, sourceId || null, articleId, eventType, ip, Date.now()).run();
  } catch (e) {
    console.error("Failed to log article event:", e.message);
  }
}
__name(recordArticleEvent, "recordArticleEvent");

// workers/modules/articles.js
async function handleStarArticle(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const body = await request.json();
    const articleId = await resolveCatalogArticleId(env, body);
    if (!articleId) return errorResponse("Valid article URL is required to star", 400);
    const starId = `star_${generateRandomHex(12)}`;
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO starred_articles (id, user_id, article_id, starred_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, article_id) DO NOTHING
    `).bind(starId, session.userId, articleId, now).run();
    await recordArticleEvent(env, session.userId, body.source_id, articleId, "STAR", request);
    return jsonResponse({ status: "success", message: "Article starred", article_id: articleId });
  } catch (err) {
    console.error("Star article error:", err.message);
    return errorResponse("Failed to star article: " + err.message, 500);
  }
}
__name(handleStarArticle, "handleStarArticle");
async function handleUnstarArticle(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const body = await request.json();
    const articleId = await resolveCatalogArticleId(env, body);
    if (!articleId) return errorResponse("Article identifier required", 400);
    await env.DB.prepare("DELETE FROM starred_articles WHERE user_id = ? AND article_id = ?").bind(session.userId, articleId).run();
    return jsonResponse({ status: "success", message: "Article unstarred" });
  } catch (err) {
    console.error("Unstar article error:", err.message);
    return errorResponse("Failed to unstar article", 500);
  }
}
__name(handleUnstarArticle, "handleUnstarArticle");
async function handleSaveArticle(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const body = await request.json();
    const articleId = await resolveCatalogArticleId(env, body);
    if (!articleId) return errorResponse("Valid article URL is required to save", 400);
    const saveId = `sav_${generateRandomHex(12)}`;
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO saved_articles (id, user_id, article_id, saved_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, article_id) DO NOTHING
    `).bind(saveId, session.userId, articleId, now).run();
    await recordArticleEvent(env, session.userId, body.source_id, articleId, "SAVE", request);
    return jsonResponse({ status: "success", message: "Article saved for later", article_id: articleId });
  } catch (err) {
    console.error("Save article error:", err.message);
    return errorResponse("Failed to save article: " + err.message, 500);
  }
}
__name(handleSaveArticle, "handleSaveArticle");
async function handleUnsaveArticle(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const body = await request.json();
    const articleId = await resolveCatalogArticleId(env, body);
    if (!articleId) return errorResponse("Article identifier required", 400);
    await env.DB.prepare("DELETE FROM saved_articles WHERE user_id = ? AND article_id = ?").bind(session.userId, articleId).run();
    return jsonResponse({ status: "success", message: "Article removed from saved" });
  } catch (err) {
    console.error("Unsave article error:", err.message);
    return errorResponse("Failed to unsave article", 500);
  }
}
__name(handleUnsaveArticle, "handleUnsaveArticle");
async function handleReadArticle(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const body = await request.json();
    const articleId = await resolveCatalogArticleId(env, body);
    if (!articleId) return errorResponse("Valid article URL is required", 400);
    const readId = `read_${generateRandomHex(12)}`;
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO read_history (id, user_id, article_id, read_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, article_id) DO UPDATE SET read_at = excluded.read_at
    `).bind(readId, session.userId, articleId, now).run();
    await recordArticleEvent(env, session.userId, body.source_id, articleId, "READ_COMPLETE", request);
    return jsonResponse({ status: "success", message: "Article marked as read" });
  } catch (err) {
    console.error("Read article error:", err.message);
    return errorResponse("Failed to mark article as read", 500);
  }
}
__name(handleReadArticle, "handleReadArticle");
async function handleListStarred(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const rows = await env.DB.prepare(`
      SELECT a.id, a.canonical_url_hash, a.title, a.url, a.author, a.snippet, a.content,
             a.image_url, a.published_at, s.title as source_title, s.logo_url as source_logo,
             sa.starred_at, 1 as is_starred
      FROM starred_articles sa
      JOIN articles a ON sa.article_id = a.id
      LEFT JOIN sources s ON a.source_id = s.id
      WHERE sa.user_id = ?
      ORDER BY sa.starred_at DESC
      LIMIT 100
    `).bind(session.userId).all();
    const items = await Promise.all((rows.results || []).map((row) => hydrateAndPersist(env, row)));
    return jsonResponse({ status: "success", count: items.length, items });
  } catch (err) {
    console.error("List starred error:", err.message);
    return errorResponse("Failed to list starred articles", 500);
  }
}
__name(handleListStarred, "handleListStarred");
async function handleListSaved(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const rows = await env.DB.prepare(`
      SELECT a.id, a.canonical_url_hash, a.title, a.url, a.author, a.snippet, a.content,
             a.image_url, a.published_at, s.title as source_title, s.logo_url as source_logo,
             sva.saved_at, 1 as is_saved
      FROM saved_articles sva
      JOIN articles a ON sva.article_id = a.id
      LEFT JOIN sources s ON a.source_id = s.id
      WHERE sva.user_id = ?
      ORDER BY sva.saved_at DESC
      LIMIT 100
    `).bind(session.userId).all();
    const items = await Promise.all((rows.results || []).map((row) => hydrateAndPersist(env, row)));
    return jsonResponse({ status: "success", count: items.length, items });
  } catch (err) {
    console.error("List saved error:", err.message);
    return errorResponse("Failed to list saved articles", 500);
  }
}
__name(handleListSaved, "handleListSaved");

// workers/services/search-indexer.js
function buildFtsQuery(rawQuery) {
  if (!rawQuery || typeof rawQuery !== "string") return "";
  const trimmed = rawQuery.trim();
  if (!trimmed) return "";
  const phrases = [];
  let sanitized = trimmed.replace(/"([^"]+)"/g, (match, phrase) => {
    const cleanPhrase = phrase.trim().replace(/[^a-zA-Z0-9\s]/g, " ");
    if (cleanPhrase) {
      phrases.push(`"${cleanPhrase}"`);
      return ` __PHRASE_${phrases.length - 1}__ `;
    }
    return "";
  });
  sanitized = sanitized.replace(/\s+NOT\s+/gi, " NOT ");
  sanitized = sanitized.replace(/\s+OR\s+/gi, " OR ");
  sanitized = sanitized.replace(/\s+AND\s+/gi, " AND ");
  sanitized = sanitized.replace(/(?:^|\s)-([a-zA-Z0-9_]+)/g, " NOT $1");
  const tokens = sanitized.split(/\s+/).filter(Boolean);
  const clauses = [];
  let pendingNot = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "OR") {
      if (clauses.length > 0 && clauses[clauses.length - 1] !== "OR") {
        clauses.push("OR");
      }
      continue;
    }
    if (token === "NOT") {
      pendingNot = true;
      continue;
    }
    if (token === "AND") {
      continue;
    }
    const phraseMatch = token.match(/__PHRASE_(\d+)__/);
    let term = phraseMatch ? phrases[parseInt(phraseMatch[1], 10)] : token.replace(/[^a-zA-Z0-9_*]/g, "");
    if (!term) continue;
    if (pendingNot) {
      clauses.push(`NOT ${term}`);
      pendingNot = false;
    } else {
      clauses.push(term);
    }
  }
  if (clauses.length === 0) return "";
  const resultParts = [];
  for (let i = 0; i < clauses.length; i++) {
    const curr = clauses[i];
    if (curr === "OR") {
      resultParts.push("OR");
    } else {
      if (resultParts.length > 0 && resultParts[resultParts.length - 1] !== "OR" && !curr.startsWith("NOT")) {
        resultParts.push("AND");
      }
      resultParts.push(curr);
    }
  }
  return resultParts.join(" ");
}
__name(buildFtsQuery, "buildFtsQuery");
function calculateRankingScore({ bm25Rank = 0, publishedAt = Date.now(), authorityScore = 50, engagementScore = 0 }) {
  const rawBm25 = Math.abs(bm25Rank);
  const normBm25 = Math.min(1, rawBm25 / 15);
  const now = Date.now();
  const ageHours = Math.max(0, (now - publishedAt) / (3600 * 1e3));
  let freshness = 0.25;
  if (ageHours <= 6) freshness = 1;
  else if (ageHours <= 24) freshness = 0.85;
  else if (ageHours <= 72) freshness = 0.6;
  else if (ageHours <= 720) freshness = 0.35;
  const normAuthority = Math.min(1, Math.max(0.1, authorityScore / 100));
  const normEngagement = Math.min(1, Math.max(0, engagementScore / 100));
  const finalScore = 0.5 * normBm25 + 0.2 * freshness + 0.15 * normAuthority + 0.15 * normEngagement;
  return Math.round(finalScore * 1e3) / 1e3;
}
__name(calculateRankingScore, "calculateRankingScore");
function generateWhyBadges(article, rawQuery) {
  const badges = [];
  const queryLower = (rawQuery || "").toLowerCase();
  const titleLower = (article.title || "").toLowerCase();
  const snippetLower = (article.snippet || "").toLowerCase();
  const terms = queryLower.split(/\s+/).filter((t) => t.length > 2 && !["and", "or", "not"].includes(t));
  const hasTitleMatch = terms.some((t) => titleLower.includes(t));
  if (hasTitleMatch) {
    badges.push({ label: "Exact match in title", type: "highlight" });
  } else if (terms.some((t) => snippetLower.includes(t))) {
    badges.push({ label: "Matched in snippet", type: "highlight" });
  }
  const auth = article.authority_score || 50;
  if (auth >= 85) {
    badges.push({ label: `Verified Source (${auth})`, type: "verified" });
  }
  const ageHours = (Date.now() - (article.published_at || Date.now())) / (3600 * 1e3);
  if (ageHours <= 6) {
    badges.push({ label: "Breaking News (<6h)", type: "trending" });
  }
  return badges;
}
__name(generateWhyBadges, "generateWhyBadges");

// workers/modules/search.js
async function handleSearch(request, url, env, ctx) {
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  const rawQuery = (url.searchParams.get("q") || "").trim();
  const category = (url.searchParams.get("cat") || "all").trim().toLowerCase();
  const language = (url.searchParams.get("lang") || "all").trim().toLowerCase();
  const timeFilter = (url.searchParams.get("time") || "all").trim().toLowerCase();
  const sortOrder = (url.searchParams.get("sort") || "relevance").trim().toLowerCase();
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const offset = (page - 1) * limit;
  const startTime = Date.now();
  const session = await verifySessionToken(request, env).catch(() => null);
  const userId = session ? session.userId : null;
  try {
    let stories = [];
    let totalCount = 0;
    if (!rawQuery) {
      const rows = await env.DB.prepare(`
        SELECT a.id, a.title, a.author, a.snippet, a.url, a.image_url, a.published_at,
               s.id as source_id, s.title as source_title, s.category,
               COALESCE(p.authority_score, 50) as authority_score, p.domain as publisher_domain
        FROM articles a
        JOIN sources s ON a.source_id = s.id
        LEFT JOIN publishers p ON s.publisher_domain = p.domain
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
      `).bind(limit, offset).all();
      stories = (rows.results || []).map((row) => ({
        id: row.id,
        title: row.title,
        author: row.author,
        snippet: row.snippet,
        url: row.url,
        image_url: row.image_url,
        published_at: row.published_at,
        source: {
          id: row.source_id,
          title: row.source_title,
          category: row.category,
          domain: row.publisher_domain,
          authority: row.authority_score
        },
        ranking_score: 1,
        why_badges: generateWhyBadges(row, "")
      }));
      totalCount = stories.length;
    } else {
      const ftsQuery = buildFtsQuery(rawQuery);
      if (!ftsQuery) {
        return jsonResponse({ status: "success", total: 0, execution_ms: 1, items: [] });
      }
      let filterSql = "";
      const params = [ftsQuery];
      if (category !== "all") {
        filterSql += " AND s.category = ?";
        params.push(category);
      }
      if (language !== "all") {
        filterSql += " AND fs.language = ?";
        params.push(language);
      }
      if (timeFilter === "24h") {
        filterSql += " AND a.published_at >= ?";
        params.push(Date.now() - 24 * 3600 * 1e3);
      } else if (timeFilter === "7d") {
        filterSql += " AND a.published_at >= ?";
        params.push(Date.now() - 7 * 24 * 3600 * 1e3);
      } else if (timeFilter === "30d") {
        filterSql += " AND a.published_at >= ?";
        params.push(Date.now() - 30 * 24 * 3600 * 1e3);
      }
      const candidateLimit = limit * 2;
      params.push(candidateLimit);
      const candidateQuery = `
        SELECT fs.article_id, bm25(article_search, 10.0, 1.0, 5.0, 2.0) as bm25_rank,
               a.id, a.title, a.author, a.snippet, a.url, a.image_url, a.published_at,
               s.id as source_id, s.title as source_title, s.category,
               COALESCE(p.authority_score, 50) as authority_score, p.domain as publisher_domain
        FROM article_search fs
        JOIN articles a ON a.id = fs.article_id
        JOIN sources s ON a.source_id = s.id
        LEFT JOIN publishers p ON s.publisher_domain = p.domain
        WHERE article_search MATCH ?
        ${filterSql}
        LIMIT ?
      `;
      const candidateResults = await env.DB.prepare(candidateQuery).bind(...params).all();
      const rawCandidates = candidateResults.results || [];
      const scoredItems = rawCandidates.map((row) => {
        const score = calculateRankingScore({
          bm25Rank: row.bm25_rank,
          publishedAt: row.published_at,
          authorityScore: row.authority_score,
          engagementScore: 0
        });
        return {
          id: row.id,
          title: row.title,
          author: row.author,
          snippet: row.snippet,
          url: row.url,
          image_url: row.image_url,
          published_at: row.published_at,
          source: {
            id: row.source_id,
            title: row.source_title,
            category: row.category,
            domain: row.publisher_domain,
            authority: row.authority_score
          },
          ranking_score: score,
          bm25_rank: row.bm25_rank,
          why_badges: generateWhyBadges(row, rawQuery)
        };
      });
      if (sortOrder === "latest") {
        scoredItems.sort((a, b) => b.published_at - a.published_at);
      } else if (sortOrder === "authority") {
        scoredItems.sort((a, b) => b.source.authority - a.source.authority);
      } else {
        scoredItems.sort((a, b) => b.ranking_score - a.ranking_score);
      }
      stories = scoredItems.slice(0, limit);
      totalCount = scoredItems.length;
    }
    const executionMs = Date.now() - startTime;
    if (rawQuery && env.DB) {
      const queryId = `sq_${generateRandomHex(12)}`;
      const normalizedQuery = rawQuery.toLowerCase();
      const logPromise = env.DB.prepare(`
        INSERT INTO search_queries (id, user_id, query, normalized_query, result_count, execution_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(queryId, userId, rawQuery, normalizedQuery, totalCount, executionMs, startTime).run().catch(() => {
      });
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(logPromise);
      }
    }
    return jsonResponse({
      status: "success",
      query: rawQuery,
      total: totalCount,
      execution_ms: executionMs,
      items: stories
    });
  } catch (err) {
    console.error("Search execution error:", err.message);
    return errorResponse("Search failed: " + err.message, 500);
  }
}
__name(handleSearch, "handleSearch");
async function handleSuggestions(request, url, env) {
  if (!env.DB) return jsonResponse({ status: "success", suggestions: [] });
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();
  if (!query || query.length < 2) {
    try {
      const top = await env.DB.prepare(`
        SELECT term, search_count, click_count 
        FROM search_suggestions 
        ORDER BY search_count DESC 
        LIMIT 6
      `).all();
      return jsonResponse({ status: "success", suggestions: top.results || [] });
    } catch (e) {
      return jsonResponse({ status: "success", suggestions: [] });
    }
  }
  try {
    const rows = await env.DB.prepare(`
      SELECT term, search_count, click_count 
      FROM search_suggestions 
      WHERE term LIKE ? 
      ORDER BY (search_count * 2 + click_count * 3) DESC 
      LIMIT 6
    `).bind(`${query}%`).all();
    return jsonResponse({
      status: "success",
      suggestions: rows.results || []
    });
  } catch (err) {
    console.error("Suggestions error:", err.message);
    return jsonResponse({ status: "success", suggestions: [] });
  }
}
__name(handleSuggestions, "handleSuggestions");
async function handleSavedSearches(request, url, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  const method = request.method;
  if (method === "GET") {
    try {
      const rows = await env.DB.prepare(`
        SELECT id, name, search_query, filters_json, created_at, last_used_at 
        FROM saved_searches 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).bind(session.userId).all();
      return jsonResponse({ status: "success", saved_searches: rows.results || [] });
    } catch (err) {
      return errorResponse("Failed to list saved searches", 500);
    }
  }
  if (method === "POST") {
    try {
      const body = await request.json();
      const searchQuery = (body.search_query || body.query || "").trim();
      const name = (body.name || searchQuery || "Saved Search").trim();
      const filtersJson = typeof body.filters === "object" ? JSON.stringify(body.filters) : body.filters_json || "{}";
      if (!searchQuery) return errorResponse("Search query is required", 400);
      const id = `ss_${generateRandomHex(12)}`;
      const now = Date.now();
      await env.DB.prepare(`
        INSERT INTO saved_searches (id, user_id, name, search_query, filters_json, created_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(id, session.userId, name, searchQuery, filtersJson, now, now).run();
      return jsonResponse({ status: "success", message: "Search saved", id, name, search_query: searchQuery }, 201);
    } catch (err) {
      return errorResponse("Failed to save search: " + err.message, 500);
    }
  }
  if (method === "DELETE") {
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();
    if (!id) return errorResponse("Saved search ID required", 400);
    try {
      await env.DB.prepare("DELETE FROM saved_searches WHERE id = ? AND user_id = ?").bind(id, session.userId).run();
      return jsonResponse({ status: "success", message: "Saved search removed" });
    } catch (err) {
      return errorResponse("Failed to delete saved search", 500);
    }
  }
  return errorResponse("Method Not Allowed", 405);
}
__name(handleSavedSearches, "handleSavedSearches");
async function handleKeywordAlerts(request, url, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  const method = request.method;
  if (method === "GET") {
    try {
      const rows = await env.DB.prepare(`
        SELECT id, keyword, is_active, notification_channel, last_notified_at, match_count, created_at 
        FROM keyword_alerts 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).bind(session.userId).all();
      return jsonResponse({ status: "success", alerts: rows.results || [] });
    } catch (err) {
      return errorResponse("Failed to list alerts", 500);
    }
  }
  if (method === "POST") {
    try {
      const body = await request.json();
      const keyword = (body.keyword || "").trim();
      const channel = (body.notification_channel || "in_app").trim();
      if (!keyword) return errorResponse("Keyword is required", 400);
      const id = `ka_${generateRandomHex(12)}`;
      const now = Date.now();
      await env.DB.prepare(`
        INSERT INTO keyword_alerts (id, user_id, keyword, is_active, notification_channel, last_notified_at, match_count, created_at)
        VALUES (?, ?, ?, 1, ?, NULL, 0, ?)
      `).bind(id, session.userId, keyword, channel, now).run();
      return jsonResponse({ status: "success", message: "Alert created", id, keyword }, 201);
    } catch (err) {
      return errorResponse("Failed to create alert: " + err.message, 500);
    }
  }
  if (method === "DELETE") {
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();
    if (!id) return errorResponse("Alert ID required", 400);
    try {
      await env.DB.prepare("DELETE FROM keyword_alerts WHERE id = ? AND user_id = ?").bind(id, session.userId).run();
      return jsonResponse({ status: "success", message: "Alert removed" });
    } catch (err) {
      return errorResponse("Failed to delete alert", 500);
    }
  }
  return errorResponse("Method Not Allowed", 405);
}
__name(handleKeywordAlerts, "handleKeywordAlerts");
async function handleRecordClick(request, env) {
  if (!env.DB) return errorResponse("Database connection unavailable", 500);
  try {
    const body = await request.json();
    const articleId = body.article_id;
    const rankPosition = parseInt(body.rank_position || "1", 10);
    const queryId = body.query_id || null;
    const term = (body.term || "").trim();
    if (!articleId) return errorResponse("Article ID required", 400);
    const session = await verifySessionToken(request, env).catch(() => null);
    const userId = session ? session.userId : null;
    const clickId = `clk_${generateRandomHex(12)}`;
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO search_clicks (id, query_id, user_id, article_id, rank_position, clicked_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(clickId, queryId, userId, articleId, rankPosition, now).run();
    if (term) {
      await env.DB.prepare(`
        UPDATE search_suggestions SET click_count = click_count + 1 WHERE term = ?
      `).bind(term).run().catch(() => {
      });
    }
    return jsonResponse({ status: "success", message: "Click recorded" });
  } catch (err) {
    return errorResponse("Failed to record click: " + err.message, 500);
  }
}
__name(handleRecordClick, "handleRecordClick");

// workers/services/feed-discovery-engine.js
var import_boolean_parser = __toESM(require_boolean_parser());
var DISCOVERY_CACHE = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 15 * 60 * 1e3;
function getCachedDiscovery(key) {
  const item = DISCOVERY_CACHE.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL_MS) {
    DISCOVERY_CACHE.delete(key);
    return null;
  }
  return item.data;
}
__name(getCachedDiscovery, "getCachedDiscovery");
function setCachedDiscovery(key, data) {
  if (DISCOVERY_CACHE.size > 300) {
    const firstKey = DISCOVERY_CACHE.keys().next().value;
    DISCOVERY_CACHE.delete(firstKey);
  }
  DISCOVERY_CACHE.set(key, { data, ts: Date.now() });
}
__name(setCachedDiscovery, "setCachedDiscovery");
function calculateDiscoveryScore({
  relevance = 1,
  // 0.0 - 1.0
  publishingFrequency = 1,
  // articles per day (normalized)
  authorityScore = 50,
  // 0 - 100
  feedHealthPct = 100,
  // 0 - 100%
  subscriberCount = 0,
  // integer
  engagementScore = 0
  // 0 - 100
}) {
  const normRelevance = Math.max(0, Math.min(1, relevance));
  const normFreq = Math.max(0.1, Math.min(1, publishingFrequency / 10));
  const normAuth = Math.max(0, Math.min(1, authorityScore / 100));
  const normHealth = Math.max(0, Math.min(1, feedHealthPct / 100));
  const normSubs = Math.max(0, Math.min(1, subscriberCount > 0 ? Math.log10(subscriberCount + 1) / 5 : 0));
  const normEng = Math.max(0, Math.min(1, engagementScore / 100));
  const score = 0.35 * normRelevance + 0.2 * normFreq + 0.15 * normAuth + 0.15 * normHealth + 0.1 * normSubs + 0.05 * normEng;
  return Math.round(score * 1e3) / 1e3;
}
__name(calculateDiscoveryScore, "calculateDiscoveryScore");
function extractDomain(url) {
  if (!url) return "";
  try {
    let u = String(url).trim();
    if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
    const parsed = new URL(u);
    return parsed.hostname.replace(/^www\./i, "");
  } catch (e) {
    return "";
  }
}
__name(extractDomain, "extractDomain");
function isStrictEnglish(str) {
  if (!str) return true;
  const nonEnglishRegex = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0900-\u097f]/;
  return !nonEnglishRegex.test(str);
}
__name(isStrictEnglish, "isStrictEnglish");
function normalizeFeedUrl(url) {
  if (!url) return "";
  let u = String(url).trim().replace(/^feed[:\/]+/i, "");
  if (!/^https?:\/\//i.test(u)) {
    u = "http://" + u;
  }
  try {
    const parsed = new URL(u);
    let clean = parsed.protocol + "//" + parsed.host.toLowerCase() + parsed.pathname.toLowerCase();
    if (parsed.search) clean += parsed.search;
    return clean.replace(/\/+$/, "");
  } catch (e) {
    return u.toLowerCase().replace(/\/+$/, "");
  }
}
__name(normalizeFeedUrl, "normalizeFeedUrl");
var SEMANTIC_TOPIC_GRAPH = {
  "news": {
    neighbors: ["World News", "Headlines", "Geopolitics", "International Affairs", "BBC News", "Reuters", "Associated Press"],
    sources: [
      {
        title: "BBC News World",
        domain: "bbc.com",
        feed_url: "https://feeds.bbci.co.uk/news/world/rss.xml",
        website_url: "https://www.bbc.com/news/world",
        category: "News",
        feed_type: "rss",
        authority: 98,
        frequency: 30,
        health: 100,
        subscribers: 52e4,
        description: "Comprehensive international breaking news, geopolitical analysis, and live global updates."
      },
      {
        title: "The Guardian World News",
        domain: "theguardian.com",
        feed_url: "https://www.theguardian.com/world/rss",
        website_url: "https://www.theguardian.com/world",
        category: "News",
        feed_type: "rss",
        authority: 97,
        frequency: 25,
        health: 100,
        subscribers: 38e4,
        description: "In-depth global investigative reporting, diplomacy coverage, and foreign affairs analysis."
      },
      {
        title: "Sky News World",
        domain: "skynews.com",
        feed_url: "https://feeds.skynews.com/feeds/rss/world.xml",
        website_url: "https://news.sky.com/world",
        category: "News",
        feed_type: "rss",
        authority: 94,
        frequency: 20,
        health: 99.5,
        subscribers: 21e4,
        description: "Fast-paced world news headlines, eyewitness reports, and video journalism."
      }
    ],
    newsletters: [],
    youtube: [],
    topics: ["Global Politics", "Diplomacy", "International Economy", "Foreign Policy", "United Nations"],
    companies: ["BBC", "Reuters", "Associated Press", "The Guardian", "Sky News"],
    authors: ["Chief Foreign Correspondents", "International Editors"],
    sampleArticles: []
  },
  "world news": {
    neighbors: ["Global News", "International Breaking News", "Geopolitics", "Foreign Affairs", "Diplomacy"],
    sources: [
      {
        title: "BBC News World",
        domain: "bbc.com",
        feed_url: "https://feeds.bbci.co.uk/news/world/rss.xml",
        website_url: "https://www.bbc.com/news/world",
        category: "News",
        feed_type: "rss",
        authority: 98,
        frequency: 30,
        health: 100,
        subscribers: 52e4,
        description: "Comprehensive international breaking news, geopolitical analysis, and live global updates."
      },
      {
        title: "The Guardian World News",
        domain: "theguardian.com",
        feed_url: "https://www.theguardian.com/world/rss",
        website_url: "https://www.theguardian.com/world",
        category: "News",
        feed_type: "rss",
        authority: 97,
        frequency: 25,
        health: 100,
        subscribers: 38e4,
        description: "In-depth global investigative reporting, diplomacy coverage, and foreign affairs analysis."
      }
    ],
    newsletters: [],
    youtube: [],
    topics: ["Global Politics", "Diplomacy", "International Economy"],
    companies: ["BBC", "Reuters"],
    authors: ["Foreign Correspondents"],
    sampleArticles: []
  },
  "science": {
    neighbors: ["Space Exploration", "NASA", "Astronomy", "Physics", "Biotech", "Climate Science", "Nature"],
    sources: [
      {
        title: "NASA Breaking News",
        domain: "nasa.gov",
        feed_url: "https://www.nasa.gov/news-release/feed/",
        website_url: "https://www.nasa.gov",
        category: "Science",
        feed_type: "rss",
        authority: 99,
        frequency: 8,
        health: 100,
        subscribers: 45e4,
        description: "Official mission updates, deep space discoveries, Artemis moon landings, and James Webb imagery."
      },
      {
        title: "Nature Latest Research",
        domain: "nature.com",
        feed_url: "https://www.nature.com/nature.rss",
        website_url: "https://www.nature.com",
        category: "Science",
        feed_type: "rss",
        authority: 99,
        frequency: 15,
        health: 100,
        subscribers: 32e4,
        description: "Peer-reviewed breakthrough research across physics, genetics, quantum science, and biology."
      }
    ],
    newsletters: [],
    youtube: [],
    topics: ["Space Exploration", "Quantum Computing", "Genetics", "Astrophysics", "Neuroscience"],
    companies: ["NASA", "ESA", "SpaceX", "CERN", "Nature Publishing"],
    authors: ["Astrophysicists", "Research Scientists"],
    sampleArticles: []
  },
  "entertainment": {
    neighbors: ["Movies", "Streaming", "Music", "Hollywood", "Box Office", "Television", "Gaming"],
    sources: [
      {
        title: "Variety Film & TV",
        domain: "variety.com",
        feed_url: "https://variety.com/feed/",
        website_url: "https://variety.com",
        category: "Entertainment",
        feed_type: "rss",
        authority: 96,
        frequency: 25,
        health: 100,
        subscribers: 28e4,
        description: "Authoritative entertainment business news, film festivals, streaming wars, and awards season."
      },
      {
        title: "Deadline Hollywood",
        domain: "deadline.com",
        feed_url: "https://deadline.com/feed/",
        website_url: "https://deadline.com",
        category: "Entertainment",
        feed_type: "rss",
        authority: 95,
        frequency: 30,
        health: 100,
        subscribers: 24e4,
        description: "Breaking news on Hollywood box office, casting, industry deals, and production greenlights."
      }
    ],
    newsletters: [],
    youtube: [],
    topics: ["Box Office", "Streaming Wars", "Cinema", "Grammys", "Oscars"],
    companies: ["Warner Bros", "Disney", "Netflix", "Sony Pictures", "Universal"],
    authors: ["Film Critics", "Entertainment Columnists"],
    sampleArticles: []
  },
  "cricket": {
    neighbors: ["IPL", "ICC", "Test Match", "ESPNcricinfo", "Cricbuzz", "Wisden", "BCCI"],
    sources: [
      {
        title: "ESPNcricinfo News",
        domain: "espncricinfo.com",
        feed_url: "https://www.espncricinfo.com/rss/content/story/feeds/0.xml",
        website_url: "https://www.espncricinfo.com",
        category: "Sports",
        feed_type: "rss",
        authority: 96,
        frequency: 24,
        health: 99.9,
        subscribers: 142e3,
        description: "Global ball-by-ball cricket journalism, tournament analysis, and breaking international fixtures."
      },
      {
        title: "BBC Sport Cricket",
        domain: "bbc.com",
        feed_url: "https://feeds.bbci.co.uk/sport/cricket/rss.xml",
        website_url: "https://www.bbc.com/sport/cricket",
        category: "Sports",
        feed_type: "rss",
        authority: 98,
        frequency: 14,
        health: 100,
        subscribers: 98e3,
        description: "Authoritative reporting on England, County Championship, Ashes, and World Cup developments."
      },
      {
        title: "Cricbuzz Latest Headlines",
        domain: "cricbuzz.com",
        feed_url: "https://www.cricbuzz.com/rss/news",
        website_url: "https://www.cricbuzz.com",
        category: "Sports",
        feed_type: "rss",
        authority: 92,
        frequency: 18,
        health: 99.5,
        subscribers: 86e3,
        description: "Comprehensive match reports, player interviews, and domestic T20 league coverage."
      },
      {
        title: "The Guardian Cricket",
        domain: "theguardian.com",
        feed_url: "https://www.theguardian.com/sport/cricket/rss",
        website_url: "https://www.theguardian.com/sport/cricket",
        category: "Sports",
        feed_type: "rss",
        authority: 95,
        frequency: 8,
        health: 100,
        subscribers: 45e3,
        description: "In-depth essays, columnists, and live match day coverage from premier sports journalists."
      }
    ],
    newsletters: [
      {
        title: "Wisden Cricket Weekly",
        domain: "wisden.com",
        feed_url: "https://wisden.substack.com/feed",
        website_url: "https://wisden.com",
        category: "Sports",
        feed_type: "substack",
        authority: 94,
        frequency: 2,
        health: 100,
        subscribers: 32e3,
        description: "The historic Bible of cricket bringing thoughtful essays and historical perspectives."
      }
    ],
    youtube: [
      {
        title: "Robelinda2 Cricket Vault",
        domain: "youtube.com",
        feed_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCvX6x_w0F5r0o0zQ1w4m2A",
        website_url: "https://www.youtube.com",
        category: "Sports",
        feed_type: "youtube",
        authority: 88,
        frequency: 4,
        health: 100,
        subscribers: 82e4,
        description: "Iconic cricket highlights, historic spells, and retro international footage archives."
      }
    ],
    topics: ["IPL 2026", "ICC World Test Championship", "T20 World Cup", "BCCI Policy", "Fast Bowling Biomechanics"],
    companies: ["ICC", "BCCI", "Cricket Australia", "ECB", "Wisden Media"],
    authors: ["Gideon Haigh", "Mike Atherton", "Harsha Bhogle", "Osman Samiuddin"],
    sampleArticles: []
  },
  "ai": {
    neighbors: ["AI Agents", "LLMs", "OpenAI", "Anthropic", "LangChain", "MCP", "Machine Learning", "Deep Learning"],
    sources: [
      {
        title: "OpenAI News & Research",
        domain: "openai.com",
        feed_url: "https://openai.com/news/rss.xml",
        website_url: "https://openai.com",
        category: "Technology",
        feed_type: "rss",
        authority: 99,
        frequency: 4,
        health: 100,
        subscribers: 42e4,
        description: "Official announcements, model weights, API capabilities, and agent orchestration frameworks."
      },
      {
        title: "Anthropic Engineering Blog",
        domain: "anthropic.com",
        feed_url: "https://www.anthropic.com/feed.xml",
        website_url: "https://anthropic.com",
        category: "Technology",
        feed_type: "rss",
        authority: 98,
        frequency: 3,
        health: 100,
        subscribers: 28e4,
        description: "Deep technical research on Claude, constitutional AI, tool calling standards, and model safety."
      },
      {
        title: "MIT Technology Review AI",
        domain: "technologyreview.com",
        feed_url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
        website_url: "https://technologyreview.com",
        category: "Technology",
        feed_type: "rss",
        authority: 96,
        frequency: 6,
        health: 100,
        subscribers: 185e3,
        description: "In-depth reporting and analysis on the societal and commercial implications of artificial intelligence."
      },
      {
        title: "Ars Technica AI & Science",
        domain: "arstechnica.com",
        feed_url: "https://feeds.arstechnica.com/arstechnica/index",
        website_url: "https://arstechnica.com",
        category: "Technology",
        feed_type: "rss",
        authority: 95,
        frequency: 12,
        health: 100,
        subscribers: 15e4,
        description: "Original reporting and rigorous analysis of artificial intelligence breakthroughs and computing."
      }
    ],
    newsletters: [
      {
        title: "The Batch by DeepLearning.AI",
        domain: "deeplearning.ai",
        feed_url: "https://www.deeplearning.ai/the-batch/feed/",
        website_url: "https://deeplearning.ai",
        category: "Technology",
        feed_type: "newsletter",
        authority: 96,
        frequency: 1,
        health: 100,
        subscribers: 25e4,
        description: "Andrew Ng and team curate the essential engineering breakthroughs shaping practical AI."
      }
    ],
    youtube: [],
    topics: ["LLMs", "Autonomous Agents", "Neural Networks", "Model Context Protocol", "Robotics"],
    companies: ["OpenAI", "Anthropic", "Google DeepMind", "NVIDIA", "Meta AI"],
    authors: ["Andrew Ng", "Andrej Karpathy", "Demis Hassabis", "Yann LeCun"],
    sampleArticles: []
  },
  "finance": {
    neighbors: ["Markets", "Wall Street", "Economy", "Fintech", "Crypto", "Stocks", "Investing", "Federal Reserve"],
    sources: [
      {
        title: "Wall Street Journal Markets",
        domain: "wsj.com",
        feed_url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
        website_url: "https://www.wsj.com",
        category: "Finance",
        feed_type: "rss",
        authority: 98,
        frequency: 20,
        health: 100,
        subscribers: 31e4,
        description: "Authoritative market commentary, macroeconomic indicators, and corporate earnings analysis."
      },
      {
        title: "Bloomberg Markets News",
        domain: "bloomberg.com",
        feed_url: "https://feeds.bloomberg.com/markets/news.rss",
        website_url: "https://www.bloomberg.com",
        category: "Finance",
        feed_type: "rss",
        authority: 98,
        frequency: 28,
        health: 100,
        subscribers: 35e4,
        description: "Real-time financial intelligence, equities, bonds, currencies, commodities, and derivatives."
      },
      {
        title: "Financial Times Global Economy",
        domain: "ft.com",
        feed_url: "https://www.ft.com/global-economy?format=rss",
        website_url: "https://www.ft.com",
        category: "Finance",
        feed_type: "rss",
        authority: 97,
        frequency: 14,
        health: 100,
        subscribers: 22e4,
        description: "Global economic insight, fiscal policy analysis, and central banking developments."
      },
      {
        title: "CNBC Business & Finance",
        domain: "cnbc.com",
        feed_url: "https://search.cnbc.com/rs/search/view.html?partnerId=2000&keywords=finance&sort=date&output=rss",
        website_url: "https://www.cnbc.com",
        category: "Finance",
        feed_type: "rss",
        authority: 94,
        frequency: 22,
        health: 99.5,
        subscribers: 18e4,
        description: "Fast financial headlines, stock market tickers, corporate mergers, and investing commentary."
      }
    ],
    newsletters: [],
    youtube: [],
    topics: ["Interest Rates", "Venture Capital", "S&P 500", "Inflation", "Treasury Yields"],
    companies: ["Goldman Sachs", "JPMorgan Chase", "BlackRock", "Berkshire Hathaway", "Morgan Stanley"],
    authors: ["Matt Levine", "Howard Marks", "Mohamed El-Erian"],
    sampleArticles: []
  }
};
function expandSemanticNeighbors(keyword) {
  const kLower = (keyword || "").toLowerCase().trim();
  for (const [key, val] of Object.entries(SEMANTIC_TOPIC_GRAPH)) {
    if (kLower === key || kLower.includes(key) || key.includes(kLower)) {
      return val.neighbors;
    }
  }
  return [`${keyword} Trends`, `${keyword} Industry`, `${keyword} Research`, `${keyword} Insights`, `${keyword} Network`];
}
__name(expandSemanticNeighbors, "expandSemanticNeighbors");
async function searchFeedlyDirectory(query, limit = 30) {
  const q = (query || "").trim();
  if (!q) return [];
  const subQueries = [q];
  if (/[&+]|\band\b/i.test(q)) {
    const cleaned = q.replace(/[&+]/g, " ").replace(/\band\b/gi, " ").replace(/\s+/g, " ").trim();
    if (cleaned && cleaned !== q) subQueries.push(cleaned);
    const parts = q.split(/[&+]|\band\b/i).map((p) => p.trim()).filter((p) => p.length >= 2);
    parts.forEach((p) => {
      if (!subQueries.includes(p)) subQueries.push(p);
    });
  }
  async function fetchFeedlySingle(searchStr, n) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const url = `https://cloud.feedly.com/v3/search/feeds?query=${encodeURIComponent(searchStr)}&n=${n}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "FeedOmeter/2.1 (Feed Discovery Bot; +https://feedometer.com)",
          "Accept": "application/json"
        }
      });
      clearTimeout(timeoutId);
      if (!res.ok) return [];
      const data = await res.json();
      const results = data.results || [];
      return results.map((item) => {
        let rawFeedUrl = item.feedId || item.id || "";
        if (rawFeedUrl.startsWith("feed/")) rawFeedUrl = rawFeedUrl.slice(5);
        const domain = extractDomain(item.website || rawFeedUrl);
        const category = item.topics && item.topics.length > 0 ? item.topics[0] : "General";
        const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
        return {
          feed_name: item.title || domain || "Discovered Feed",
          website_url: item.website || (domain ? `https://${domain}` : ""),
          feed_url: rawFeedUrl,
          category: formattedCategory,
          topics: item.topics || [category],
          description: item.description || `Syndication feed for ${domain}`,
          subscribers: item.subscribers || item.subscribersCount || 0,
          velocity: Math.round((item.velocity || 0) * 10) / 10,
          last_updated: item.lastUpdated || item.updated || Date.now(),
          language: item.language || "en",
          country: "Global",
          icon_url: item.iconUrl || item.visualUrl || (domain ? `https://icon.horse/icon/${domain}` : ""),
          source_engine: "directory",
          is_verified: item.subscribers && item.subscribers > 5e3 ? 1 : 0
        };
      }).filter((f) => f.feed_url && (f.feed_url.startsWith("http://") || f.feed_url.startsWith("https://")));
    } catch (err) {
      return [];
    }
  }
  __name(fetchFeedlySingle, "fetchFeedlySingle");
  try {
    const promises = subQueries.slice(0, 3).map((sq) => fetchFeedlySingle(sq, limit));
    const allResultsArrays = await Promise.all(promises);
    const combined = allResultsArrays.flat();
    const seen = /* @__PURE__ */ new Map();
    for (const item of combined) {
      const canon = normalizeFeedUrl(item.feed_url);
      if (canon && !seen.has(canon)) {
        seen.set(canon, item);
      }
    }
    return Array.from(seen.values());
  } catch (err) {
    console.warn("Feedly directory search failed:", err.message);
    return [];
  }
}
__name(searchFeedlyDirectory, "searchFeedlyDirectory");
async function searchD1Catalog(env, query, limit = 30) {
  if (!env || !env.DB || !query || !query.trim()) return [];
  const term = `%${query.trim().toLowerCase()}%`;
  try {
    const rows = await env.DB.prepare(`
      SELECT s.id, s.title as feed_name, s.feed_url, s.website_url, s.category, s.language,
             s.logo_url as icon_url, s.is_verified, s.article_count, s.last_article_at as last_updated,
             COALESCE(p.name, s.title) as publisher_name, COALESCE(p.authority_score, 50) as authority_score,
             p.domain
      FROM sources s
      LEFT JOIN publishers p ON s.publisher_domain = p.domain
      WHERE LOWER(s.title) LIKE ? 
         OR LOWER(s.category) LIKE ? 
         OR LOWER(s.feed_url) LIKE ? 
         OR LOWER(COALESCE(s.website_url, '')) LIKE ?
         OR LOWER(COALESCE(p.name, '')) LIKE ?
      ORDER BY s.is_verified DESC, authority_score DESC
      LIMIT ?
    `).bind(term, term, term, term, term, limit).all();
    return (rows.results || []).map((r) => ({
      feed_name: r.feed_name,
      website_url: r.website_url || (r.domain ? `https://${r.domain}` : ""),
      feed_url: r.feed_url,
      category: r.category ? r.category.charAt(0).toUpperCase() + r.category.slice(1) : "General",
      topics: [r.category || "news"],
      description: `Verified outlet from ${r.publisher_name || r.feed_name}`,
      subscribers: r.authority_score ? r.authority_score * 400 : 3500,
      velocity: 14,
      last_updated: r.last_updated || Date.now(),
      language: r.language || "en",
      country: "Global",
      icon_url: r.icon_url || (r.domain ? `https://icon.horse/icon/${r.domain}` : ""),
      source_engine: "catalog",
      is_verified: r.is_verified || 1
    }));
  } catch (err) {
    console.warn("D1 catalog search error:", err.message);
    return [];
  }
}
__name(searchD1Catalog, "searchD1Catalog");
async function probeUrlForFeeds(input) {
  if (!input) return [];
  const trimmed = input.trim();
  const isUrl = /^https?:\/\//i.test(trimmed) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(trimmed);
  if (!isUrl) return [];
  let targetUrl = trimmed;
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }
  const found = [];
  const domain = extractDomain(targetUrl);
  if (/\.(xml|rss|atom)($|\?)/i.test(targetUrl) || /\/feed\/?$/i.test(targetUrl) || /\/rss\/?$/i.test(targetUrl)) {
    found.push({
      feed_name: `${domain} Direct Stream`,
      website_url: `https://${domain}`,
      feed_url: targetUrl,
      category: "General",
      topics: ["feed", "syndication"],
      description: `Direct RSS/Atom feed for ${domain}`,
      subscribers: 5e3,
      velocity: 10,
      last_updated: Date.now(),
      language: "en",
      country: "Global",
      icon_url: `https://icon.horse/icon/${domain}`,
      source_engine: "probe",
      is_verified: 1
    });
    return found;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "FeedOmeter/2.1 (Feed Discovery Bot; +https://feedometer.com)" }
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const html = await res.text();
      const linkRegex = /<link[^>]+(?:type=["']application\/(?:rss\+xml|atom\+xml|json)["'][^>]+href=["']([^"']+)["']|href=["']([^"']+)["'][^>]+type=["']application\/(?:rss\+xml|atom\+xml|json)["'])[^>]*>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1] || match[2];
        if (href) {
          try {
            const absoluteUrl = new URL(href, targetUrl).href;
            found.push({
              feed_name: `${domain} RSS Feed`,
              website_url: `https://${domain}`,
              feed_url: absoluteUrl,
              category: "General",
              topics: ["web", "feed"],
              description: `Discovered feed link on ${domain}`,
              subscribers: 4200,
              velocity: 8,
              last_updated: Date.now(),
              language: "en",
              country: "Global",
              icon_url: `https://icon.horse/icon/${domain}`,
              source_engine: "probe",
              is_verified: 1
            });
          } catch (e) {
          }
        }
      }
    }
  } catch (e) {
  }
  if (found.length === 0) {
    const commonPaths = ["/feed", "/rss", "/rss.xml", "/atom.xml"];
    for (const p of commonPaths) {
      found.push({
        feed_name: `${domain} (${p})`,
        website_url: `https://${domain}`,
        feed_url: `https://${domain}${p}`,
        category: "General",
        topics: ["web"],
        description: `Standard syndication endpoint on ${domain}`,
        subscribers: 1500,
        velocity: 5,
        last_updated: Date.now(),
        language: "en",
        country: "Global",
        icon_url: `https://icon.horse/icon/${domain}`,
        source_engine: "probe",
        is_verified: 0
      });
    }
  }
  return found;
}
__name(probeUrlForFeeds, "probeUrlForFeeds");
function searchTopicGraphSources(query) {
  const qLower = (query || "").toLowerCase().trim();
  if (!qLower) return [];
  const matched = [];
  for (const [key, val] of Object.entries(SEMANTIC_TOPIC_GRAPH)) {
    if (qLower === key || qLower.includes(key) || key.includes(qLower) || val.neighbors.some((n) => n.toLowerCase().includes(qLower))) {
      for (const s of val.sources || []) {
        matched.push({
          feed_name: s.title,
          website_url: s.website_url || (s.domain ? `https://${s.domain}` : ""),
          feed_url: s.feed_url,
          category: s.category || "General",
          topics: val.neighbors || [],
          description: s.description || "",
          subscribers: s.subscribers || 2e4,
          velocity: s.frequency || 10,
          last_updated: Date.now() - 36e5,
          language: "en",
          country: "Global",
          icon_url: s.domain ? `https://icon.horse/icon/${s.domain}` : "",
          source_engine: "topic_graph",
          is_verified: 1
        });
      }
      for (const n of val.newsletters || []) {
        matched.push({
          feed_name: n.title,
          website_url: n.website_url || (n.domain ? `https://${n.domain}` : ""),
          feed_url: n.feed_url,
          category: n.category || "Newsletter",
          topics: val.neighbors || [],
          description: n.description || "",
          subscribers: n.subscribers || 1e4,
          velocity: n.frequency || 2,
          last_updated: Date.now() - 72e5,
          language: "en",
          country: "Global",
          icon_url: n.domain ? `https://icon.horse/icon/${n.domain}` : "",
          source_engine: "newsletter",
          is_verified: 1
        });
      }
    }
  }
  return matched;
}
__name(searchTopicGraphSources, "searchTopicGraphSources");
async function findFeedsUnified({
  query = "",
  category = "all",
  language = "all",
  country = "all",
  sort = "relevance",
  limit = 50,
  env = null
} = {}) {
  const startTime = Date.now();
  const rawQ = (query || "").trim();
  const cacheKey = `find:${rawQ.toLowerCase()}:${category}:${language}:${country}:${sort}:${limit}`;
  const cached = getCachedDiscovery(cacheKey);
  if (cached) {
    return Object.assign({}, cached, {
      cached: true,
      execution_ms: Date.now() - startTime
    });
  }
  const [feedlyResults, d1Results, topicResults, probeResults] = await Promise.all([
    searchFeedlyDirectory(rawQ, 35).catch(() => []),
    searchD1Catalog(env, rawQ, 30).catch(() => []),
    Promise.resolve(searchTopicGraphSources(rawQ)),
    probeUrlForFeeds(rawQ).catch(() => [])
  ]);
  const allCandidates = [
    ...topicResults,
    ...d1Results,
    ...feedlyResults,
    ...probeResults
  ];
  const seenMap = /* @__PURE__ */ new Map();
  for (const item of allCandidates) {
    if (!item.feed_url) continue;
    const canonicalKey = normalizeFeedUrl(item.feed_url);
    if (!canonicalKey) continue;
    if (!seenMap.has(canonicalKey)) {
      seenMap.set(canonicalKey, item);
    } else {
      const existing = seenMap.get(canonicalKey);
      if ((item.subscribers || 0) > (existing.subscribers || 0)) {
        existing.subscribers = item.subscribers;
      }
      if ((item.velocity || 0) > (existing.velocity || 0)) {
        existing.velocity = item.velocity;
      }
      if (item.description && item.description.length > (existing.description || "").length) {
        existing.description = item.description;
      }
      if (item.icon_url && !existing.icon_url) {
        existing.icon_url = item.icon_url;
      }
      if (item.is_verified) {
        existing.is_verified = 1;
      }
    }
  }
  let aggregated = Array.from(seenMap.values());
  aggregated = aggregated.filter((f) => {
    if (f.language && f.language !== "en" && f.language !== "eng") return false;
    if (!isStrictEnglish(f.feed_name) || !isStrictEnglish(f.description)) return false;
    return true;
  });
  const meaningfulTerms = rawQ.toLowerCase().replace(/[&+]/g, " ").replace(/\band\b|\bor\b|\bnot\b/gi, " ").split(/\s+/).filter((t) => t.length >= 2);
  aggregated = aggregated.filter((f) => {
    const corpus = `${f.feed_name} ${f.description} ${f.category} ${(f.topics || []).join(" ")} ${f.website_url} ${f.feed_url}`.toLowerCase();
    if (import_boolean_parser.default && typeof import_boolean_parser.default.matches === "function") {
      const matchesBool = import_boolean_parser.default.matches(rawQ, corpus);
      if (!matchesBool) return false;
    }
    if (meaningfulTerms.length > 0) {
      const hasTerm = meaningfulTerms.some((term) => corpus.includes(term));
      if (!hasTerm) return false;
    }
    return true;
  });
  aggregated = aggregated.map((f) => {
    const corpus = `${f.feed_name} ${f.description} ${f.category} ${(f.topics || []).join(" ")} ${f.website_url} ${f.feed_url}`.toLowerCase();
    let termMatchCount = 0;
    for (const term of meaningfulTerms) {
      if (corpus.includes(term)) termMatchCount++;
    }
    const baseRelevance = meaningfulTerms.length > 0 ? termMatchCount / meaningfulTerms.length : 0.8;
    const titleMatchBonus = meaningfulTerms.some((term) => (f.feed_name || "").toLowerCase().includes(term)) ? 0.2 : 0;
    const finalRelevance = Math.min(1, baseRelevance + titleMatchBonus);
    const score = calculateDiscoveryScore({
      relevance: finalRelevance,
      publishingFrequency: (f.velocity || 7) / 7,
      authorityScore: f.is_verified ? 90 : 60,
      feedHealthPct: 100,
      subscriberCount: f.subscribers || 0,
      engagementScore: 75
    });
    return Object.assign({}, f, {
      discovery_score: score,
      relevance_pct: Math.round(finalRelevance * 100)
    });
  });
  if (category && category !== "all") {
    const catLower = category.toLowerCase();
    aggregated = aggregated.filter((f) => {
      const fCat = (f.category || "").toLowerCase();
      const fTopics = (f.topics || []).map((t) => String(t).toLowerCase());
      return fCat.includes(catLower) || fTopics.some((t) => t.includes(catLower));
    });
  }
  if (sort === "popularity") {
    aggregated.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));
  } else if (sort === "freshness") {
    aggregated.sort((a, b) => (b.last_updated || 0) - (a.last_updated || 0));
  } else if (sort === "activity" || sort === "frequency") {
    aggregated.sort((a, b) => (b.velocity || 0) - (a.velocity || 0));
  } else {
    aggregated.sort((a, b) => b.discovery_score - a.discovery_score);
  }
  const finalFeeds = aggregated.slice(0, limit);
  const responseData = {
    status: "success",
    query: rawQ,
    total: aggregated.length,
    execution_ms: Date.now() - startTime,
    cached: false,
    filters: {
      category,
      language,
      country,
      sort
    },
    semantic_neighbors: expandSemanticNeighbors(rawQ),
    feeds: finalFeeds
  };
  setCachedDiscovery(cacheKey, responseData);
  return responseData;
}
__name(findFeedsUnified, "findFeedsUnified");
async function discoverFeedsAndArticles(query, options = {}) {
  const q = (query || "").trim();
  const qLower = q.toLowerCase();
  const res = await findFeedsUnified({ query: q, limit: 20 });
  let matchedTopic = null;
  for (const [key, val] of Object.entries(SEMANTIC_TOPIC_GRAPH)) {
    if (qLower === key || qLower.includes(key) || key.includes(qLower) || (val.neighbors || []).some((n) => n.toLowerCase().includes(qLower))) {
      matchedTopic = val;
      break;
    }
  }
  const suggestedSources = (res.feeds || []).map((f) => ({
    ...f,
    domain: extractDomain(f.website_url || f.feed_url)
  }));
  const topicNewsletters = matchedTopic && matchedTopic.newsletters ? matchedTopic.newsletters.map((n) => ({
    ...n,
    feed_name: n.title,
    feed_url: n.feed_url,
    domain: n.domain || extractDomain(n.feed_url)
  })) : [];
  const newsletters = topicNewsletters.length > 0 ? topicNewsletters : suggestedSources.filter((f) => f.category === "Newsletter" || f.source_engine === "newsletter");
  const sampleArticles = matchedTopic && matchedTopic.sampleArticles && matchedTopic.sampleArticles.length > 0 ? matchedTopic.sampleArticles : [
    {
      id: `dyn_art_${Date.now()}`,
      title: `Global Trends and Industry Developments in ${q.charAt(0).toUpperCase() + q.slice(1)}`,
      snippet: `Comprehensive coverage of international fixtures, policy updates, and executive briefing on ${q}.`,
      author: "Editorial Desk",
      published_at: Date.now() - 36e5,
      source: { id: "src_default", title: `${q} Intelligence`, domain: `${q}.org`, authority: 90 },
      category: "General"
    }
  ];
  return {
    query: q,
    execution_ms: res.execution_ms,
    total_sources_found: suggestedSources.length + newsletters.length,
    suggested_sources: suggestedSources,
    suggested_newsletters: newsletters,
    suggested_youtube: suggestedSources.filter((f) => f.category === "YouTube" || f.source_engine === "youtube"),
    related_topics: res.semantic_neighbors,
    related_companies: matchedTopic ? matchedTopic.companies || [] : [`${q} Global`, `${q} Hub`],
    related_authors: matchedTopic ? matchedTopic.authors || [] : ["Verified Journalists", "Topic Curators"],
    articles: sampleArticles
  };
}
__name(discoverFeedsAndArticles, "discoverFeedsAndArticles");

// workers/feedometer-worker.js
var feedometer_worker_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleOptions();
    }
    const url = new URL(request.url);
    const pathname = url.pathname;
    try {
      if (pathname === "/api/auth/register" && request.method === "POST") {
        return await handleRegister(request, env);
      }
      if (pathname === "/api/auth/login" && request.method === "POST") {
        return await handleLogin(request, env);
      }
      if (pathname === "/api/auth/forgot-password" && request.method === "POST") {
        return await handleForgotPassword(request, env);
      }
      if (pathname === "/api/auth/reset-password" && request.method === "GET") {
        return await handleVerifyResetToken(request, env);
      }
      if (pathname === "/api/auth/reset-password" && request.method === "POST") {
        return await handleResetPassword(request, env);
      }
      if (pathname === "/api/auth/google" && request.method === "POST") {
        return await handleGoogleAuth(request, env);
      }
      if (pathname === "/api/auth/logout" && request.method === "POST") {
        return await handleLogout(request, env);
      }
      if (pathname === "/api/auth/me" && request.method === "GET") {
        return await handleMe(request, env);
      }
      if (pathname === "/api/auth/profile" && (request.method === "POST" || request.method === "PUT")) {
        return await handleProfileUpdate(request, env);
      }
      if ((pathname === "/api/auth/password" || pathname === "/api/auth/change-password") && request.method === "POST") {
        return await handlePasswordChange(request, env);
      }
      if (pathname === "/api/auth/sessions" && request.method === "GET") {
        return await handleListSessions(request, env);
      }
      if ((pathname === "/api/auth/sessions/other" || pathname === "/api/auth/sessions/revoke-others") && (request.method === "DELETE" || request.method === "POST")) {
        return await handleRevokeOtherSessions(request, env);
      }
      if (pathname.startsWith("/api/auth/sessions/") && request.method === "DELETE") {
        const sessId = pathname.replace("/api/auth/sessions/", "");
        return await handleRevokeSession(request, sessId, env);
      }
      if (pathname === "/api/auth/sessions/revoke" && request.method === "POST") {
        try {
          const body = await request.json();
          return await handleRevokeSession(request, body.session_id, env);
        } catch (e) {
          return errorResponse("Invalid JSON body", 400);
        }
      }
      if (pathname === "/api/auth/preferences" && request.method === "GET") {
        return await handleGetPreferences(request, env);
      }
      if (pathname === "/api/auth/preferences" && (request.method === "POST" || request.method === "PUT")) {
        return await handleUpdatePreferences(request, env);
      }
      if ((pathname === "/api/auth/account" || pathname === "/api/auth/delete") && request.method === "DELETE") {
        return await handleDeleteAccount(request, env);
      }
      if (pathname === "/api/auth/delete" && request.method === "POST") {
        return await handleDeleteAccount(request, env);
      }
      if (pathname === "/api/subscriptions" && request.method === "GET") {
        return await handleListSubscriptions(request, env);
      }
      if (pathname === "/api/subscriptions" && request.method === "POST") {
        return await handleCreateSubscription(request, env);
      }
      if (pathname.startsWith("/api/subscriptions/") && request.method === "DELETE") {
        const id = pathname.replace("/api/subscriptions/", "");
        return await handleDeleteSubscription(request, id, env);
      }
      if (pathname === "/api/folders" && request.method === "GET") {
        return await handleListFolders(request, env);
      }
      if (pathname === "/api/folders" && request.method === "POST") {
        return await handleCreateFolder(request, env);
      }
      if (pathname.startsWith("/api/folders/") && pathname.endsWith("/feeds") && request.method === "POST") {
        const folderId = pathname.replace("/api/folders/", "").replace("/feeds", "");
        return await handleAssignFeed(request, folderId, env);
      }
      if (pathname.startsWith("/api/folders/") && request.method === "DELETE") {
        const parts = pathname.replace("/api/folders/", "").split("/");
        if (parts.length === 3 && parts[1] === "feeds") {
          return await handleUnassignFeed(request, parts[0], parts[2], env);
        }
        return await handleDeleteFolder(request, parts[0], env);
      }
      if (pathname === "/api/articles/star" && request.method === "POST") {
        return await handleStarArticle(request, env);
      }
      if (pathname === "/api/articles/unstar" && request.method === "POST") {
        return await handleUnstarArticle(request, env);
      }
      if (pathname === "/api/articles/save" && request.method === "POST") {
        return await handleSaveArticle(request, env);
      }
      if (pathname === "/api/articles/unsave" && request.method === "POST") {
        return await handleUnsaveArticle(request, env);
      }
      if (pathname === "/api/articles/read" && request.method === "POST") {
        return await handleReadArticle(request, env);
      }
      if (pathname === "/api/articles/starred" && request.method === "GET") {
        return await handleListStarred(request, env);
      }
      if (pathname === "/api/articles/saved" && request.method === "GET") {
        return await handleListSaved(request, env);
      }
      if ((pathname === "/api/feeds/find" || pathname === "/api/search/feeds") && request.method === "GET") {
        const q = url.searchParams.get("q") || "";
        const category = url.searchParams.get("cat") || url.searchParams.get("category") || "all";
        const language = url.searchParams.get("lang") || url.searchParams.get("language") || "all";
        const country = url.searchParams.get("country") || "all";
        const sort = url.searchParams.get("sort") || "relevance";
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
        const result = await findFeedsUnified({ query: q, category, language, country, sort, limit, env });
        return jsonResponse(result);
      }
      if (pathname === "/api/search" && request.method === "GET") {
        return await handleSearch(request, url, env);
      }
      if (pathname === "/api/search/discover" && request.method === "GET") {
        const q = url.searchParams.get("q") || "";
        const result = await discoverFeedsAndArticles(q);
        return jsonResponse(result);
      }
      if (pathname === "/api/search/suggest" && request.method === "GET") {
        return await handleSuggestions(request, url, env);
      }
      if (pathname.startsWith("/api/search/saved")) {
        return await handleSavedSearches(request, url, env);
      }
      if (pathname.startsWith("/api/search/alerts")) {
        return await handleKeywordAlerts(request, url, env);
      }
      if (pathname === "/api/search/click" && request.method === "POST") {
        return await handleRecordClick(request, env);
      }
      if (pathname === "/api/stream" && request.method === "GET") {
        return await handleStream(request, url, env, ctx);
      }
      if (pathname === "/api/view" && request.method === "GET") {
        const targetUrl = url.searchParams.get("url");
        if (!targetUrl) return errorResponse("Missing url parameter");
        return await handleStream(request, new URL(url.origin + "/api/stream?urls=" + encodeURIComponent(targetUrl)), env, ctx);
      }
      if (pathname === "/api/catalog" || pathname === "/api/publishers") {
        if (env.DB) {
          try {
            const rows = await env.DB.prepare("SELECT * FROM sources WHERE is_verified = 1 ORDER BY title ASC").all();
            if (rows.results && rows.results.length > 0) {
              return jsonResponse({ status: "success", publishers: rows.results });
            }
          } catch (e) {
            console.warn("D1 sources read error:", e.message);
          }
        }
        return jsonResponse({ status: "success", publishers: [] });
      }
      if (pathname === "/api/waitlist" && request.method === "POST") {
        try {
          const body = await request.json();
          const email = (body.email || "").trim().toLowerCase();
          if (!email || !email.includes("@")) return errorResponse("Invalid email address");
          if (env.DB) {
            await env.DB.prepare("INSERT OR IGNORE INTO notify_signups (email, joined_at, synced_at) VALUES (?, ?, ?)").bind(email, (/* @__PURE__ */ new Date()).toISOString(), (/* @__PURE__ */ new Date()).toISOString()).run();
          }
          return jsonResponse({ status: "success", message: "Subscribed to launch updates" });
        } catch (e) {
          return errorResponse("Failed to record signup");
        }
      }
      if (pathname === "/" || pathname === "/api/health") {
        return jsonResponse({
          status: "online",
          service: "feedometer-api",
          version: "2.1.0",
          engine: "7-Domain Enterprise Identity & Stream-First Content Engine",
          timestamp: Date.now()
        });
      }
      return errorResponse("Not Found", 404, "NOT_FOUND");
    } catch (err) {
      console.error("Unhandled Worker error:", err.stack || err.message);
      return errorResponse("Internal Server Error", 500, "INTERNAL_SERVER_ERROR");
    }
  },
  // Automated Cron Triggers
  async scheduled(event, env, ctx) {
    console.log("\u23F0 Scheduled cron triggered at:", (/* @__PURE__ */ new Date()).toISOString());
    if (env.DB && env.FEEDS_KV) {
      try {
        const hotFeeds = await env.DB.prepare("SELECT * FROM sources WHERE is_verified = 1 LIMIT 20").all();
        if (hotFeeds.results) {
          for (const src of hotFeeds.results) {
            ctx.waitUntil(
              fetch(src.feed_url).then((r) => r.text()).then((xml) => {
                console.log("Pre-warmed: " + src.title);
              }).catch(() => {
              })
            );
          }
        }
      } catch (e) {
        console.warn("Cron pre-warming error:", e.message);
      }
    }
  }
};
export {
  feedometer_worker_default as default
};
//# sourceMappingURL=feedometer-worker.js.map
