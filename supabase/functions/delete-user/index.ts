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

    // Verify caller is admin
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error('No autenticado');

    const { data: profile } = await supabaseUser
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') throw new Error('Solo los administradores pueden eliminar usuarios');

    const { user_id } = await req.json();
    if (!user_id) throw new Error('user_id es obligatorio');

    // Prevent self-deletion
    if (user_id === user.id) throw new Error('No puedes eliminar tu propio usuario');

    // Delete plan_access entries
    await supabaseAdmin.from('plan_access').delete().eq('user_id', user_id);

    // Delete profile
    await supabaseAdmin.from('profiles').delete().eq('id', user_id);

    // Delete from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteError) throw deleteError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
