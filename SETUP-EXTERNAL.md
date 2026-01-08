# 🔐 External Access Setup - Complete Guide

Your Zemereshet Downloader now has password protection! Here's how to set it up for external access.

## Current Status

✅ Password authentication is enabled
✅ Server is running on your home server
✅ Tailscale access available (if configured)

## Default Credentials

**Username:** `zemereshet`
**Password:** `download2026`

**⚠️ IMPORTANT:** Change these credentials before exposing to the internet!

## Step 1: Change Your Password (Recommended)

On your server, create a `.env` file:

```bash
cd ~/zemereshet-downloader
nano .env
```

Add your custom credentials:
```
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_secure_password
```

Save (Ctrl+X, Y, Enter) and restart:
```bash
pm2 restart zemereshet-downloader
```

## Step 2: Get Your Public IP

On your server:
```bash
curl ifconfig.me
```

Save this IP address - you'll need it for step 3.

## Step 3: Set Up Port Forwarding

You need to configure your router. Here's how:

### Access Your Router

1. Open a browser and go to your router's IP (usually one of these):
   - `http://192.168.1.1`
   - `http://192.168.0.1`
   - `http://10.0.0.1`

2. Log in with your router credentials

### Add Port Forwarding Rule

Look for: **Port Forwarding**, **Virtual Server**, **NAT**, or **Applications**

Add a new rule:
- **Service/Application Name:** Zemereshet
- **External Port:** 3000 (or use a random port like 8765 for extra security)
- **Internal IP Address:** Your server's local IP (e.g., `192.168.1.100`)
- **Internal Port:** 3000
- **Protocol:** TCP or Both
- **Enable:** Yes/On

Save and apply the settings.

### Test Port Forwarding

From another device NOT on your WiFi (use mobile data), try accessing:
```
http://YOUR_PUBLIC_IP:3000
```

You should see a login prompt. Enter your username and password.

## Step 4: Set Up Dynamic DNS (Optional but Recommended)

Your public IP might change. Get a free domain name:

### Using DuckDNS (Recommended - Free & Simple)

1. Go to https://www.duckdns.org
2. Sign in with Google/GitHub
3. Create a subdomain (e.g., `mydownloader`)
4. You'll get: `mydownloader.duckdns.org`
5. Follow DuckDNS instructions to set up auto-update on your server

Now you can access via:
```
http://mydownloader.duckdns.org:3000
```

### Update Script for DuckDNS

On your server:
```bash
# Install DuckDNS update script
mkdir -p ~/duckdns
cd ~/duckdns
echo 'echo url="https://www.duckdns.org/update?domains=YOUR_DOMAIN&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -' > duck.sh
chmod 700 duck.sh

# Test it
./duck.sh
cat duck.log  # Should show "OK"

# Add to crontab (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -
```

Replace `YOUR_DOMAIN` and `YOUR_TOKEN` with values from DuckDNS website.

## Step 5: Share with Friends

Send them:
- **URL:** `http://YOUR_PUBLIC_IP:3000` or `http://your-domain.duckdns.org:3000`
- **Username:** (whatever you set)
- **Password:** (whatever you set)

## Security Notes

✅ **What's Protected:**
- Password required for all access
- Only works if friends have the password
- Password can be changed anytime

⚠️ **Limitations:**
- This is HTTP (not HTTPS) - credentials are not encrypted in transit
- For better security, consider using Tailscale instead

## Troubleshooting

### Can't access from outside:
```bash
# On your server, check if firewall is blocking:
sudo ufw status
sudo ufw allow 3000  # If needed
```

### Forgot password:
```bash
# On your server:
cd ~/zemereshet-downloader
rm .env  # This will revert to defaults
pm2 restart zemereshet-downloader
# Default credentials: zemereshet / download2026
```

### Want to disable authentication:
Remove or comment out the authentication middleware in `server.js` (not recommended for public access).

## Alternative: Use Tailscale (Most Secure)

Instead of port forwarding, use Tailscale:

1. Install Tailscale on all your devices
2. Access: `http://YOUR_TAILSCALE_IP:3000`
3. No port forwarding needed
4. Encrypted connection
5. No password needed (device authentication)

**Install Tailscale:**
- **Mac/iOS:** App Store
- **Android:** Play Store
- **Windows/Linux:** https://tailscale.com/download

## Current Access Methods Summary

| Method | URL | Security | Setup Difficulty |
|--------|-----|----------|-----------------|
| Local Network | `http://SERVER_LOCAL_IP:3000` | Password | ✅ Done |
| Tailscale | `http://TAILSCALE_IP:3000` | Password + Device Auth | If configured |
| Public Internet | `http://YOUR_PUBLIC_IP:3000` | Password | ⏳ Needs port forwarding |
| DuckDNS | `http://your-domain.duckdns.org:3000` | Password | ⏳ Needs setup |

---

Need help? Let me know and I can guide you through any step!
