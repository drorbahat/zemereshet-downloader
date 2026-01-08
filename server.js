require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const app = express();
const PORT = 3000;

// Password file location
const PASSWORD_FILE = path.join(__dirname, '.password');

// Check if password is set
function isPasswordSet() {
    return fs.existsSync(PASSWORD_FILE);
}

// Get stored password
function getPassword() {
    if (!isPasswordSet()) return null;
    return fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
}

// Set password
function setPassword(password) {
    fs.writeFileSync(PASSWORD_FILE, password, 'utf8');
    fs.chmodSync(PASSWORD_FILE, 0o600); // Read/write only for owner
}

app.use(express.json());

// Setup page - modern UI
app.get('/setup', (req, res) => {
    if (isPasswordSet()) {
        return res.redirect('/');
    }

    res.send(`
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>מוריד זמרשת - הגדרה</title>
    <style>
        :root {
            --bg-color: #f5f5f7;
            --card-bg: rgba(255, 255, 255, 0.8);
            --text-color: #1d1d1f;
            --accent-color: #0071e3;
            --error-color: #ff3b30;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg-color: #000000;
                --card-bg: rgba(28, 28, 30, 0.8);
                --text-color: #f5f5f7;
            }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .card {
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 18px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.1);
            text-align: center;
        }
        h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        p {
            font-size: 15px;
            opacity: 0.8;
            margin-bottom: 30px;
            line-height: 1.4;
        }
        input {
            width: 100%;
            padding: 12px 16px;
            border-radius: 12px;
            border: 1px solid rgba(128,128,128, 0.2);
            font-size: 17px;
            margin-bottom: 16px;
            background: rgba(128,128,128, 0.1);
            color: inherit;
            outline: none;
            transition: all 0.2s;
        }
        input:focus {
            border-color: var(--accent-color);
            background: rgba(128,128,128, 0.05);
            box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.15);
        }
        button {
            width: 100%;
            padding: 12px;
            background: var(--accent-color);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 17px;
            font-weight: 500;
            cursor: pointer;
            transition: transform 0.1s;
        }
        button:active { transform: scale(0.98); }
        .error {
            color: var(--error-color);
            font-size: 14px;
            margin-bottom: 16px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>הגדרה ראשונית</h1>
        <p>ברוכים הבאים. אנא קבעו סיסמה למערכת.</p>
        <div id="error" class="error"></div>
        <input type="password" id="password" placeholder="סיסמה חדשה" autofocus>
        <input type="password" id="confirm" placeholder="אימות סיסמה">
        <button onclick="setup()">שמור והתחל</button>
    </div>
    <script>
        async function setup() {
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirm').value;
            const error = document.getElementById('error');

            if (!password || password.length < 4) {
                error.textContent = 'הסיסמה חייבת להיות לפחות 4 תווים';
                error.style.display = 'block';
                return;
            }
            if (password !== confirm) {
                error.textContent = 'הסיסמאות אינן תואמות';
                error.style.display = 'block';
                return;
            }

            try {
                const res = await fetch('/api/setup', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ password })
                });
                if (res.ok) {
                    window.location.href = '/login';
                } else {
                    const data = await res.json();
                    error.textContent = data.error || 'שגיאה';
                    error.style.display = 'block';
                }
            } catch (e) {
                error.textContent = 'שגיאת תקשורת';
                error.style.display = 'block';
            }
        }
        document.addEventListener('keypress', e => {
            if(e.key === 'Enter') setup();
        });
    </script>
</body>
</html>
    `);
});

// Setup API endpoint
app.post('/api/setup', (req, res) => {
    if (isPasswordSet()) {
        return res.status(403).json({ error: 'Password already set' });
    }

    const { password } = req.body;
    if (!password || password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    setPassword(password);
    res.json({ success: true });
});

// Login page
app.get('/login', (req, res) => {
    if (!isPasswordSet()) return res.redirect('/setup');
    const cookie = req.headers.cookie || '';
    if (cookie.includes('auth=')) return res.redirect('/');
    
    // Serve the login HTML file
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// APIs that don't need auth
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === getPassword()) {
        // Set a simple cookie (in a real app used securely, we'd use signed cookies, httpOnly, etc.)
        // This is a local-tool context, so simple is fine.
        res.cookie('auth', 'true', { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'סיסמה שגויה' });
    }
});

// Authentication middleware
app.use((req, res, next) => {
    // Public paths
    if (req.path === '/setup' || 
        req.path === '/api/setup' || 
        req.path === '/login' || 
        req.path === '/api/login') {
        return next();
    }

    // Redirect to setup if no password is set
    if (!isPasswordSet()) {
        return res.redirect('/setup');
    }

    // Check cookie
    // Note: We need to parse cookies manually since we didn't add cookie-parser
    const cookie = req.headers.cookie || '';
    if (cookie.includes('auth=true')) {
        return next();
    }

    // Check header auth (for backward comaptibility or API use if needed, can remove if we want strictly cookie)
    // But for now, let's just redirect to login for browser access
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.redirect('/login');
});

app.use(express.static('public'));

// Extract song data from HTML
function extractSongData(html) {
    const $ = cheerio.load(html);
    
    // Get song title
    const titleElem = $('h1.bigttl').first();
    const songTitle = titleElem.length ? titleElem.text().trim().split('\n')[0].trim() : 'שיר';
    
    // Extract all recordings
    const recordings = [];
    const scripts = $('script');
    const playerUrls = new Map();
    
    // Find all setJplayer calls
    scripts.each((i, script) => {
        const content = $(script).html() || '';
        const regex = /setJplayer\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            let url = match[2];
            
            // Fix URL
            if (url.startsWith('../')) {
                url = 'https://www.zemereshet.co.il' + url.substring(2);
            } else if (url.startsWith('/')) {
                url = 'https://www.zemereshet.co.il' + url;
            } else if (!url.startsWith('http')) {
                url = 'https://www.zemereshet.co.il/' + url;
            }
            
            // Clean double slashes
            url = url.replace(/([^:])\/{2,}/g, '$1/');
            
            playerUrls.set(match[1], url);
        }
    });
    
    // Extract performer info - store in array by order
    const perfDataArray = [];
    const foundPerfIds = new Set();
    
    // First, look for perf_details templates (most common)
    $('template[id^="perf_details_"]').each((i, template) => {
        const perfId = $(template).attr('id').replace('perf_details_', '');
        const templateHtml = $(template).html() || '';
        
        console.log(`   🔍 Found perf_details #${perfDataArray.length+1} (id=${perfId})`);
        foundPerfIds.add(perfId);
        
        // Extract performer from the div with class=""
        let performer = 'לא ידוע';
        
        // Try multiple patterns for performer
        const patterns = [
            /<b>ביצוע:<\/b>[\s\S]*?<a[^>]*>([^<]+)<\/a>/,
            /<b>נגינה:<\/b>[\s\S]*?<a[^>]*>([^<]+)<\/a>/,
            /<font color[^>]*><b>נגינה: <\/b><a[^>]*>([^<]+)<\/a>/
        ];
        
        for (const pattern of patterns) {
            const match = templateHtml.match(pattern);
            if (match) {
                performer = match[1].trim();
                console.log(`   ✅ Found performer: ${performer}`);
                break;
            }
        }
        
        // Now look for the perfdet inside this template
        const perfdetMatch = templateHtml.match(/<div id="perfdet\d+"[^>]*>([\s\S]*?)<\/div>/);
        const perfdetHtml = perfdetMatch ? perfdetMatch[1] : templateHtml;
        
        // Extract other data
        const data = extractPerformerData(perfdetHtml);
        data.performer = performer; // Override with what we found
        
        perfDataArray.push(data);
        console.log(`   📋 Stored data #${perfDataArray.length}: ${performer}`);
    });
    
    // Also check for standalone perfdet divs (without templates)
    $('[id^="perfdet"]').each((i, div) => {
        const perfId = $(div).attr('id').replace('perfdet', '');
        
        if (foundPerfIds.has(perfId)) {
            return; // Already processed
        }
        
        console.log(`   🔍 Found standalone perfdet #${perfDataArray.length+1} (id=${perfId})`);
        foundPerfIds.add(perfId);
        
        const perfDiv = $(div);
        const parentDiv = perfDiv.parent();
        const parentHtml = parentDiv.html() || '';
        const perfdetHtml = perfDiv.html() || '';
        
        // Extract performer from parent
        let performer = 'לא ידוע';
        const patterns = [
            /<b>ביצוע:<\/b>[\s\S]*?<a[^>]*>([^<]+)<\/a>/,
            /<b>נגינה:<\/b>[\s\S]*?<a[^>]*>([^<]+)<\/a>/,
            /<font color[^>]*><b>נגינה: <\/b><a[^>]*>([^<]+)<\/a>/
        ];
        
        for (const pattern of patterns) {
            const match = parentHtml.match(pattern);
            if (match) {
                performer = match[1].trim();
                console.log(`   ✅ Found performer: ${performer}`);
                break;
            }
        }
        
        const data = extractPerformerData(perfdetHtml);
        data.performer = performer;
        
        perfDataArray.push(data);
        console.log(`   📋 Stored data #${perfDataArray.length}: ${performer}`);
    });
    
    // Helper function to extract performer data
    function extractPerformerData(htmlContent) {
    let performer = 'לא ידוע';
    let year = '';
    let composer = '';
    let poet = '';
    let source = '';
    let soloist = '';
    let album = '';
    let notes = '';
    
    // Extract performer
    let performerMatch = htmlContent.match(/<b>ביצוע:<\/b>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    if (!performerMatch) {
        performerMatch = htmlContent.match(/<b>נגינה:<\/b>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    }
    // Also try font color format
    if (!performerMatch) {
        performerMatch = htmlContent.match(/<font color[^>]*><b>נגינה: <\/b><a[^>]*>([^<]+)<\/a>/);
    }
    if (performerMatch) {
        performer = performerMatch[1].trim();
    }
    
    // Extract year
    const yearMatch = htmlContent.match(/<b>שנת הקלטה:<\/b>\s*([^<]+)/);
    if (yearMatch) {
        const yearText = yearMatch[1].trim();
        const yearNum = yearText.match(/\d{4}/);
        if (yearNum) {
            year = yearNum[0];
        }
    }
    
    // Extract composer
    const composerMatch = htmlContent.match(/<b>לחן:<\/b>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    if (composerMatch) {
        composer = composerMatch[1].trim();
    }
    
    // Extract poet
    const poetMatch = htmlContent.match(/<b>מילים:<\/b>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    if (poetMatch) {
        poet = poetMatch[1].trim();
    }
    
    // Extract source
    const sourceMatch = htmlContent.match(/<b>מקור:<\/b>\s*([^<]+?)(?:<br|<\/)/i);
    if (sourceMatch) {
        source = sourceMatch[1].trim().replace(/&nbsp;/g, ' ');
    }
    
    // Extract soloist
    const soloistMatch = htmlContent.match(/<b>סולן:<\/b>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    if (soloistMatch) {
        soloist = soloistMatch[1].trim();
    }
    
    // Extract album
    const albumMatch = htmlContent.match(/<b>אלבום:<\/b>\s*([^<]+?)(?:<br|<\/)/i);
    if (albumMatch) {
        album = albumMatch[1].trim().replace(/&nbsp;/g, ' ');
    }
    
    // Extract notes
    const notesMatch = htmlContent.match(/<b>הערות:<\/b>\s*([^<]+?)(?:<br|<\/)/i);
    if (notesMatch) {
        notes = notesMatch[1].trim().replace(/&nbsp;/g, ' ');
    }
    
    // Extract arranger (עיבוד)
    const arrangerMatch = htmlContent.match(/<b>עיבוד:<\/b>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    if (arrangerMatch && !notes) {
        notes = `עיבוד: ${arrangerMatch[1].trim()}`;
    }
    
    return { 
        performer, 
        year, 
        composer, 
        poet, 
        source, 
        soloist, 
        album, 
        notes 
    };
}
    
    // Combine data - match by order
    let recordingIndex = 0;
    playerUrls.forEach((url, playerId) => {
        const perfData = perfDataArray[recordingIndex] || { 
            performer: 'לא ידוע', 
            year: '',
            composer: '',
            poet: '',
            source: '',
            soloist: '',
            album: '',
            notes: ''
        };
        
        recordingIndex++;
        
        recordings.push({
            url: url,
            performer: perfData.performer,
            year: perfData.year,
            composer: perfData.composer,
            poet: perfData.poet,
            source: perfData.source,
            soloist: perfData.soloist,
            album: perfData.album,
            notes: perfData.notes,
            index: recordingIndex
        });
    });
    
    return { songTitle, recordings };
}

// API endpoint to download song as ZIP
app.post('/api/download', async (req, res) => {
    try {
        const { url } = req.body;

        // Validate URL - only allow zemereshet.co.il
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'קישור לא תקין' });
        }

        try {
            const urlObj = new URL(url);
            if (urlObj.hostname !== 'www.zemereshet.co.il' && urlObj.hostname !== 'zemereshet.co.il') {
                return res.status(400).json({ error: 'ניתן להוריד רק מזמרשת' });
            }
        } catch (e) {
            return res.status(400).json({ error: 'קישור לא תקין' });
        }

        console.log(`📥 Downloading: ${url}`);

        // Fetch the page - Zemereshet now uses UTF-8!
        const response = await axios.get(url, {
            timeout: 30000
        });

        const html = response.data;

        // Log sample to verify encoding
        const titleMatch = html.match(/<h1[^>]*class="bigttl"[^>]*>([^<]+)</);
        if (titleMatch) {
            console.log('📄 Found title:', titleMatch[1].trim());
        }

        // Extract data
        const { songTitle, recordings } = extractSongData(html);

        if (recordings.length === 0) {
            return res.status(404).json({ error: 'לא נמצאו הקלטות' });
        }

        console.log(`🎵 Song: ${songTitle}, Recordings: ${recordings.length}`);

        // Create safe filename for ZIP
        const cleanSongTitle = songTitle.replace(/[<>:"/\\|?*]/g, '_');
        const zipFilename = `${cleanSongTitle}.zip`;

        // Set response headers for ZIP download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`);

        // Create ZIP archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        // Handle archive errors
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            throw err;
        });

        // Set response headers BEFORE piping
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`);
        res.setHeader('Transfer-Encoding', 'chunked');

        // Good practice: listen for errors on response too
        res.on('error', (err) => {
            console.error('Response error:', err);
        });

        // Pipe archive to response
        archive.pipe(res);

        // Create metadata file
        let metadata = `🎵 שם השיר: ${songTitle}\n`;
        metadata += `מספר הקלטות: ${recordings.length}\n`;
        metadata += `הורדה מאתר: https://www.zemereshet.co.il\n`;
        metadata += `תאריך הורדה: ${new Date().toLocaleString('he-IL')}\n`;
        metadata += `\n${'═'.repeat(60)}\n\n`;
        
        recordings.forEach((rec, i) => {
            const paddedNum = String(i + 1).padStart(2, '0');
            
            metadata += `📀 הקלטה ${paddedNum}:\n`;
            metadata += `   🎤 ביצוע: ${rec.performer}\n`;
            if (rec.year) metadata += `   📅 שנה: ${rec.year}\n`;
            if (rec.composer) metadata += `   🎼 לחן: ${rec.composer}\n`;
            if (rec.poet) metadata += `   ✍️  מילים: ${rec.poet}\n`;
            if (rec.source) metadata += `   📚 מקור: ${rec.source}\n`;
            if (rec.soloist) metadata += `   🎙️  סולן: ${rec.soloist}\n`;
            if (rec.album) metadata += `   💿 אלבום: ${rec.album}\n`;
            if (rec.notes) metadata += `   📝 הערות: ${rec.notes}\n`;
            
            // File name
            const displayName = rec.year ? 
                `${paddedNum} - ${songTitle} - ${rec.performer} ${rec.year}` :
                `${paddedNum} - ${songTitle} - ${rec.performer}`;
            metadata += `   💾 שם קובץ: ${displayName}.mp3\n`;
            
            if (i < recordings.length - 1) {
                metadata += `\n${'-'.repeat(60)}\n\n`;
            }
        });
        
        // Add metadata file to ZIP
        archive.append(metadata, { name: 'מידע_על_השיר.txt' });
        console.log(`📄 Added metadata file to ZIP`);

        // Download all MP3s and add to ZIP
        let successCount = 0;
        for (let i = 0; i < recordings.length; i++) {
            const rec = recordings[i];
            const paddedNum = String(i + 1).padStart(2, '0');

            // Full Hebrew filename
            const cleanPerformer = rec.performer.replace(/[<>:"/\\|?*]/g, '_');
            const filename = rec.year ?
                `${paddedNum} - ${cleanSongTitle} - ${cleanPerformer} ${rec.year}.mp3` :
                `${paddedNum} - ${cleanSongTitle} - ${cleanPerformer}.mp3`;

            try {
                console.log(`⏳ [${i + 1}/${recordings.length}] ${rec.performer}`);
                console.log(`   URL: ${rec.url}`);

                const mp3Response = await axios.get(rec.url, {
                    responseType: 'arraybuffer',
                    timeout: 60000
                });

                console.log(`   Downloaded ${mp3Response.data.byteLength} bytes`);

                if (mp3Response.data.byteLength > 1000) {
                    // Add file to ZIP
                    archive.append(Buffer.from(mp3Response.data), { name: filename });
                    console.log(`   ✅ Added to ZIP: ${filename}`);
                    successCount++;
                } else {
                    console.log(`⚠️  [${i + 1}/${recordings.length}] קובץ קטן מדי: ${mp3Response.data.byteLength} bytes`);
                }

                // Small delay
                if (i < recordings.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

            } catch (error) {
                console.error(`❌ [${i + 1}/${recordings.length}] ${rec.performer}: ${error.message}`);
            }
        }

        console.log(`\n✅ הושלם! ${successCount}/${recordings.length} קבצים\n`);

        // Finalize the archive - but DON'T exit the function immediately
        console.log(`📦 Starting archive finalization: ${zipFilename}`);
        archive.finalize();

        // Wait for BOTH archive end AND all data to be written to client
        await new Promise((resolve, reject) => {
            let archiveEnded = false;
            let pipeFinished = false;

            const checkBothDone = () => {
                console.log(`📊 Status check - Archive: ${archiveEnded}, Pipe: ${pipeFinished}`);
                if (archiveEnded && pipeFinished) {
                    // Add a delay to ensure TCP buffers are flushed
                    setTimeout(() => {
                        console.log(`✅ ZIP download complete: ${zipFilename}`);
                        resolve();
                    }, 500);
                }
            };

            archive.on('error', reject);

            archive.on('end', () => {
                console.log(`📦 Archive finalized all data`);
                archiveEnded = true;
                checkBothDone();
            });

            // The 'finish' event on res fires when the write buffer is empty
            res.on('finish', () => {
                console.log(`📦 Response finished sending`);
                pipeFinished = true;
                checkBothDone();
            });
        });

    } catch (error) {
        console.error('Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// Start server
app.listen(PORT, () => {
    console.log('\n🎵 ═══════════════════════════════════════════════');
    console.log('   מוריד זמרשת - פועל!');
    console.log('═══════════════════════════════════════════════\n');
    console.log(`   פתח בדפדפן: http://localhost:${PORT}`);
    console.log('\n═══════════════════════════════════════════════\n');
});
