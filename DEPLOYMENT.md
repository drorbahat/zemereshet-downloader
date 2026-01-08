# 🚀 Deploying to Your Home Server

This guide will help you deploy the Zemereshet Downloader to your home server so you can access it from anywhere.

## Step 1: Connect to Your Server

```bash
server
```

## Step 2: Clone the Repository

```bash
cd ~  # or wherever you want to install it
git clone https://github.com/YOUR_USERNAME/zemereshet-downloader.git
cd zemereshet-downloader
```

## Step 3: Install Dependencies

Make sure Node.js and npm are installed on your server:

```bash
node --version  # Should be v14 or higher
npm --version
```

If not installed, install Node.js first, then install the project dependencies:

```bash
npm install
```

## Step 4: Configure the Server Port

By default, the app runs on port 3000. You can change this in `server.js` line 9 if needed:

```javascript
const PORT = 3000;  // Change to any port you prefer
```

## Step 5: Start the Server

### Option A: Run Directly (For Testing)
```bash
node server.js
```

### Option B: Run with PM2 (Recommended - Keeps Running)

Install PM2 (process manager):
```bash
sudo npm install -g pm2
```

Start the application:
```bash
pm2 start server.js --name zemereshet-downloader
```

Useful PM2 commands:
```bash
pm2 status                    # Check status
pm2 logs zemereshet-downloader # View logs
pm2 restart zemereshet-downloader  # Restart
pm2 stop zemereshet-downloader     # Stop
pm2 startup                   # Auto-start on server reboot
pm2 save                      # Save current process list
```

## Step 6: Access from Anywhere

### Find Your Server's IP Address
On your server, run:
```bash
hostname -I  # or: ifconfig | grep "inet "
```

### Access the Application

**From your local network:**
```
http://YOUR_SERVER_IP:3000
```

Example: `http://192.168.1.100:3000`

### Access from Outside Your Network (Optional)

To access from anywhere on the internet, you need to:

1. **Set up port forwarding** on your router:
   - Forward external port (e.g., 3000) to your server's IP and port 3000
   - Refer to your router's manual for instructions

2. **Find your public IP**:
   ```bash
   curl ifconfig.me
   ```

3. **Access via**:
   ```
   http://YOUR_PUBLIC_IP:3000
   ```

4. **Security Recommendations**:
   - Use a reverse proxy (nginx) with HTTPS
   - Set up authentication
   - Use a dynamic DNS service if your IP changes
   - Consider using Tailscale or ZeroTier for secure access

## Step 7: Configure Download Path

Edit the default download path in `public/index.html` line 246 to match a path on your server:

```html
<input
    type="text"
    id="folderInput"
    value="/home/yourusername/Music/Zemereshet"
    placeholder="/home/yourusername/Music/Zemereshet"
/>
```

Make sure this directory exists:
```bash
mkdir -p /home/yourusername/Music/Zemereshet
```

## Updating the Application

When you make changes to the code:

```bash
cd ~/zemereshet-downloader
git pull
npm install  # If dependencies changed
pm2 restart zemereshet-downloader
```

## Troubleshooting

**Cannot access from other devices:**
- Check firewall: `sudo ufw allow 3000`
- Verify server is running: `pm2 status`
- Check server IP is correct

**Downloads fail:**
- Verify the download folder path exists
- Check folder permissions: `chmod 755 /path/to/downloads`
- Check logs: `pm2 logs zemereshet-downloader`

**Port already in use:**
- Change PORT in `server.js`
- Or kill the process using the port: `lsof -ti:3000 | xargs kill`

## Advanced: Nginx Reverse Proxy (Optional)

For a cleaner URL and HTTPS support:

1. Install nginx:
```bash
sudo apt install nginx
```

2. Create config:
```bash
sudo nano /etc/nginx/sites-available/zemereshet
```

3. Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # or server IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/zemereshet /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Now access via: `http://your-domain.com` or `http://YOUR_SERVER_IP`
