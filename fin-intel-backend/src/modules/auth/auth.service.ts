import slugify from 'slugify';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { logger } from '../../config/logger';
import type { Organization, User, UserRole } from '../../types';

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  orgName: string;
}

interface RegisterResult {
  organization: Organization;
  user: User;
  session: { access_token: string; refresh_token: string };
}

interface LoginResult {
  user: User;
  organization: Organization;
  session: { access_token: string; refresh_token: string };
}

export class AuthService {
  /**
   * Register a new user and create their organization.
   * The registering user becomes the org owner.
   */
  async register(input: RegisterInput): Promise<RegisterResult> {
    const { data: authData, error: signUpError } =
      await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.fullName,
        },
      });

    if (signUpError || !authData.user) {
      logger.error('Supabase auth createUser failed', { error: signUpError });
      throw new AppError(signUpError?.message ?? 'Registration failed', 400);
    }

    const authUser = authData.user;

    const slug = await this.uniqueSlug(input.orgName);
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: input.orgName, slug })
      .select('*')
      .single();

    if (orgError || !org) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      throw new AppError('Failed to create organization', 500);
    }

    const { data: user, error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        org_id: org.id,
        auth_id: authUser.id,
        email: input.email,
        full_name: input.fullName,
        role: 'owner' as UserRole,
      })
      .select('*')
      .single();

    if (userInsertError || !user) {
      logger.error('Failed to insert user record', {
        error: userInsertError,
        auth_id: authUser.id,
      });
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      throw new AppError('Failed to create user record', 500);
    }

    logger.info('User record created', { user_id: user.id, auth_id: authUser.id });

    const { data: sessionData, error: signInError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

    if (signInError || !sessionData.session) {
      throw new AppError('Registration succeeded but sign-in failed', 500);
    }

    return {
      organization: org as unknown as Organization,
      user: user as unknown as User,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
    };
  }

  /**
   * Sign in an existing user.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      throw new AppError('Invalid email or password', 401);
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('auth_id', data.user.id)
      .single();

    if (userError || !user) {
      logger.error('Failed to fetch user record', {
        error: userError,
        auth_id: data.user.id,
      });
      throw new AppError('User account not found', 401);
    }

    if (!user.is_active) {
      throw new AppError('Account is deactivated', 403);
    }

    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', user.org_id)
      .single();

    if (orgError || !organization) {
      throw new AppError('Organization not found', 404);
    }

    return {
      user: user as unknown as User,
      organization: organization as unknown as Organization,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    };
  }

  /**
   * Refresh a session using a refresh token.
   */
  async refresh(refreshToken: string) {
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };
  }

  /**
   * Sign out — invalidates the session server-side.
   */
  async logout(accessToken: string): Promise<void> {
    await supabaseAdmin.auth.admin.signOut(accessToken);
  }

  // ── Private helpers ─────────────────────────────────────

  private async uniqueSlug(name: string): Promise<string> {
    let base = slugify(name, { lower: true, strict: true });
    let slug = base;
    let counter = 1;

    while (true) {
      const { data } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (!data) return slug;
      slug = `${base}-${counter++}`;
    }
  }
}

export const authService = new AuthService();
