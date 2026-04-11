// ═══════════════════════════════════════════
// BouAI AUTH — Supabase
// Handles Google OAuth + Email/Password
// ═══════════════════════════════════════════

// Load Supabase from CDN — keys injected at runtime from meta tags
const SUPABASE_URL  = document.querySelector('meta[name="sb-url"]')?.content  || "";
const SUPABASE_ANON = document.querySelector('meta[name="sb-anon"]')?.content || "";

let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  if (!window.supabase) { console.error("Supabase SDK not loaded"); return null; }
  _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _supabase;
}

// ── Current session ──────────────────────────────────────
let currentUser = null;

async function getSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  return session;
}

function getUser() { return currentUser; }
function isLoggedIn() { return !!currentUser; }

// ── Auth state change listener ───────────────────────────
function onAuthChange(callback) {
  const sb = getSupabase();
  if (!sb) return;
  sb.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    callback(event, session);
  });
}

// ── Sign in with Google ──────────────────────────────────
async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) return { error: "Auth not configured" };
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin }
  });
  return { error };
}

// ── Sign up with email/password ──────────────────────────
async function signUpWithEmail(email, password, displayName) {
  const sb = getSupabase();
  if (!sb) return { error: "Auth not configured" };
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split("@")[0] }
    }
  });
  return { data, error };
}

// ── Sign in with email/password ──────────────────────────
async function signInWithEmail(email, password) {
  const sb = getSupabase();
  if (!sb) return { error: "Auth not configured" };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
}

// ── Sign out ─────────────────────────────────────────────
async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  currentUser = null;
}

// ── Get display name ─────────────────────────────────────
function getUserDisplayName() {
  if (!currentUser) return null;
  return currentUser.user_metadata?.display_name
    || currentUser.user_metadata?.full_name
    || currentUser.user_metadata?.name
    || currentUser.email?.split("@")[0]
    || "User";
}

function getUserAvatar() {
  if (!currentUser) return null;
  return currentUser.user_metadata?.avatar_url
    || currentUser.user_metadata?.picture
    || null;
}

// ── Cloud chat storage ───────────────────────────────────
async function saveChatsToCloud(chats) {
  const sb = getSupabase();
  if (!sb || !currentUser) return false;

  try {
    for (const chat of chats) {
      // Upsert chat record
      const { error: chatErr } = await sb.from("chats").upsert({
        id: chat.id,
        user_id: currentUser.id,
        name: chat.name,
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });
      if (chatErr) { console.error("Chat upsert error:", chatErr); continue; }

      // Delete existing messages and re-insert (simplest approach)
      await sb.from("messages").delete().eq("chat_id", chat.id);
      if (chat.messages && chat.messages.length > 0) {
        const rows = chat.messages.map(m => ({
          chat_id: chat.id,
          role: m.role,
          content: m.content,
          ts: m.ts || new Date().toISOString()
        }));
        await sb.from("messages").insert(rows);
      }
    }
    return true;
  } catch (err) {
    console.error("saveChatsToCloud error:", err);
    return false;
  }
}

async function loadChatsFromCloud() {
  const sb = getSupabase();
  if (!sb || !currentUser) return null;

  try {
    const { data: chatRows, error } = await sb
      .from("chats")
      .select("id, name, updated_at")
      .eq("user_id", currentUser.id)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error || !chatRows) return null;

    const chats = [];
    for (const chatRow of chatRows) {
      const { data: msgRows } = await sb
        .from("messages")
        .select("role, content, ts")
        .eq("chat_id", chatRow.id)
        .order("id", { ascending: true });

      chats.push({
        id: chatRow.id,
        name: chatRow.name,
        messages: (msgRows || []).map(m => ({ role: m.role, content: m.content, ts: m.ts }))
      });
    }
    return chats;
  } catch (err) {
    console.error("loadChatsFromCloud error:", err);
    return null;
  }
}

async function deleteChatFromCloud(chatId) {
  const sb = getSupabase();
  if (!sb || !currentUser) return;
  await sb.from("chats").delete().eq("id", chatId).eq("user_id", currentUser.id);
}

// ── Cloud memory storage ─────────────────────────────────
async function saveMemoryToCloud(memory) {
  const sb = getSupabase();
  if (!sb || !currentUser) return false;
  try {
    const { error } = await sb.from("user_memory").upsert({
      user_id: currentUser.id,
      memory,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    return !error;
  } catch (err) {
    console.error("saveMemoryToCloud error:", err);
    return false;
  }
}

async function loadMemoryFromCloud() {
  const sb = getSupabase();
  if (!sb || !currentUser) return null;
  try {
    const { data, error } = await sb
      .from("user_memory")
      .select("memory")
      .eq("user_id", currentUser.id)
      .single();
    if (error || !data) return null;
    return data.memory;
  } catch (err) {
    console.error("loadMemoryFromCloud error:", err);
    return null;
  }
}
