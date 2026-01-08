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

// Setup page - shown only when password is not set
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
    <title>🔐 הגדרת סיסמה</title>
    <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Heebo', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: white;
            border-radius: 24px;
            padding: 45px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { font-size: 32px; margin-bottom: 10px; color: #333; text-align: center; }
        p { color: #666; margin-bottom: 30px; text-align: center; line-height: 1.6; }
        input {
            width: 100%;
            padding: 18px 22px;
            border: 2px solid #e0e0e0;
            border-radius: 14px;
            font-size: 16px;
            margin-bottom: 20px;
            font-family: inherit;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }
        button {
            width: 100%;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 14px;
            font-size: 20px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6); }
        .error { color: #c62828; background: #ffebee; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
        .error.show { display: block; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🔐 ברוך הבא!</h1>
        <p>זו הפעם הראשונה שאתה משתמש במורד זמרשת.<br>אנא הגדר סיסמה לאבטחת המערכת.</p>
        <div class="error" id="error"></div>
        <input type="password" id="password" placeholder="הזן סיסמה" autofocus>
        <input type="password" id="confirm" placeholder="אימות סיסמה">
        <button onclick="setupPassword()">💾 שמור סיסמה</button>
    </div>
    <script>
        async function setupPassword() {
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirm').value;
            const error = document.getElementById('error');

            if (!password || password.length < 4) {
                error.textContent = '❌ הסיסמה חייבת להיות לפחות 4 תווים';
                error.classList.add('show');
                return;
            }

            if (password !== confirm) {
                error.textContent = '❌ הסיסמאות לא תואמות';
                error.classList.add('show');
                return;
            }

            try {
                const response = await fetch('/api/setup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                if (response.ok) {
                    window.location.href = '/';
                } else {
                    error.textContent = '❌ שגיאה בהגדרת הסיסמה';
                    error.classList.add('show');
                }
            } catch (e) {
                error.textContent = '❌ שגיאת רשת';
                error.classList.add('show');
            }
        }

        document.getElementById('confirm').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') setupPassword();
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

// Password authentication middleware
app.use((req, res, next) => {
    // Allow setup endpoints
    if (req.path === '/setup' || req.path === '/api/setup') {
        return next();
    }

    // Redirect to setup if no password is set
    if (!isPasswordSet()) {
        if (req.path === '/' || req.path.startsWith('/api/')) {
            return res.redirect('/setup');
        }
        return next();
    }

    // Check authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Zemereshet Downloader"');
        return res.status(401).send('Authentication required');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const pass = auth[1] || auth[0]; // Support both "user:pass" and just "pass"

    if (pass === getPassword()) {
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="Zemereshet Downloader"');
        return res.status(401).send('Invalid password');
    }
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

        // Good practice: listen for errors on response too
        res.on('error', (err) => {
            console.error('Response error:', err);
        });

        // Pipe archive to response
        const pipe = archive.pipe(res);

        // Listen for when pipe finishes
        pipe.on('finish', () => {
            console.log(`📦 Pipe finished: ${zipFilename}`);
        });

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

        // Finalize the archive and wait for RESPONSE to finish (not just archive)
        await new Promise((resolve, reject) => {
            // Wait for response to finish sending all data
            res.on('finish', () => {
                console.log(`✅ Response fully sent: ${zipFilename}`);
                resolve();
            });

            res.on('close', () => {
                console.log(`🔌 Response connection closed: ${zipFilename}`);
            });

            archive.on('error', reject);

            // Start finalizing the archive
            archive.finalize();
            console.log(`📦 Archive finalize started: ${zipFilename}`);
        });

        console.log(`📦 ZIP download complete: ${zipFilename}`);

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
