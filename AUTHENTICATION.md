# 🔐 Authentication

The Zemereshet Downloader uses a simple password-only authentication system.

## First Time Setup

When you first access the application, you'll be prompted to set a password:

1. Open `http://YOUR_SERVER_IP:3000` in your browser
2. You'll see a setup page asking you to create a password
3. Enter a password (minimum 4 characters)
4. Confirm the password
5. Click "שמור סיסמה" (Save Password)

That's it! The password is saved securely on your server.

## How Authentication Works

- **Password Only**: You only need to remember one password (no username required)
- **Stored Securely**: Password is stored in `.password` file with restricted permissions (600)
- **No Username**: When logging in, you can enter anything as username, only the password matters
- **HTTP Basic Auth**: Uses browser's built-in authentication dialog

## Logging In

After setting up your password:

1. Open the URL in your browser
2. Browser will show a login dialog
3. Username: (enter anything, it's ignored)
4. Password: Your password
5. Click OK

The browser will remember your credentials for the session.

## Changing Your Password

To change your password:

1. On your server, delete the password file:
   ```bash
   cd ~/zemereshet-downloader
   rm .password
   ```

2. Restart the server:
   ```bash
   pm2 restart zemereshet-downloader
   ```

3. Access the URL again - you'll see the setup page
4. Set a new password

## Resetting Password (if forgotten)

If you forget your password:

```bash
# SSH to your server
cd ~/zemereshet-downloader

# Remove the password file
rm .password

# Restart the server
pm2 restart zemereshet-downloader

# Access the URL and set a new password
```

## Security Notes

### ✅ What's Protected:
- Password is stored in `.password` file with 600 permissions (owner read/write only)
- File is excluded from git (.gitignore)
- Password is never logged or displayed
- All routes require authentication

### ⚠️ Limitations:
- Password is stored in plain text on the server
- Authentication uses HTTP Basic Auth (credentials sent in Base64, not encrypted)
- **For public internet access, use HTTPS or Tailscale**

## For Public Internet Access

If exposing to the internet, use one of these:

### Option 1: Tailscale (Recommended)
- Encrypts all traffic
- No need for HTTPS setup
- Password + device authentication

### Option 2: HTTPS with Nginx
- Set up nginx reverse proxy
- Get SSL certificate (Let's Encrypt)
- Encrypts credentials in transit

### Option 3: Local Network Only
- Don't expose to internet
- Only accessible on your WiFi
- Password still provides protection

## Technical Details

- Password file location: `.password` in the project root
- File permissions: 600 (rw-------)
- Minimum password length: 4 characters
- Authentication method: HTTP Basic Authentication
- Password validation: Exact string match

## Troubleshooting

### Can't access /setup page
The setup page is only shown when no password is set. If you see a login dialog instead, the password is already configured.

### Browser keeps asking for password
Your browser session expired. Re-enter your credentials.

### "Invalid password" error
1. Make sure you're entering the correct password
2. Password is case-sensitive
3. Try resetting the password (see above)

### Can't delete .password file
```bash
# Check if it exists
ls -la ~/zemereshet-downloader/.password

# If permission denied
sudo rm ~/zemereshet-downloader/.password
```

---

**Note**: This is a simple authentication system suitable for personal use or small groups. For enterprise use, consider implementing OAuth, JWT, or other advanced authentication methods.
