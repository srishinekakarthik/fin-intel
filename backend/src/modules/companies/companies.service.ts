import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { writeAuditLog } from '../../services/audit';
import { logger } from '../../config/logger';
import type { Company, AuthContext } from '../../types';

interface CreateCompanyInput {
  name: string;
  ticker?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  description?: string;
  website?: string;
  is_public?: boolean;
}

interface ListCompaniesOptions {
  page?: number;
  limit?: number;
  search?: string;
  is_tracked?: boolean;
}

export class CompanyService {
  async list(auth: AuthContext, opts: ListCompaniesOptions = {}) {
    const { page = 1, limit = 20, search, is_tracked } = opts;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('companies')
      .select('*, company_snapshots(health_score, stock_price, market_cap, snapshot_at)', {
        count: 'exact',
      })
      .eq('org_id', auth.orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,ticker.ilike.%${search}%`);
    }
    if (is_tracked !== undefined) {
      query = query.eq('is_tracked', is_tracked);
    }

    const { data, error, count } = await query;

    if (error) throw new AppError('Failed to fetch companies', 500);

    return {
      data: data as unknown as Company[],
      total: count ?? 0,
      page,
      limit,
      hasMore: offset + limit < (count ?? 0),
    };
  }

  async getById(auth: AuthContext, companyId: string): Promise<Company> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*, company_snapshots(*))')
      .eq('id', companyId)
      .eq('org_id', auth.orgId)
      .single();

    if (error || !data) throw new AppError('Company not found', 404);
    return data as unknown as Company;
  }

  async create(auth: AuthContext, input: CreateCompanyInput): Promise<Company> {
    // Check for duplicate ticker within org
    if (input.ticker) {
      const { data: existing } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('org_id', auth.orgId)
        .eq('ticker', input.ticker.toUpperCase())
        .single();

      if (existing) {
        throw new AppError(`Company with ticker ${input.ticker.toUpperCase()} already exists`, 409);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .insert({
        org_id: auth.orgId,
        created_by: auth.userId,
        name: input.name,
        ticker: input.ticker?.toUpperCase() ?? null,
        exchange: input.exchange ?? null,
        sector: input.sector ?? null,
        industry: input.industry ?? null,
        description: input.description ?? null,
        website: input.website ?? null,
        is_public: input.is_public ?? true,
      })
      .select()
      .single();

    if (error || !data) throw new AppError('Failed to create company', 500);

    // Automatically fetch initial market data snapshot if it has a ticker
    if (data.ticker) {
      // Run asynchronously so we don't block the API response
      import('../../services/market-data').then(({ refreshCompanySnapshot }) => {
        refreshCompanySnapshot(data.id, data.ticker as string).catch((e) => {
          logger.error('Failed to fetch initial market snapshot', { companyId: data.id, error: e });
        });
      });
    }

    await writeAuditLog(auth, {
      action: 'company.created',
      resourceType: 'company',
      resourceId: data.id,
    });

    return data as unknown as Company;
  }

  async update(
    auth: AuthContext,
    companyId: string,
    input: Partial<CreateCompanyInput>
  ): Promise<Company> {
    await this.getById(auth, companyId); // validates ownership

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({
        ...input,
        ticker: input.ticker?.toUpperCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .eq('org_id', auth.orgId)
      .select()
      .single();

    if (error || !data) throw new AppError('Failed to update company', 500);

    await writeAuditLog(auth, {
      action: 'company.updated',
      resourceType: 'company',
      resourceId: companyId,
      diff: input,
    });

    return data as unknown as Company;
  }

  async toggleTracked(auth: AuthContext, companyId: string): Promise<Company> {
    const company = await this.getById(auth, companyId);

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({ is_tracked: !company.is_tracked })
      .eq('id', companyId)
      .eq('org_id', auth.orgId)
      .select()
      .single();

    if (error || !data) throw new AppError('Failed to toggle tracking', 500);
    return data as unknown as Company;
  }

  async delete(auth: AuthContext, companyId: string): Promise<void> {
    await this.getById(auth, companyId); // validates ownership

    const { error } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', companyId)
      .eq('org_id', auth.orgId);

    if (error) throw new AppError('Failed to delete company', 500);

    await writeAuditLog(auth, {
      action: 'company.deleted',
      resourceType: 'company',
      resourceId: companyId,
    });
  }
}

export const companyService = new CompanyService();
