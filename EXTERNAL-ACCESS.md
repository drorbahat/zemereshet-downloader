# 🌍 External Access Setup

This guide will help you access your Zemereshet Downloader from anywhere on the internet, without Tailscale.

## Current Access:

- **Local network:** `http://YOUR_SERVER_IP:3000` (find with `hostname -I`)
- **Tailscale (from anywhere):** `http://YOUR_TAILSCALE_IP:3000` (if configured)

## To Access from Anywhere (Without Tailscale):

You need to set up **port forwarding** on your home router.

### Step 1: Find Your Public IP Address

On your server, run:
```bash
curl ifconfig.me
```

This is the IP address your friends will use to access your server from the internet.

### Step 2: Set Up Port Forwarding on Your Router

You need to configure your router to forward incoming traffic on port 3000 to your server.

**General steps (varies by router):**

1. Open your router's admin panel (usually at `http://192.168.1.1` or `http://192.168.0.1`)
2. Log in with your router credentials
3. Find the **Port Forwarding** section (might be called "Virtual Server", "NAT", or "Applications")
4. Add a new port forwarding rule:
   - **Service Name:** Zemereshet Downloader
   - **External Port:** 3000 (or any port you want, e.g., 8080)
   - **Internal IP:** Your server's local IP (find with `hostname -I` on your server)
   - **Internal Port:** 3000
   - **Protocol:** TCP
5. Save and apply the settings

**Router-specific guides:**
- Google your router model + "port forwarding" for specific instructions
- Common router brands: TP-Link, Netgear, Linksys, ASUS, D-Link

### Step 3: Access from Anywhere

Once port forwarding is set up:

```
http://YOUR_PUBLIC_IP:3000
```

For example: `http://123.45.67.89:3000`

**Share this URL with friends!**

---

## Important Security Considerations

⚠️ **Opening your server to the internet has security risks.** Here are some recommendations:

### Option 1: Add Basic Authentication (Recommended)

Protect your app with a username/password. I can help you add this to the server code.

### Option 2: Use a Different External Port

Instead of exposing port 3000 directly, forward a different port:
- External port: `8765` (or any random port)
- Internal port: `3000`
- Access via: `http://YOUR_PUBLIC_IP:8765`

This provides "security through obscurity" (not foolproof, but better than nothing).

### Option 3: Set Up Nginx with HTTPS (Advanced)

For proper security:
1. Get a domain name (e.g., from Cloudflare, Namecheap)
2. Use Cloudflare's free plan for SSL/TLS
3. Set up nginx reverse proxy
4. Get a Let's Encrypt certificate

### Option 4: Use Tailscale (Easiest & Most Secure)

Tailscale is already running on your server! Just install it on your devices:
- **Mac:** Download from [tailscale.com](https://tailscale.com)
- **iPhone/iPad:** Install from App Store
- **Android:** Install from Play Store
- **Windows:** Download from tailscale.com

Then access via: `http://YOUR_TAILSCALE_IP:3000` from anywhere!

---

## Dynamic IP Problem

Most home internet connections have a **dynamic IP** that changes periodically.

### Solutions:

#### Option A: Dynamic DNS (DDNS)
Free services that give you a domain name that always points to your IP:
- **DuckDNS** (free, simple): https://www.duckdns.org
- **No-IP** (free): https://www.noip.com
- **Dynu** (free): https://www.dynu.com

After setting up DDNS, you'll get a domain like:
```
http://mydownloader.duckdns.org:3000
```

#### Option B: Check Your ISP
Some ISPs offer static IP addresses for a small monthly fee.

---

## Troubleshooting

### Can't access from outside:
1. Verify port forwarding is set up correctly
2. Check if your ISP blocks incoming connections (some do for residential plans)
3. Make sure your server's firewall allows port 3000:
   ```bash
   sudo ufw allow 3000
   ```
4. Test if port is open: https://www.yougetsignal.com/tools/open-ports/

### Connection is slow:
- Your upload speed affects how fast friends can download
- Consider downloading files to a shared folder instead

### Friends can't access:
- Double-check you gave them the correct public IP
- Make sure you used `curl ifconfig.me` to get the right public IP
- Verify port forwarding is enabled

---

## Recommended Setup for Sharing with Friends

**Best approach:**

1. **Use Tailscale** (easiest and most secure)
   - You and your friends install Tailscale
   - Share the Tailscale URL: `http://YOUR_TAILSCALE_IP:3000`
   - No port forwarding needed
   - Encrypted connection
   - Works from anywhere

2. **OR: Port forwarding + DDNS**
   - Set up port forwarding with a non-standard port (e.g., 8765)
   - Use DuckDNS for a friendly domain name
   - Share: `http://mydownloader.duckdns.org:8765`
   - Consider adding basic authentication

3. **OR: Just give them your public IP**
   - Set up port forwarding
   - Share: `http://YOUR_PUBLIC_IP:3000`
   - Check/update the IP if it changes

---

## Need Help?

I can assist you with:
- Adding username/password authentication
- Setting up nginx with HTTPS
- Configuring DDNS
- Any other security improvements

Just let me know what you'd like to do!
