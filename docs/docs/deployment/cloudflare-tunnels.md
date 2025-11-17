# Cloudflare Tunnels

Cloudflare Tunnels provide a secure way to expose your Pantrie instance to the internet without opening ports on your firewall or dealing with complex networking configurations. This is the recommended method for most home users.

## What is a Cloudflare Tunnel?

Cloudflare Tunnel creates an encrypted tunnel between your server and Cloudflare's network. Traffic to your domain is routed through Cloudflare's network and then securely tunneled to your server, providing:

- **Security**: No need to open inbound firewall ports
- **DDoS Protection**: Cloudflare's network protects your origin server
- **SSL/TLS**: Automatic HTTPS with Cloudflare's certificates
- **Easy Setup**: No complex networking or dynamic DNS required

## Prerequisites

- A domain name registered with Cloudflare (free tier works)
- Pantrie running via Docker Compose
- `cloudflared` installed on your server

## Installation

### 1. Install cloudflared

=== "Ubuntu/Debian"

    ```bash
    # Download and install cloudflared
    wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared-linux-amd64.deb
    ```

=== "Other Linux"

    ```bash
    # Download the binary
    wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
    sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
    sudo chmod +x /usr/local/bin/cloudflared
    ```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This will open a browser window where you can authorize cloudflared to manage your domain.

### 3. Create a Tunnel

```bash
# Create a new tunnel (replace 'pantrie' with your preferred name)
cloudflared tunnel create pantrie

# Note the Tunnel ID that is displayed - you'll need this
```

### 4. Configure the Tunnel

Create a configuration file at `~/.cloudflared/config.yml`:

```yaml
tunnel: <YOUR_TUNNEL_ID>
credentials-file: /home/<YOUR_USERNAME>/.cloudflared/<YOUR_TUNNEL_ID>.json

ingress:
  # Route your domain to the nginx reverse proxy
  - hostname: pantrie.yourdomain.com
    service: http://localhost:80

  # Catch-all rule (required)
  - service: http_status:404
```

!!! tip "Using Different Ports"
    If you've changed the nginx port in docker-compose.yml, update the service URL accordingly (e.g., `http://localhost:8080`)

### 5. Create DNS Record

```bash
cloudflared tunnel route dns <YOUR_TUNNEL_ID> pantrie.yourdomain.com
```

This creates a CNAME record in Cloudflare DNS pointing your subdomain to the tunnel.

### 6. Run the Tunnel

Test the tunnel first:

```bash
cloudflared tunnel run pantrie
```

If everything works, install it as a system service:

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### 7. Update Vite Configuration

Update your `frontend/vite.config.ts` to allow your custom domain:

```typescript
server: {
  port: 5173,
  host: '0.0.0.0',
  allowedHosts: [
    'localhost',
    '127.0.0.1',
    'pantrie.yourdomain.com',  // Add your domain
    '.yourdomain.com',         // Allow all subdomains
  ],
  // ... rest of config
}
```

Restart the frontend container:

```bash
docker-compose restart frontend
```

## Access Your Instance

You should now be able to access Pantrie at `https://pantrie.yourdomain.com`!

## Troubleshooting

### Connection Refused

- Verify Pantrie is running: `docker-compose ps`
- Check nginx is listening: `docker logs pantrie-nginx`
- Verify the tunnel is running: `sudo systemctl status cloudflared`

### 502 Bad Gateway

- Check that the port in your tunnel config matches your nginx container port
- Verify nginx is properly configured: `docker logs pantrie-nginx`

### Vite Host Blocking Error

If you see "Blocked request. This host is not allowed":

1. Add your domain to `allowedHosts` in `frontend/vite.config.ts`
2. Restart the frontend container: `docker-compose restart frontend`

### Tunnel Not Starting

Check the cloudflared logs:

```bash
sudo journalctl -u cloudflared -f
```

Common issues:
- Invalid tunnel ID in config.yml
- Incorrect credentials file path
- Port already in use

## Security Considerations

### Cloudflare Access (Optional)

For additional security, you can put Cloudflare Access in front of your application:

1. Go to Cloudflare Zero Trust dashboard
2. Create an Access policy for your domain
3. Configure authentication methods (email OTP, Google, GitHub, etc.)

This adds an extra layer of authentication before users can reach your Pantrie login page.

### Rate Limiting

Consider enabling Cloudflare's rate limiting to protect against brute-force attacks:

1. Go to your domain in Cloudflare dashboard
2. Navigate to Security > WAF
3. Create rate limiting rules for your login endpoints

## Advanced Configuration

### Multiple Domains

You can route multiple domains through the same tunnel:

```yaml
ingress:
  - hostname: pantrie.yourdomain.com
    service: http://localhost:80
  - hostname: inventory.yourdomain.com
    service: http://localhost:80
  - service: http_status:404
```

### Health Checks

Add health check configuration to your tunnel:

```yaml
tunnel: <YOUR_TUNNEL_ID>
credentials-file: /home/<YOUR_USERNAME>/.cloudflared/<YOUR_TUNNEL_ID>.json

warp-routing:
  enabled: false

ingress:
  - hostname: pantrie.yourdomain.com
    service: http://localhost:80
    originRequest:
      connectTimeout: 30s
      noTLSVerify: false
  - service: http_status:404
```

## References

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [cloudflared GitHub](https://github.com/cloudflare/cloudflared)
