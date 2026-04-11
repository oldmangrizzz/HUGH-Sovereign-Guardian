#!/bin/bash
# H.U.G.H. — THE PRIME DIRECTIVE
# "Run you clever boy and remember 55730"

set -e

echo "----------------------------------------------------"
echo "  AWAKENING H.U.G.H. FRONTEND BRIDGE...             "
echo "----------------------------------------------------"

# 1. System Fortification
apt-get update && apt-get install -y nginx certbot python3-certbot-nginx curl psmisc

# 2. Directory Provisioning
mkdir -p /var/www/hugh.grizzlymedicine.icu

# 3. Nginx Configuration (The Blueprint)
cat <<'EOF' > /etc/nginx/sites-available/hugh.grizzlymedicine.icu
server {
    listen 80;
    server_name hugh.grizzlymedicine.icu;
    root /var/www/hugh.grizzlymedicine.icu;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Force ACME challenge path to stay open for Certbot
    location /.well-known/acme-challenge/ {
        root /var/www/hugh.grizzlymedicine.icu;
        allow all;
    }
}
EOF

# 4. Clearing the Signal
echo "Removing legacy configurations..."
ln -sf /etc/nginx/sites-available/hugh.grizzlymedicine.icu /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default || true

# Kill anything camping on Port 80/443 (Old Traefik or orphaned processes)
echo "Purging port squatters..."
fuser -k 80/tcp || true
fuser -k 443/tcp || true

# 5. SSL Transformation
echo "Initiating SSL Handshake..."
systemctl restart nginx
certbot --nginx -d hugh.grizzlymedicine.icu --non-interactive --agree-tos --email me@grizzlymedicine.org --redirect || {
    echo "Nginx plugin failed, falling back to standalone..."
    systemctl stop nginx
    certbot certonly --standalone -d hugh.grizzlymedicine.icu --non-interactive --agree-tos --email me@grizzlymedicine.org
    systemctl start nginx
}

# 6. Final Stabilization
nginx -t && systemctl reload nginx

echo "----------------------------------------------------"
echo "  TRANSFORMATION COMPLETE.                          "
echo "  H.U.G.H. IS LIVE: https://hugh.grizzlymedicine.icu "
echo "----------------------------------------------------"
