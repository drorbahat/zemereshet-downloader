require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Basic authentication credentials (change these!)
const USERNAME = process.env.AUTH_USERNAME || 'zemereshet';
const PASSWORD = process.env.AUTH_PASSWORD || 'download2026';

app.use(express.json());

// Basic authentication middleware
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Zemereshet Downloader"');
        return res.status(401).send('Authentication required');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user === USERNAME && pass === PASSWORD) {
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="Zemereshet Downloader"');
        return res.status(401).send('Invalid credentials');
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

// API endpoint to download song
app.post('/api/download', async (req, res) => {
    try {
        const { url, folder } = req.body;

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

        if (!folder || typeof folder !== 'string') {
            return res.status(400).json({ error: 'נתיב תיקייה חסר' });
        }

        // Remove quotes if user pasted with quotes
        const cleanFolder = folder.replace(/^['"]|['"]$/g, '');

        // Security: Validate folder path - prevent path traversal
        const resolvedFolder = path.resolve(cleanFolder);

        // Check for path traversal attempts
        if (cleanFolder.includes('..') || !resolvedFolder.startsWith('/')) {
            return res.status(400).json({ error: 'נתיב תיקייה לא חוקי' });
        }
        
        console.log(`📥 Downloading: ${url}`);
        console.log(`📁 Target folder: ${resolvedFolder}`);

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

        // Create folder for this song
        const cleanSongTitle = songTitle.replace(/[<>:"/\\|?*]/g, '_');
        const songFolderPath = path.join(resolvedFolder, cleanSongTitle);
        
        console.log(`📁 Song folder will be: ${songFolderPath}`);

        // Create directory if it doesn't exist
        if (!fs.existsSync(resolvedFolder)) {
            console.log(`📁 Creating base folder: ${resolvedFolder}`);
            fs.mkdirSync(resolvedFolder, { recursive: true });
        } else {
            console.log(`✅ Base folder exists: ${resolvedFolder}`);
        }
        
        if (!fs.existsSync(songFolderPath)) {
            console.log(`📁 Creating song folder: ${songFolderPath}`);
            fs.mkdirSync(songFolderPath, { recursive: true });
        } else {
            console.log(`✅ Song folder exists: ${songFolderPath}`);
        }
        
        console.log(`✅ Folder created successfully!`);
        
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
        
        // Save metadata file
        const metadataPath = path.join(songFolderPath, 'מידע_על_השיר.txt');
        fs.writeFileSync(metadataPath, metadata, 'utf8');
        console.log(`📄 Created metadata file`);
        
        // Download all MP3s
        let successCount = 0;
        for (let i = 0; i < recordings.length; i++) {
            const rec = recordings[i];
            const paddedNum = String(i + 1).padStart(2, '0');
            
            // Full Hebrew filename
            const cleanPerformer = rec.performer.replace(/[<>:"/\\|?*]/g, '_');
            const filename = rec.year ? 
                `${paddedNum} - ${cleanSongTitle} - ${cleanPerformer} ${rec.year}.mp3` :
                `${paddedNum} - ${cleanSongTitle} - ${cleanPerformer}.mp3`;
            
            const filePath = path.join(songFolderPath, filename);
            
            try {
                console.log(`⏳ [${i + 1}/${recordings.length}] ${rec.performer}`);
                console.log(`   URL: ${rec.url}`);
                console.log(`   File will be saved to: ${filePath}`);
                
                const mp3Response = await axios.get(rec.url, {
                    responseType: 'arraybuffer',
                    timeout: 60000
                });
                
                console.log(`   Downloaded ${mp3Response.data.byteLength} bytes`);
                
                if (mp3Response.data.byteLength > 1000) {
                    // Save file directly
                    fs.writeFileSync(filePath, Buffer.from(mp3Response.data));
                    console.log(`   ✅ File saved successfully!`);
                    
                    // Verify file exists
                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        console.log(`   ✅ File verified! Size: ${stats.size} bytes`);
                        successCount++;
                    } else {
                        console.log(`   ❌ File NOT found after save!`);
                    }
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
        
        // Send success response
        res.json({
            success: true,
            songTitle: songTitle,
            totalCount: recordings.length,
            successCount: successCount,
            folderPath: songFolderPath
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
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
