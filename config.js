
"use strict";

(function () {
  const SUPABASE_URL =
    "https://rgminzzmlktkliliiupt.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_UHJzsYIpimmjtDtHEnacQA_BJVKE2pD";

  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase JS боргирӣ нашудааст.");
    return;
  }

  window.vayoDB = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  console.log("VAYO Supabase пайваст шуд.");
})();
