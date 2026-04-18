# AI Chatbot

A clean, modern AI chatbot powered by the Google Gemini API. This project demonstrates a full-stack application with a Node.js Express backend and a vanilla JavaScript frontend, providing a seamless conversational experience.

## Features

*   **Real-time Chat:** Instant messaging with AI responses.
*   **Google Gemini Integration:** Leverages the powerful Gemini API for intelligent conversations.
*   **Clean User Interface:** A modern and intuitive design for an enhanced user experience.
*   **Easy Setup:** Simple steps to get the chatbot up and running locally.

## Technologies Used

*   **Frontend:** HTML, CSS, JavaScript
*   **Backend:** Node.js, Express.js
*   **AI:** Google Gemini API

## Project Structure

```
ai-chatbot/
├── server/                 # Backend server with Node.js and Express.js
│   ├── index.js            # Main server file
│   ├── package.json        # Node.js dependencies
│   └── .env.example        # Example environment variables (API key)
├── public/                 # Frontend static files
│   ├── index.html          # Main chat interface
│   ├── style.css           # Styling for the application
│   └── app.js              # Frontend JavaScript logic
└── README.md               # Project documentation
```

## Setup Instructions

Follow these steps to set up and run the AI Chatbot locally:

### 1. Obtain a Google Gemini API Key

1.  Navigate to the [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Sign in with your Google account.
3.  Click on "Create API Key" to generate a new key.
4.  Copy the generated API key.

### 2. Install Dependencies

Open your terminal, navigate to the `server` directory, and install the required Node.js packages:

```bash
cd server
npm install
```

### 3. Configure Environment Variables

1.  Create a file named `.env` in the `server` directory.
2.  Add your Gemini API key to this file in the following format:

    ```
    GEMINI_API_KEY=your_gemini_api_key_here
    ```

    *Replace `your_gemini_api_key_here` with the API key you obtained in step 1.*

### 4. Run the Server

From the `server` directory, start the backend server:

```bash
npm start
```

### 5. Access the Application

Open your web browser and visit `http://localhost:3000` to interact with the AI Chatbot.
