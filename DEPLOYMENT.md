# Leo AI — Self-Hosting & Deployment Architecture Guide

This guide outlines security hardening, reverse proxy configuration, and firewall policies for deploying **Leo AI** on self-hosted infrastructure (e.g., Ubuntu/Debian server with DuckDNS).

---

## 1. Architecture Overview

```
[ Internet Traffic ]
        │
        ▼ (Port 80 / 443 only)
┌──────────────────────────────────────┐
│  Nginx / Caddy Reverse Proxy         │  <-- SSL Termination (Let's Encrypt / Certbot)
│  (DuckDNS: yourdomain.duckdns.org)   │  <-- Security Headers, Rate Limiting, CSP
└──────────────────┬───────────────────┘
                   │ Proxy Pass (http://127.0.0.1:3000)
                   ▼
┌──────────────────────────────────────┐
│  Leo AI Server (Node.js / Express)   │  <-- Bound to internal localhost:3000
│  • AI Routing & Multimodal Vision    │  <-- Bcrypt auth & HttpOnly cookies
│  • Memo API Long-Term Memory Cache   │  <-- Per-IP & Per-User Rate Limiting
│  • Firebase RTDB / Cloud Firestore   │
└──────────────────────────────────────┘
```

---

## 2. Firewall Hardening (UFW)

To secure the self-hosted server from unauthorized port scans or raw database/internal service exposure:

```bash
# 1. Enable UFW with default deny policy
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 2. Allow SSH (whitelist specific IP if static, or your designated SSH port)
sudo ufw allow 22/tcp comment 'SSH Access'

# 3. Allow only public HTTP and HTTPS ports for Web traffic
sudo ufw allow 80/tcp comment 'HTTP (Let'\''s Encrypt Verification)'
sudo ufw allow 443/tcp comment 'HTTPS Encrypted Web Traffic'

# 4. Ensure internal application ports (3000, 27017, etc.) remain closed to the public
sudo ufw deny 3000/tcp comment 'Block direct Node.js access'

# 5. Enable firewall
sudo ufw enable
sudo ufw status verbose
```

---

## 3. DuckDNS & SSL Automation

1. **Install DuckDNS Cron Job**:
   ```bash
   mkdir -p ~/duckdns
   cat << 'EOF' > ~/duckdns/duck.sh
   echo url="https://www.duckdns.org/update?domains=YOUR_DOMAIN&token=YOUR_DUCKDNS_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
   EOF
   chmod 700 ~/duckdns/duck.sh
   (crontab -l 2>/dev/null; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -
   ```

2. **Obtain Let's Encrypt Certificate**:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d YOUR_DOMAIN.duckdns.org
   ```

---

## 4. Nginx Reverse Proxy Configuration

Create `/etc/nginx/sites-available/leo-ai`:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.duckdns.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name YOUR_DOMAIN.duckdns.org;

    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN.duckdns.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Maximum upload size for multimodal vision/image queries
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket & Streaming support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Real client IP forwarding
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for real-time AI chunk streaming
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/leo-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Security Checklist

- [x] **No hardcoded secrets**: All API keys and credentials are loaded from environment variables (`.env`).
- [x] **Bcrypt password hashing**: Admin passwords and credentials support Bcrypt cryptographic hashing.
- [x] **Rate limiting**: Login endpoints protected against brute force (5 attempts / 15 mins). AI endpoints protected against bursts (30 burst / 30 min sustained).
- [x] **HttpOnly session cookies**: Session tokens stored with `HttpOnly`, `Secure`, and `SameSite: Lax` flags.
- [x] **Server-side invalidation**: Logout invalidates active tokens on the server.
- [x] **Security headers**: CSP, HSTS, X-Content-Type-Options, X-Frame-Options configured.
- [x] **Mobile accessibility**: Viewport permits standard user scaling and pinch-to-zoom.
