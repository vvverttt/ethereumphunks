/**
 * fix-comments-rls.js
 * Diagnoses and fixes RLS policy on comments table for anon role.
 *
 * Usage:
 *   node fix-comments-rls.js                  -- diagnose + attempt fix
 *   node fix-comments-rls.js --verify         -- verify anon can read
 *   node fix-comments-rls.js --db-url <url>   -- fix via direct DB connection
 */

var { createClient } = require("@supabase/supabase-js");

var SUPABASE_URL = "https://hzpwkpjxhtpcygrwtwku.supabase.co";
var SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs";
var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY";

var serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
var anonClient = createClient(SUPABASE_URL, ANON_KEY);
var DQ = String.fromCharCode(34);
var args = process.argv.slice(2);
var verifyOnly = args.indexOf("--verify") >= 0;
var dbUrlIdx = args.indexOf("--db-url");
var dbUrl = dbUrlIdx >= 0 ? args[dbUrlIdx + 1] : null;

async function diagnose() {
  console.log("=== Step 1: Diagnosing comments table RLS ===");
  console.log("");
  var svcResult = await serviceClient.from("comments").select("*").limit(5);
  if (svcResult.error) {
    console.log("[ERROR] Service role cannot read comments:", svcResult.error.message);
    return false;
  }
  console.log("[OK] Service role sees " + svcResult.data.length + " comments (limit 5).");
  if (svcResult.data.length > 0) {
    console.log("     Sample:", JSON.stringify(svcResult.data[0]).substring(0, 120) + "...");
  }
  var anonResult = await anonClient.from("comments").select("*").limit(5);
  if (anonResult.error) {
    console.log("[FAIL] Anon role gets error:", anonResult.error.message);
  } else if (anonResult.data.length === 0 && svcResult.data.length > 0) {
    console.log("[FAIL] Anon sees 0 comments (service_role sees " + svcResult.data.length + ").");
    console.log("     RLS is blocking the anon role.");
  } else {
    console.log("[OK] Anon role sees " + anonResult.data.length + " comments.");
    if (anonResult.data.length > 0) {
      console.log("     The anon role can already read comments!");
      return true;
    }
  }
  return false;
}

async function fixViaDirectDB(connectionUrl) {
  console.log("");
  console.log("=== Step 2: Fixing RLS via direct database connection ===");
  console.log("");
  var pg;
  try { pg = require("pg"); } catch (e) {
    console.log("Installing pg module...");
    var childProc = require("child_process");
    childProc.execSync("npm install pg", { cwd: __dirname, stdio: "inherit", timeout: 30000 });
    pg = require("pg");
  }
  var pgClient = new pg.Client({ connectionString: connectionUrl, ssl: { rejectUnauthorized: false } });
  try {
    await pgClient.connect();
    console.log("[OK] Connected to database.");
    var rlsCheck = await pgClient.query("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1", ["comments"]);
    if (rlsCheck.rows.length > 0) {
      console.log("RLS enabled:", rlsCheck.rows[0].relrowsecurity);
      console.log("RLS forced:", rlsCheck.rows[0].relforcerowsecurity);
    }
    var policies = await pgClient.query("SELECT policyname, roles, cmd, qual FROM pg_policies WHERE tablename = $1", ["comments"]);
    console.log("Existing policies (" + policies.rows.length + "):");
    policies.rows.forEach(function(p) {
      console.log("  - " + p.policyname + " [" + p.cmd + "] roles=" + p.roles + " using=" + p.qual);
    });
    console.log("Enabling RLS...");
    await pgClient.query("ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY");
    console.log("[OK] RLS enabled.");
    console.log("Creating SELECT policy for anon...");
    var policyName = DQ + "Allow anon select on comments" + DQ;
    await pgClient.query("DROP POLICY IF EXISTS " + policyName + " ON public.comments");
    await pgClient.query("CREATE POLICY " + policyName + " ON public.comments FOR SELECT TO anon USING (true)");
    console.log("[OK] Policy created.");
    var policiesAfter = await pgClient.query("SELECT policyname, roles, cmd, qual FROM pg_policies WHERE tablename = $1", ["comments"]);
    console.log("Policies after fix (" + policiesAfter.rows.length + "):");
    policiesAfter.rows.forEach(function(p) {
      console.log("  - " + p.policyname + " [" + p.cmd + "] roles=" + p.roles + " using=" + p.qual);
    });
    await pgClient.end();
    return true;
  } catch (e) {
    console.log("[ERROR] Database operation failed:", e.message);
    try { await pgClient.end(); } catch(x) {}
    return false;
  }
}

async function verify() {
  console.log("");
  console.log("=== Verifying anon role can read comments ===");
  console.log("");
  await new Promise(function(r) { setTimeout(r, 2000); });
  var anonResult = await anonClient.from("comments").select("*").limit(10);
  if (anonResult.error) {
    console.log("[FAIL] Anon gets error:", anonResult.error.message);
    return false;
  }
  var svcResult = await serviceClient.from("comments").select("*").limit(10);
  var svcCount = svcResult.data ? svcResult.data.length : 0;
  if (anonResult.data.length > 0) {
    console.log("[SUCCESS] Anon can read comments! Found " + anonResult.data.length + " rows.");
    anonResult.data.forEach(function(row, i) {
      console.log("  " + (i + 1) + ". [" + row.from + "] " + row.content + " (topic: " + row.topic + ")");
    });
    return true;
  } else if (svcCount === 0) {
    console.log("[OK] Table is empty. SELECT permission appears to work.");
    return true;
  } else {
    console.log("[FAIL] Anon sees 0 rows but service_role sees " + svcCount + ".");
    console.log("     RLS is still blocking the anon role.");
    return false;
  }
}

async function main() {
  if (verifyOnly) {
    var ok = await verify();
    process.exit(ok ? 0 : 1);
    return;
  }
  var alreadyOk = await diagnose();
  if (alreadyOk) { process.exit(0); return; }
  if (dbUrl) {
    var fixed = await fixViaDirectDB(dbUrl);
    if (fixed) { await verify(); }
  } else {
    var SQ = String.fromCharCode(39);
    console.log("");
    console.log("=== Step 2: How to fix ===");
    console.log("");
    console.log("Cannot execute DDL via the Supabase REST API (no exec_sql function).");
    console.log("The Management API token returned 401 (unauthorized/expired).");
    console.log("");
    console.log("You have two options:");
    console.log("");
    console.log("OPTION A: Re-run with your database connection URL:");
    console.log("  node fix-comments-rls.js --db-url " + DQ + "postgresql://postgres.hzpwkpjxhtpcygrwtwku:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres" + DQ);
    console.log("");
    console.log("  Find the URI in: Supabase Dashboard > Settings > Database > Connection string");
    console.log("");
    console.log("OPTION B: Run this SQL in the Supabase Dashboard SQL Editor:");
    console.log("  https://supabase.com/dashboard/project/hzpwkpjxhtpcygrwtwku/sql/new");
    console.log("");
    console.log("  ----------------------------------------");
    console.log("  -- Check current policies");
    console.log("  SELECT policyname, roles, cmd, qual");
    console.log("  FROM pg_policies");
    console.log("  WHERE tablename = " + SQ + "comments" + SQ + ";");
    console.log("");
    console.log("  -- Enable RLS (idempotent)");
    console.log("  ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;");
    console.log("");
    console.log("  -- Add SELECT policy for anon role");
    console.log("  CREATE POLICY " + DQ + "Allow anon select on comments" + DQ);
    console.log("  ON public.comments FOR SELECT TO anon USING (true);");
    console.log("  ----------------------------------------");
    console.log("");
    console.log("After running the SQL, verify with:");
    console.log("  node fix-comments-rls.js --verify");
    console.log("");
  }
}

main().catch(function(err) {
  console.error("Unexpected error:", err);
  process.exit(1);
});
