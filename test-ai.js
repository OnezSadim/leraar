const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

async function testGemini() {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
        console.error('No API key found in .env.local');
        return;
    }
    console.log('Testing key:', key.substring(0, 10) + '...');

    try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent('Say hello!');
        const response = await result.response;
        console.log('Success!', response.text());
    } catch (error) {
        console.error('Test Failed:', error);
    }
}

testGemini();
