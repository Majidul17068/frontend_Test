import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;
const TEST_USERNAME = process.env.REACT_APP_TEST_USERNAME;
const TEST_PASSWORD = process.env.REACT_APP_TEST_PASSWORD;

console.log('Environment Variables:', {
    API_URL,
    TEST_USERNAME,
    TEST_PASSWORD
});

const CareHomeChatbot = () => {
  const [conversation, setConversation] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [step, setStep] = useState("initial");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState(TEST_USERNAME);
  const [password, setPassword] = useState(TEST_PASSWORD);

  // Set up axios default authorization header when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsLoggedIn(true);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setIsLoggedIn(false);
    }
  }, [token]);

  const addMessageToConversation = (message, sender) => {
    setConversation(prev => [...prev, { sender, message }]);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        console.log('Login attempt with:', {
            username,
            password,
            url: `${API_URL}/token`
        });

        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        // Log the FormData contents
        for (let pair of formData.entries()) {
            console.log(pair[0] + ': ' + pair[1]);
        }

        const response = await axios.post(`${API_URL}/token`, formData);
        console.log('Login response:', response.data);
        
        const newToken = response.data.access_token;
        setToken(newToken);
        localStorage.setItem('token', newToken);
        setIsLoggedIn(true);
        
        // Clear login form
        setUsername("");
        setPassword("");
    } catch (error) {
        console.error('Login failed:', {
            error: error.response?.data || error.message,
            status: error.response?.status,
            headers: error.response?.headers
        });
        alert(`Login failed: ${error.response?.data?.detail || 'Please check your credentials.'}`);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setConversation([]);
    setStep("initial");
    setSessionId(null);
  };

  const startConversation = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/start`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Add first message immediately
      addMessageToConversation(response.data.message[0], "bot");

      // Add second message after 2 seconds
      setTimeout(() => {
        addMessageToConversation(response.data.message[1], "bot");
        setStep("nhs_id");
        setLoading(false);
      }, 2000);

    } catch (error) {
      if (error.response?.status === 401) {
        // Token expired or invalid
        handleLogout();
        alert('Session expired. Please login again.');
      } else {
        console.error("Error starting conversation:", error);
        addMessageToConversation("Sorry, there was an error starting the conversation.", "bot");
      }
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);

    const userInput = input.trim();
    setInput("");
    addMessageToConversation(userInput, "user");

    try {
      let response;
      if (step === "nhs_id") {
        response = await axios.post(`${API_URL}/start-conversation`, {
          nhs_id: userInput
        });
        setSessionId(userInput);
      } else {
        response = await axios.post(`${API_URL}/process-prompt`, {
          nhs_id: sessionId,
          prompt: userInput
        });
      }

      if (response.data.step === "options") {
        addMessageToConversation(response.data.message, "bot");
      } else if (response.data.step === "analysis") {
        if (response.data.analysis_result) {
          addMessageToConversation(response.data.analysis_result, "bot");
        }
        if (response.data.continue_question) {
          addMessageToConversation(response.data.continue_question, "bot");
        }
      } else if (response.data.step === "end") {
        addMessageToConversation(response.data.message, "bot");
        setSessionId(null);
        setStep("initial");
      }

      setStep(response.data.step);

    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
        alert('Session expired. Please login again.');
      } else {
        console.error("Error processing input:", error);
        addMessageToConversation("Sorry, there was an error processing your request.", "bot");
      }
    }
    setLoading(false);
  };

  // Login Form Component
  const LoginForm = () => (
    <form onSubmit={handleLogin} className="login-form">
      <div>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
        />
      </div>
      <div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
      </div>
      <button type="submit" disabled={loading}>
        {loading ? "Logging in..." : "Login"}
      </button>
    </form>
  );

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>Care Home Chatbot</h1>
        {isLoggedIn && (
          <button onClick={handleLogout} style={{ padding: "5px 10px" }}>
            Logout
          </button>
        )}
      </div>

      {!isLoggedIn ? (
        <LoginForm />
      ) : (
        <>
          {/* Start Conversation Button */}
          {!sessionId && step === "initial" && (
            <button 
              onClick={startConversation} 
              disabled={loading}
              style={{ marginBottom: "20px", padding: "10px 20px" }}
            >
              Start Conversation
            </button>
          )}

          {/* Conversation Display */}
          <div style={{ 
            marginTop: "20px", 
            maxHeight: "400px", 
            overflowY: "auto",
            border: "1px solid #ccc",
            padding: "10px",
            borderRadius: "5px"
          }}>
            {conversation.map((msg, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: msg.sender === "user" ? "#e3f2fd" : "#f5f5f5",
                  padding: "10px",
                  margin: "5px 0",
                  borderRadius: "5px",
                  textAlign: msg.sender === "user" ? "right" : "left",
                  maxWidth: "80%",
                  marginLeft: msg.sender === "user" ? "auto" : "0",
                  whiteSpace: "pre-wrap"
                }}
              >
                {msg.message}
              </div>
            ))}
          </div>

          {/* Input Field */}
          {((step === "nhs_id" || sessionId) && step !== "end") && !loading && (
            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={step === "nhs_id" ? "Enter NHS ID..." : "Type your message..."}
                style={{ flex: 1, padding: "10px", borderRadius: "5px" }}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                disabled={loading}
              />
              <button 
                onClick={handleSubmit}
                disabled={loading}
                style={{ padding: "10px 20px", borderRadius: "5px" }}
              >
                Send
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              Processing...
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CareHomeChatbot;
