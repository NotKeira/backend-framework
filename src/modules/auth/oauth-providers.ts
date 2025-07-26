import { OAuthConfig } from "../../types/index";

/**
 * OAuth provider implementations for GitHub, Google, Discord
 */
export class OAuthProviders {
  private readonly providers: Map<string, OAuthProvider> = new Map();

  public configure(config: OAuthConfig): void {
    if (config.providers.github) {
      this.providers.set("github", new GitHubProvider(config.providers.github));
    }

    if (config.providers.google) {
      this.providers.set("google", new GoogleProvider(config.providers.google));
    }

    if (config.providers.discord) {
      this.providers.set(
        "discord",
        new DiscordProvider(config.providers.discord)
      );
    }
  }

  public getProvider(name: string): OAuthProvider | undefined {
    return this.providers.get(name);
  }

  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export abstract class OAuthProvider {
  constructor(protected config: OAuthProviderConfig) {}

  public abstract getAuthorizationUrl(state: string): string;
  public abstract exchangeCodeForToken(
    code: string
  ): Promise<OAuthTokenResponse>;
  public abstract getUserInfo(accessToken: string): Promise<OAuthUser>;
}

export class GitHubProvider extends OAuthProvider {
  public getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: "http://localhost:3000/auth/github/callback",
      scope: this.config.scope.join(" "),
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  public async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    // Future: Implement actual GitHub OAuth token exchange
    return {
      access_token: `gh_mock_${code}`,
      token_type: "bearer",
      scope: this.config.scope.join(" "),
    };
  }

  public async getUserInfo(accessToken: string): Promise<OAuthUser> {
    // Future: Implement actual GitHub user info retrieval
    return {
      id: `gh_user_${accessToken}`,
      email: "user@github.com",
      name: "GitHub User",
      avatar: "https://github.com/avatar.png",
    };
  }
}

export class GoogleProvider extends OAuthProvider {
  public getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: "http://localhost:3000/auth/google/callback",
      scope: this.config.scope.join(" "),
      response_type: "code",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  public async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    // Future: Implement actual Google OAuth token exchange
    return {
      access_token: `goog_mock_${code}`,
      token_type: "bearer",
      scope: this.config.scope.join(" "),
    };
  }

  public async getUserInfo(accessToken: string): Promise<OAuthUser> {
    // Future: Implement actual Google user info retrieval
    return {
      id: `goog_user_${accessToken}`,
      email: "user@gmail.com",
      name: "Google User",
      avatar: "https://lh3.googleusercontent.com/avatar.png",
    };
  }
}

export class DiscordProvider extends OAuthProvider {
  public getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: "http://localhost:3000/auth/discord/callback",
      scope: this.config.scope.join(" "),
      response_type: "code",
      state,
    });
    return `https://discord.com/api/oauth2/authorize?${params}`;
  }

  public async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    // Future: Implement actual Discord OAuth token exchange
    return {
      access_token: `dc_mock_${code}`,
      token_type: "bearer",
      scope: this.config.scope.join(" "),
    };
  }

  public async getUserInfo(accessToken: string): Promise<OAuthUser> {
    // Future: Implement actual Discord user info retrieval
    return {
      id: `dc_user_${accessToken}`,
      email: "user@discord.com",
      name: "Discord User",
      avatar: "https://cdn.discordapp.com/avatars/avatar.png",
    };
  }
}

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  scope: string[];
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  scope: string;
}

export interface OAuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
}
