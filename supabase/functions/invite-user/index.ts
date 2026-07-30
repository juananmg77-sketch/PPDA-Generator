import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization')!;
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error('No autenticado');

    const { data: profile } = await supabaseUser
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') throw new Error('Solo los administradores pueden crear usuarios');

    const { email, role, full_name, password } = await req.json();
    if (!email || !role || !password) throw new Error('Email, rol y contraseña son obligatorios');
    if (!['admin', 'consultor', 'viewer'].includes(role)) throw new Error('Rol inválido');
    if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email, role },
    });
    if (createError) throw createError;

    await supabaseAdmin.from('profiles').upsert({
      id: newUser.user.id,
      email: email.trim().toLowerCase(),
      full_name: full_name || email,
      role,
    }, { onConflict: 'id' });

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
