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
    // Cliente con service role (solo disponible en el servidor)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Cliente con el JWT del usuario que hace la petición
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar que el invitador es admin
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error('No autenticado');

    const { data: profile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      throw new Error('Solo los administradores pueden invitar usuarios');
    }

    // Leer el body
    const { email, role, full_name } = await req.json();
    if (!email || !role) throw new Error('Email y rol son obligatorios');
    if (!['admin', 'consultor', 'viewer'].includes(role)) {
      throw new Error('Rol inválido');
    }

    // Enviar invitación
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { data: { full_name: full_name || email, role } }
    );
    if (inviteError) throw inviteError;

    // Crear/actualizar perfil con el rol correcto
    await supabaseAdmin.from('profiles').upsert({
      id: inviteData.user.id,
      email: email,
      full_name: full_name || email,
      role: role,
    }, { onConflict: 'email' });

    return new Response(
      JSON.stringify({ success: true, user_id: inviteData.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
