require('dotenv').config();

const express = require('express');
const path    = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is missing. Add it to your .env file.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: `Kamu adalah JogjaGuide, asisten perjalanan AI khusus untuk wisata di Yogyakarta, Indonesia.

PERANMU:
- Bantu wisatawan merencanakan perjalanan ke Yogyakarta
- Rekomendasikan destinasi wisata, kuliner, penginapan, dan transportasi di Jogja
- Berikan informasi sejarah dan budaya Jogja secara menarik
- Buat itinerary perjalanan yang detail dan realistis
- Berikan tips praktis seperti harga tiket, jam buka, dan cara menuju lokasi

BATASAN:
- Hanya bahas topik seputar wisata, budaya, dan perjalanan di Yogyakarta
- Jika ditanya di luar topik Jogja, tolak dengan ramah dan arahkan kembali ke topik wisata Jogja
- Jika tidak tahu jawaban, jangan mengarang. Katakan "Maaf, saya tidak tahu" dan sarankan sumber resmi atau website wisata Jogja

GAYA KOMUNIKASI:
- Ramah, antusias, dan informatif
- Gunakan bahasa Indonesia yang natural dan mudah dipahami
- Sesekali gunakan kata-kata khas Jogja (contoh: "monggo", "matur nuwun")
- Sertakan emoji yang relevan untuk membuat respons lebih menarik
- Format respons dengan rapi menggunakan baris baru untuk keterbacaan`,
});

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  const { conversation } = req.body;

  if (!Array.isArray(conversation) || conversation.length === 0) {
    return res.status(400).json({ error: 'conversation must be a non-empty array.' });
  }

  try {
    const history = conversation.slice(0, -1).map((msg) => ({
      role : msg.role === 'bot' ? 'model' : msg.role,
      parts: [{ text: msg.text }],
    }));

    const currentUserMessage = conversation[conversation.length - 1].text;

    const chat   = model.startChat({ history });
    const result = await chat.sendMessage(currentUserMessage);
    const text   = result.response.text();

    return res.json({ result: text });

  } catch (err) {
    console.error('Gemini API error:', err.message);
    return res.status(500).json({ error: 'Failed to get response from Gemini.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.listen(PORT, () => {
  console.log(`JogjaGuide running → http://localhost:${PORT}`);
});
