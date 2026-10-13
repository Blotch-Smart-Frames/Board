import type {
  AuthMetadataOptions,
  OAuthMetadata,
} from "@modelcontextprotocol/server";
import type { McpConfig } from "../mcp/config";
import { BOARDS_SCOPE, OFFLINE_ACCESS_SCOPE } from "./store";

const AUTH_METHODS = ["none", "client_secret_post", "client_secret_basic"];

/**
 * RFC 8414 authorization server metadata. Notes for the two clients we target:
 * - `client_id_metadata_document_supported` plus `none` in the auth methods
 *   makes Claude and ChatGPT identify themselves with a Client ID Metadata
 *   Document instead of registering a new client per connection.
 * - `authorization_response_iss_parameter_supported` (RFC 9207) gets ChatGPT's
 *   stable redirect URI; we include `iss` on every authorization response.
 * - Listing `offline_access` makes Claude ask for it (we always issue refresh
 *   tokens anyway).
 */
export function authorizationServerMetadata(config: McpConfig): OAuthMetadata {
  return {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/oauth/authorize`,
    token_endpoint: `${config.issuer}/oauth/token`,
    registration_endpoint: `${config.issuer}/oauth/register`,
    revocation_endpoint: `${config.issuer}/oauth/revoke`,
    scopes_supported: [BOARDS_SCOPE, OFFLINE_ACCESS_SCOPE],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: AUTH_METHODS,
    revocation_endpoint_auth_methods_supported: AUTH_METHODS,
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

/** Inputs for the SDK's well-known document responder. */
export function authMetadataOptions(config: McpConfig): AuthMetadataOptions {
  return {
    oauthMetadata: authorizationServerMetadata(config),
    resourceServerUrl: new URL(config.resourceUrl),
    scopesSupported: [BOARDS_SCOPE],
    resourceName: "Board",
  };
}
