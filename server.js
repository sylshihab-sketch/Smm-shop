const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// আপনার Bot Token
const BOT_TOKEN = "8934648475:AAGPf3Bu8PKppn_8RY4gmutvqwm9eyrJy2A";

app.post('/verify-telegram', async (req, res) => {
    const { userId, chatId } = req.body;

    if (!userId || !chatId) {
        return res.status(400).json({ isJoined: false, message: "Missing data" });
    }

    try {
        // Telegram API Call
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
        const data = await response.json();

        if (data.ok) {
            const status = data.result.status;
            // ব্যবহারকারী যদি চ্যানেল বা গ্রুপে যুক্ত থাকে
            if (['member', 'administrator', 'creator'].includes(status)) {
                return res.json({ isJoined: true });
            }
        }
        return res.json({ isJoined: false });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ isJoined: false, error: "Server error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));