import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zhursgmxnztyepxobvnz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpodXJzZ214bnp0eWVweG9idm56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIzMjQ0MCwiZXhwIjoyMDg5ODA4NDQwfQ.K5WVNeenPOf6Ya7AH-ZaZs8SoTC1xe_BU3t2h6ICbOI'
);

async function main() {
  // Step 1: Create helper function to exec arbitrary SQL
  const { error: fnErr } = await supabase.rpc('exec_sql', { query: 'SELECT 1' });
  
  if (fnErr && fnErr.message.includes('Could not find the function')) {
    console.log('exec_sql RPC does not exist. Creating it...');
    
    // We can't create functions via REST. Let's try a different approach.
    // Use the audit_logs as a simple insert-only table via REST by creating
    // a Supabase Edge Function or using the Supabase Dashboard.
    
    // Alternative: Check if we can create the table with a migration
    console.log('');
    console.log('⚠️  Cannot create tables via REST API.');
    console.log('   Please run this SQL in the Supabase Dashboard SQL Editor:');
    console.log('');
    console.log(`CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.audit_logs FOR ALL USING (true);
GRANT ALL ON public.audit_logs TO service_role;
GRANT SELECT ON public.audit_logs TO authenticated;`);
    console.log('');
    return;
  }

  console.log('exec_sql exists, using it...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.audit_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      actor_id UUID,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID,
      metadata JSONB DEFAULT '{}',
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
  `;
  
  const { error: createErr } = await supabase.rpc('exec_sql', { query: createTableSQL });
  if (createErr) {
    console.error('Create error:', createErr);
  } else {
    console.log('✅ audit_logs created successfully');
  }

  // Verify
  const { error: verifyErr } = await supabase.from('audit_logs').select('id').limit(1);
  if (verifyErr) {
    console.error('Verify error:', verifyErr);
  } else {
    console.log('✅ audit_logs table verified');
  }
}

main().catch(console.error);
