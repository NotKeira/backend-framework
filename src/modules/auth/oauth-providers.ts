import { OAuthConfig } from "../../types/index";

/**
 * OAuth provider implementations for Discord and Roblox
 */
export class OAuthProviders {
  private readonly providers: Map<string, OAuthProvider> = new Map();

  public configure(config: OAuthConfig): void {
    if (config.providers.discord) {
      this.providers.set(
        "discord",
        new DiscordProvider(config.providers.discord)
      );
    }

    if (config.providers.roblox) {
      this.providers.set("roblox", new RobloxProvider(config.providers.roblox));
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
  public getAuthorisationUrl(state: string): string {
    return this.getAuthorizationUrl(state);
  }
  public abstract exchangeCodeForToken(
    code: string
  ): Promise<OAuthTokenResponse>;
  public abstract getUserInfo(accessToken: string): Promise<OAuthUser>;
}

export class DiscordProvider extends OAuthProvider {
  public getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri:
        this.config.redirectUri ||
        "http://localhost:3000/api/auth/discord/callback",
      scope: this.config.scope.join(" "),
      response_type: "code",
      state,
    });
    return `https://discord.com/api/oauth2/authorize?${params}`;
  }

  public async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri:
            this.config.redirectUri ||
            "http://localhost:3000/api/auth/discord/callback",
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Discord token exchange failed: ${response.statusText}`
        );
      }

      const data = await response.json();
      return {
        access_token: data.access_token,
        token_type: data.token_type,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        scope: data.scope,
      };
    } catch (error) {
      console.error("Discord token exchange error:", error);
      throw new Error(
        "Failed to exchange Discord authorization code for token"
      );
    }
  }

  public async getUserInfo(accessToken: string): Promise<OAuthUser> {
    try {
      const response = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Discord user info fetch failed: ${response.statusText}`
        );
      }

      const user = await response.json();
      return {
        id: user.id,
        email: user.email || "",
        name: user.global_name || user.username,
        avatar: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${
              parseInt(user.discriminator) % 5
            }.png`,
        provider: "discord",
        providerId: user.id,
      };
    } catch (error) {
      console.error("Discord user info error:", error);
      throw new Error("Failed to fetch Discord user information");
    }
  }
}

export class RobloxProvider extends OAuthProvider {
  public getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri:
        this.config.redirectUri ||
        "http://localhost:3000/api/auth/roblox/callback",
      scope: this.config.scope.join(" "),
      response_type: "code",
      state,
    });
    return `https://apis.roblox.com/oauth/v1/authorize?${params}`;
  }

  public async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch("https://apis.roblox.com/oauth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            this.config.clientId + ":" + this.config.clientSecret
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          redirect_uri:
            this.config.redirectUri ||
            "http://localhost:3000/api/auth/roblox/callback",
        }),
      });

      if (!response.ok) {
        throw new Error(`Roblox token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        access_token: data.access_token,
        token_type: data.token_type,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        scope: data.scope,
      };
    } catch (error) {
      console.error("Roblox token exchange error:", error);
      throw new Error("Failed to exchange Roblox authorization code for token");
    }
  }

  public async getUserInfo(accessToken: string): Promise<OAuthUser> {
    try {
      const response = await fetch(
        "https://apis.roblox.com/oauth/v1/userinfo",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Roblox user info fetch failed: ${response.statusText}`
        );
      }

      const user = await response.json();

      // Get additional user details from Roblox Users API
      let avatar = "";
      try {
        const avatarResponse = await fetch(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.sub}&size=150x150&format=Png&isCircular=false`
        );
        if (avatarResponse.ok) {
          const avatarData = await avatarResponse.json();
          if (avatarData.data?.[0]) {
            avatar = avatarData.data[0].imageUrl;
          }
        }
      } catch (error) {
        console.error("Failed to fetch Roblox avatar:", error);
      }

      return {
        id: user.sub,
        email: user.email || "",
        name: user.name || user.preferred_username || `User_${user.sub}`,
        avatar:
          avatar ||
          "https://www.roblox.com/asset-thumbnail/image?assetId=1&width=150&height=150",
        provider: "roblox",
        providerId: user.sub,
      };
    } catch (error) {
      console.error("Roblox user info error:", error);
      throw new Error("Failed to fetch Roblox user information");
    }
  }
}

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  scope: string[];
  redirectUri?: string;
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
  provider: string;
  providerId: string;
}
