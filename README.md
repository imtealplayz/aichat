[README.md](https://github.com/user-attachments/files/26469665/README.md)
# Bou Chatbot

A clean, modern AI chatbot powered by Google Gemini API.

## Project Structure
```
bou-chatbot/
├── server/
│   ├── index.js          # Express backend
│   ├── package.json
│   └── .env              # Your API key goes here (never commit this)
├── public/
│   ├── index.html        # Main chat page
│   ├── style.css         # All styles
│   └── app.js            # Frontend JS
└── README.md
```

## Setup Instructions

### 1. Get a free Gemini API key
- Go to https://aistudio.google.com/app/apikey
- Sign in with Google and click "Create API Key"
- Copy the key

### 2. Install dependencies
```bash
cd server
npm install
```

### 3. Add your API key
- Open `server/.env`
- Replace `your_gemini_api_key_here` with your actual key

### 4. Run the server
```bash
cd server
npm start
```

### 5. Open the app
- Visit http://localhost:3000 in your browser
