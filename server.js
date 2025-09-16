// server.js
import express from 'express';
import fs from 'fs';

const app = express();
const PORT = 5000;

app.use(express.json());

app.post('/api/validate', (req, res) => {
    const { key, hwid } = req.body;

    if (!key || !hwid) {
        return res.status(400).json({ success: false, message: 'Thiếu key hoặc HWID.' });
    }

    try {
        const dbPath = './db.json';
        if (!fs.existsSync(dbPath)) {
             return res.status(500).json({ success: false, message: 'Không tìm thấy cơ sở dữ liệu.' });
        }

        let db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        const keyIndex = db.keys.findIndex(k => k.key === key);

        if (keyIndex === -1) {
            return res.json({ success: false, message: 'Key không hợp lệ.' });
        }
        
        let keyData = db.keys[keyIndex];
        const apiData = db.apis.find(a => a.apiKey === keyData.api);

        if (!apiData || apiData.status !== 'active') {
            return res.json({ success: false, message: 'API của key này đã bị vô hiệu hóa.' });
        }

        if (keyData.status === 'banned') {
             const unbanDate = new Date(keyData.banInfo.unbanDate).toLocaleDateString('vi-VN');
            return res.json({ success: false, message: `Key đã bị khóa. Lý do: ${keyData.banInfo.reason}. Mở khóa vào: ${unbanDate}` });
        }
        
        if (!keyData.hwid) {
            keyData.hwid = hwid;
            keyData.firstLoginAt = new Date().toISOString();
            
            const duration = keyData.durationInDays || 0; 
            const firstLoginDate = new Date(keyData.firstLoginAt);
            const expiresDate = new Date(firstLoginDate.setDate(firstLoginDate.getDate() + duration));
            keyData.expiresAt = expiresDate.toISOString();
            
            db.keys[keyIndex] = keyData; 
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            
            return res.json({ 
                success: true, 
                message: `Xác thực lần đầu thành công! Key đã được kích hoạt và gán HWID. Hạn sử dụng là ${duration} ngày.`,
                expires: keyData.expiresAt
            });
        } 
        
        if (keyData.hwid !== hwid) {
            return res.json({ success: false, message: 'HWID không khớp. Vui lòng liên hệ admin để reset.' });
        }

        if (!keyData.expiresAt || new Date(keyData.expiresAt) < new Date()) {
            return res.json({ success: false, message: 'Key đã hết hạn sử dụng.' });
        }
        
        return res.json({ 
            success: true, 
            message: 'Xác thực thành công!',
            expires: keyData.expiresAt
         });

    } catch (error) {
        console.error('Lỗi server API:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server API đang chạy tại http://localhost:${PORT}`);
});
