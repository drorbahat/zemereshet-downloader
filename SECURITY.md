# 🔒 Security

## Security Features

This application includes several security measures:

### 1. Authentication
- **HTTP Basic Authentication** protects all routes
- Default credentials should be changed before deployment
- Credentials configurable via environment variables (.env file)

### 2. Path Traversal Protection
- User-provided folder paths are validated
- Path traversal attempts (`../`, etc.) are blocked
- Only absolute paths starting with `/` are allowed

### 3. SSRF Protection
- Only requests to `zemereshet.co.il` are allowed
- URL validation prevents requests to internal services
- Hostname verification ensures no redirect attacks

### 4. Input Validation
- All user inputs are validated and sanitized
- Type checking on all parameters
- Malicious characters in filenames are removed

## Security Considerations

### ⚠️ Important Notes

1. **HTTP vs HTTPS**
   - This application uses HTTP by default
   - Credentials are sent in Base64 encoding (NOT encrypted in transit)
   - For production use over the internet, consider:
     - Using a reverse proxy (nginx) with HTTPS/SSL
     - Using Tailscale for encrypted connections
     - Setting up Let's Encrypt for free SSL certificates

2. **Default Credentials**
   - Default username: `zemereshet`
   - Default password: `download2026`
   - **MUST be changed before exposing to the internet**

3. **File System Access**
   - The application can write to any directory the user specifies
   - Ensure the server process runs with limited permissions
   - Do not run as root

4. **Rate Limiting**
   - Currently no rate limiting is implemented
   - Consider adding rate limiting for production deployments
   - This prevents abuse and DoS attacks

## Recommended Setup for Production

### Option 1: Behind Reverse Proxy (Most Secure)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 2: Tailscale (Zero Configuration)

- Install Tailscale on your server and devices
- Access via Tailscale IP (e.g., `100.x.x.x`)
- All traffic is automatically encrypted
- No port forwarding needed
- No SSL certificates needed

### Option 3: Local Network Only

- Don't expose to the internet at all
- Access only from your local network
- Still protected by authentication
- Safest option

## Changing Credentials

### Method 1: Environment Variables (Recommended)

Create a `.env` file:
```bash
AUTH_USERNAME=your_secure_username
AUTH_PASSWORD=your_secure_password
```

Then restart the server:
```bash
pm2 restart zemereshet-downloader
```

### Method 2: System Environment

Set system environment variables:
```bash
export AUTH_USERNAME=your_secure_username
export AUTH_PASSWORD=your_secure_password
```

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** open a public issue
2. Email the repository owner directly
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Checklist for Deployment

- [ ] Change default credentials
- [ ] Use `.env` file for credentials (never commit to git)
- [ ] Run server with non-root user
- [ ] Set up firewall rules (only allow necessary ports)
- [ ] Consider using HTTPS (nginx + Let's Encrypt)
- [ ] OR use Tailscale for encrypted access
- [ ] Keep Node.js and dependencies updated
- [ ] Monitor server logs for suspicious activity
- [ ] Restrict folder write permissions
- [ ] Consider adding rate limiting

## What's Protected

✅ **Protected:**
- All routes require authentication
- Path traversal attacks blocked
- SSRF attacks prevented
- Invalid URLs rejected
- Malicious filenames sanitized

⚠️ **Not Protected (by default):**
- Credentials sent over HTTP (not encrypted)
- No rate limiting
- No brute force protection
- No logging of failed attempts

## Additional Security Measures

### Add Rate Limiting

Install express-rate-limit:
```bash
npm install express-rate-limit
```

Add to server.js:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### Add Request Logging

Install morgan:
```bash
npm install morgan
```

Add to server.js:
```javascript
const morgan = require('morgan');
app.use(morgan('combined'));
```

### Run with Limited User

```bash
# Create a dedicated user
sudo useradd -r -s /bin/false zemereshet

# Change ownership
sudo chown -R zemereshet:zemereshet ~/zemereshet-downloader

# Run with PM2 as that user
pm2 start server.js --name zemereshet-downloader --user zemereshet
```

## Stay Updated

- Regularly check for dependency updates: `npm outdated`
- Update dependencies: `npm update`
- Review npm audit: `npm audit`
- Keep Node.js updated

---

**Remember:** Security is a process, not a product. Always assess your specific threat model and apply appropriate measures.
