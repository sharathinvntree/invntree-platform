import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify calling user is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: corsHeaders })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: corsHeaders })

    const { data: profile } = await supabaseClient
      .from('profiles').select('role').eq('id', caller.id).single()
    if (profile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 200, headers: corsHeaders })

    const { user_id, password } = await req.json()
    if (!user_id || !password) return new Response(JSON.stringify({ error: 'user_id and password are required' }), { status: 200, headers: corsHeaders })
    if (password.length < 6) return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { status: 200, headers: corsHeaders })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders })
  }
})
