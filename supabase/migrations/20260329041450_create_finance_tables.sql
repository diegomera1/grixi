CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  transaction_type TEXT NOT NULL,
  category TEXT NOT NULL,
  department TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  exchange_rate NUMERIC DEFAULT 1.0,
  amount_usd NUMERIC NOT NULL,
  counterparty TEXT NOT NULL,
  description TEXT,
  sap_document_id TEXT,
  is_live BOOLEAN DEFAULT false,
  invoice_number TEXT,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  net_amount NUMERIC,
  payment_terms TEXT DEFAULT 'NET30',
  due_date DATE,
  status TEXT DEFAULT 'posted',
  cost_center_code TEXT,
  gl_account TEXT,
  profit_center TEXT,
  posting_date DATE,
  document_date DATE,
  reference TEXT,
  payment_method TEXT DEFAULT 'transfer',
  line_items JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.finance_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  budget_annual NUMERIC DEFAULT 0,
  parent_id UUID REFERENCES public.finance_cost_centers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.finance_cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read org transactions" ON public.finance_transactions
  FOR SELECT USING (org_id IN (SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "Members read org cost centers" ON public.finance_cost_centers
  FOR SELECT USING (org_id IN (SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()));
