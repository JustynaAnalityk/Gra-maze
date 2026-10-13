// Logowanie nazwą użytkownika: nazwa → e-mail (po stronie serwera) → sesja.
// Adres e-mail nigdy nie trafia do przeglądarki. Dla nieznanej nazwy i złego hasła
// odpowiedź jest taka sama, żeby nie dało się sprawdzić, czy konto istnieje.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
const invalid = () => json(401, { error: 'invalid_credentials' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = String(body?.username ?? '').trim();
    password = String(body?.password ?? '');
  } catch {
    return json(400, { error: 'bad_request' });
  }
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username) || !password) return invalid();

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, NO_SESSION);

  // ilike bez rozróżniania wielkości liter; „_” to w ilike symbol wieloznaczny – escapujemy.
  const pattern = username.replace(/_/g, '\\_');
  const { data: profile, error: pe } = await admin.from('profiles').select('id').ilike('username', pattern).maybeSingle();
  if (pe || !profile) return invalid();

  const { data: found, error: ue } = await admin.auth.admin.getUserById(profile.id);
  const email = found?.user?.email;
  if (ue || !email) return invalid();

  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? '';
  const auth = createClient(url, publicKey, NO_SESSION);
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    if (error?.status === 429) return json(429, { error: 'too_many_requests' });
    return invalid();
  }
  return json(200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
