# NGINX Proxy Manager

NGINX Proxy Manager (NPM) is a user-friendly web interface for managing reverse proxy configurations with automatic SSL certificate generation via Let's Encrypt. It's an excellent choice for users who want more control than Cloudflare Tunnels while maintaining ease of use.

## What is NGINX Proxy Manager?

NGINX Proxy Manager provides:

- **Web-based GUI**: No need to edit configuration files manually
- **Automatic SSL**: Free Let's Encrypt SSL certificates with automatic renewal
- **Access Control**: Built-in authentication and IP whitelisting
- **Custom Locations**: Advanced routing rules and custom nginx configurations
- **Multiple Services**: Manage multiple reverse proxy hosts from one interface

## Prerequisites

- A domain name with DNS pointing to your server's public IP
- Port 80 and 443 open on your firewall/router
- Docker and Docker Compose installed
- Pantrie running via Docker Compose

## Installation

### Option 1: Separate Docker Compose (Recommended)

Create a separate `docker-compose.yml` for NGINX Proxy Manager in its own directory:

```yaml
version: '3.8'

services:
  app:
    image: 'jc21/nginx-proxy-manager:latest'
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - '80:80'      # HTTP
      - '443:443'    # HTTPS
      - '81:81'      # Admin UI
    environment:
      DB_MYSQL_HOST: "db"
      DB_MYSQL_PORT: 3306
      DB_MYSQL_USER: "npm"
      DB_MYSQL_PASSWORD: "npm"
      DB_MYSQL_NAME: "npm"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    depends_on:
      - db

  db:
    image: 'jc21/mariadb-aria:latest'
    container_name: nginx-proxy-manager-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: 'npm'
      MYSQL_DATABASE: 'npm'
      MYSQL_USER: 'npm'
      MYSQL_PASSWORD: 'npm'
    volumes:
      - ./mysql:/var/lib/mysql

networks:
  default:
    name: nginx-proxy-manager
```

Start NGINX Proxy Manager:

```bash
docker-compose up -d
```

### Option 2: Integrated with Pantrie

You can integrate NPM into Pantrie's docker-compose.yml, but you'll need to:

1. Remove the nginx service from Pantrie's docker-compose.yml
2. Change Pantrie's backend and frontend to not expose ports publicly
3. Add NGINX Proxy Manager to the same compose file

!!! warning "Port Conflicts"
    If you integrate NPM with Pantrie, make sure to remove port 80 from Pantrie's nginx service to avoid conflicts.

## Initial Configuration

### 1. Access the Admin Panel

Navigate to `http://your-server-ip:81`

Default credentials:
- Email: `admin@example.com`
- Password: `changeme`

!!! danger "Change Default Credentials"
    Immediately change the default email and password after first login!

### 2. Update Your Pantrie Docker Compose

Modify Pantrie's `docker-compose.yml` to remove port 80 from nginx (since NPM will handle external traffic):

```yaml
# In your Pantrie docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    container_name: pantrie-nginx
    # Remove the ports section or change to:
    # ports:
    #   - "8080:80"  # Use a different port for direct access
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
      - frontend
    networks:
      - pantrie-network
      - nginx-proxy-manager  # Add this network

networks:
  pantrie-network:
    driver: bridge
  nginx-proxy-manager:
    external: true
```

Recreate the containers:

```bash
docker-compose up -d
```

## Configure Proxy Host

### 1. Add a Proxy Host

In the NGINX Proxy Manager UI:

1. Click **Hosts** → **Proxy Hosts**
2. Click **Add Proxy Host**

### 2. Details Tab

Configure the following:

- **Domain Names**: `pantrie.yourdomain.com`
- **Scheme**: `http`
- **Forward Hostname / IP**:
  - If using separate compose: Your server's IP or `host.docker.internal`
  - If integrated: `pantrie-nginx` (the container name)
- **Forward Port**: `80` (or `8080` if you changed it)
- **Block Common Exploits**: ✅ Enabled
- **Websockets Support**: ✅ Enabled (recommended for future features)

### 3. SSL Tab

Configure SSL certificate:

- **SSL Certificate**: Select "Request a new SSL Certificate"
- **Force SSL**: ✅ Enabled
- **HTTP/2 Support**: ✅ Enabled
- **HSTS Enabled**: ✅ Enabled (recommended)
- **Email Address**: Your email for Let's Encrypt notifications
- **I Agree to the Let's Encrypt Terms of Service**: ✅

Click **Save**

### 4. Advanced Tab (Optional)

Add custom nginx configuration if needed:

```nginx
# Increase timeouts for large uploads
client_max_body_size 50M;
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;

# Additional headers
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

## Update Vite Configuration

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
cd /path/to/pantrie
docker-compose restart frontend
```

## Access Your Instance

You should now be able to access Pantrie at `https://pantrie.yourdomain.com`!

## Troubleshooting

### 502 Bad Gateway

Common causes:

1. **Wrong Forward Port**: Verify you're using the correct port (80 or 8080)
2. **Container Not Running**: Check Pantrie is running: `docker-compose ps`
3. **Network Issues**: Ensure NPM can reach Pantrie's network
4. **Nginx Not Started**: Check nginx logs: `docker logs pantrie-nginx`

### SSL Certificate Failed

1. Verify DNS is pointing to your public IP
2. Ensure ports 80 and 443 are open and forwarded
3. Check Let's Encrypt rate limits (5 certificates per domain per week)
4. Review NPM logs: `docker logs nginx-proxy-manager`

### Cannot Access NPM Admin Panel

- Verify NPM is running: `docker ps | grep nginx-proxy-manager`
- Check port 81 is not blocked by firewall
- Try accessing via localhost: `http://localhost:81`

### Vite Host Blocking Error

If you see "Blocked request. This host is not allowed":

1. Add your domain to `allowedHosts` in `frontend/vite.config.ts`
2. Restart the frontend container: `docker-compose restart frontend`

## Security Best Practices

### 1. Secure the Admin Panel

- Use a strong password
- Consider changing the admin port from 81 to something non-standard
- Add IP whitelist to the admin panel
- Use Cloudflare or another DDoS protection service

### 2. Enable Access Lists

NPM supports access lists for additional authentication:

1. Go to **Access Lists**
2. Create a new list with authentication requirements
3. Apply it to your Pantrie proxy host

### 3. Regular Updates

Keep NGINX Proxy Manager updated:

```bash
docker-compose pull
docker-compose up -d
```

### 4. Backup Configuration

Regularly backup the NPM data directory:

```bash
tar -czf npm-backup-$(date +%Y%m%d).tar.gz ./data ./letsencrypt
```

## Advanced Configuration

### Custom 404 Pages

Create a custom 404 page for proxy hosts:

1. Go to **404 Hosts**
2. Add your 404 page configuration

### Stream Configuration (TCP/UDP)

NPM supports TCP/UDP streams for non-HTTP services:

1. Go to **Streams**
2. Configure TCP/UDP forwarding rules

### Custom Locations

Add custom location blocks for specific paths:

1. Edit your Proxy Host
2. Go to **Custom Locations** tab
3. Add location-specific configurations

Example: Serve static files from a different location:

```
Location: /static/
Forward Hostname: static-file-server
Forward Port: 8080
```

## Monitoring

### View Logs

Access NPM logs:

```bash
docker logs -f nginx-proxy-manager
```

### Access Logs

NPM stores access logs in the data directory:

```bash
tail -f ./data/logs/proxy-host-*.log
```

### Certificate Renewal

Certificates auto-renew 30 days before expiration. Check certificate status in the UI:

1. Go to **SSL Certificates**
2. View expiration dates and renewal status

## Comparison: NPM vs Cloudflare Tunnels

| Feature | NGINX Proxy Manager | Cloudflare Tunnels |
|---------|-------------------|-------------------|
| **Setup Complexity** | Medium | Easy |
| **Port Forwarding Required** | Yes (80, 443) | No |
| **DDoS Protection** | No (unless behind CDN) | Yes |
| **SSL Management** | Manual (Let's Encrypt) | Automatic |
| **Multiple Services** | Excellent | Good |
| **Custom Configuration** | Full control | Limited |
| **Cost** | Free | Free |
| **Best For** | Power users, multiple services | Simple setups, home users |

## References

- [NGINX Proxy Manager Documentation](https://nginxproxymanager.com/guide/)
- [NGINX Proxy Manager GitHub](https://github.com/NginxProxyManager/nginx-proxy-manager)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
