# Authentik OAuth Configuration

This guide will help you configure Pantrie to use Authentik as an OAuth authentication provider.

## Prerequisites

- A running Authentik instance (self-hosted or cloud)
- Administrator access to Authentik
- Your Pantrie instance URL

## Step 1: Create an OAuth Provider in Authentik

1. Log in to your Authentik admin interface
2. Navigate to **Applications** → **Providers**
3. Click **Create** and select **OAuth2/OpenID Provider**

### Provider Configuration

Configure the following settings:

- **Name**: `Pantrie`
- **Authorization flow**: `default-provider-authorization-implicit-consent` (or your preferred flow)
- **Client type**: `Confidential`
- **Redirect URIs/Origins**: Add your Pantrie backend callback URL:
  ```
  https://your-pantrie-domain.com/api/v1/auth/oauth/authentik/callback
  ```
  Or for local development:
  ```
  http://localhost:8000/api/v1/auth/oauth/authentik/callback
  ```

  **Important**: This must be the backend API endpoint, not the frontend URL.

### Advanced Settings

- **Scopes**: Ensure the following scopes are included:
  - `openid`
  - `email`
  - `profile`
- **Subject mode**: `Based on the User's hashed ID`
- **Include claims in id_token**: ✓ Enabled

Click **Create** to save the provider.

## Step 2: Create an Application in Authentik

1. Navigate to **Applications** → **Applications**
2. Click **Create**

### Application Configuration

- **Name**: `Pantrie`
- **Slug**: `pantrie`
- **Provider**: Select the `Pantrie` provider you just created
- **Launch URL**: Your Pantrie instance URL (e.g., `https://your-pantrie-domain.com`)

Click **Create** to save the application.

## Step 3: Get OAuth Credentials

1. Go back to **Applications** → **Providers**
2. Click on the **Pantrie** provider you created
3. Note down the following information:
   - **Client ID**: Found in the provider details
   - **Client Secret**: Click "Show" to reveal the secret

## Step 4: Configure Pantrie

### During Initial Setup

When running through Pantrie's setup wizard:

1. On the OAuth Configuration step, select **Authentik** from the dropdown
2. Fill in the required fields:
   - **Authentik Base URL**: Your Authentik instance URL (e.g., `https://auth.example.com`)
   - **Application Slug**: The slug from Step 2 (e.g., `pantrie`)
   - **Client ID**: The Client ID from Step 3
   - **Client Secret**: The Client Secret from Step 3

### After Initial Setup

If you need to add or update Authentik OAuth later:

1. Log in as a site administrator
2. Navigate to **Settings** → **Administration**
3. Go to the **OAuth Settings** tab
4. Configure Authentik OAuth settings

Alternatively, you can set environment variables:

```bash
OAUTH_AUTHENTIK_BASE_URL=https://auth.example.com
OAUTH_AUTHENTIK_SLUG=pantrie
OAUTH_AUTHENTIK_CLIENT_ID=your_client_id_here
OAUTH_AUTHENTIK_CLIENT_SECRET=your_client_secret_here
```

## Step 5: Test OAuth Login

1. Navigate to your Pantrie login page
2. You should see a "Sign in with Authentik" button
3. Click the button to test the OAuth flow
4. You'll be redirected to Authentik to authorize
5. After authorization, you'll be redirected back to Pantrie and logged in

## Auto-Linking Existing Accounts

Pantrie will automatically link OAuth accounts to existing accounts if:

1. The email address matches an existing user
2. The email is verified by the OAuth provider

This allows users to switch between local authentication and OAuth seamlessly.

## Troubleshooting

### "OAuth provider not configured" error

- Verify all three environment variables are set
- Restart the Pantrie backend container after setting variables
- Check the backend logs for OAuth initialization messages

### Redirect URI mismatch error

- Ensure the redirect URI in Authentik exactly matches your Pantrie callback URL
- Include the protocol (http/https)
- Check for trailing slashes

### "Failed to authenticate" error

- Verify the Client ID and Client Secret are correct
- Check that the required scopes (openid, email, profile) are enabled
- Ensure the Authentik provider is using a compatible authorization flow

### Users created but not auto-linked

- Verify the user's email in Pantrie matches exactly
- Check that the OAuth provider marks the email as verified
- Review the backend logs for auto-linking attempts

## Security Considerations

### Client Secret Protection

- Never commit the client secret to version control
- Use environment variables or secrets management
- Rotate the secret periodically

### Redirect URI Validation

- Only add redirect URIs you control
- Use HTTPS in production
- Avoid using wildcards in redirect URIs

### User Access Control

- Configure appropriate access policies in Authentik
- Use Authentik groups to manage user permissions
- Enable MFA in Authentik for enhanced security

## Additional Resources

- [Authentik OAuth2 Provider Documentation](https://goauthentik.io/docs/providers/oauth2)
- [Authentik Application Configuration](https://goauthentik.io/docs/applications)
- [OpenID Connect Specification](https://openid.net/specs/openid-connect-core-1_0.html)
