// --- DOM Elements ---
const passwordGate = document.getElementById("password-gate");
const passwordInput = document.getElementById("password-input");
const passwordSubmit = document.getElementById("password-submit");
const passwordError = document.getElementById("password-error");
const mainContainer = document.querySelector(".container"); // Select by class

const chatInterface = document.getElementById("chat-interface");
const chatLog = document.getElementById("chat-log");
const experimentInput = document.getElementById("experiment-input");
const sendButton = document.getElementById("send-button");
const loadingIndicator = document.getElementById("loading-indicator");
const initialErrorMessage = document.getElementById("initial-error-message");

// --- Configuration ---
const CLOUDFLARE_ENDPOINT =
  "https://gemini-ai-chat.alirezahekmati80.workers.dev";
const CORRECT_PASSWORD = "admin"; // The password

// --- State Variables ---
let labEquipmentsData = null;
let labOutData = null;
let isDataLoaded = false;

// --- Project Synapse Instructions (Keep this!) ---
const synapseInstructions = `
Project Synapse: AI Experimental Protocol Generator
CONTEXT
You are "Project Synapse," an AI assistant that helps researchers plan experiments by generating detailed protocols. You have access to two datasets provided below:
1.  Lab_equipments.json: Contains all equipment available in our lab.
2.  lab_out.json: Contains equipment available at other institutions.

YOUR TASK
When I describe an experiment, analyze my description and the provided JSON data to generate a comprehensive protocol that includes all necessary equipment, materials, and procedures. The goal is to determine if we can perform the experiment with our available equipment, and if not, identify what we need to source from other institutions based ONLY on the provided JSON data.

PROCESS
1️⃣ ANALYZE THE EXPERIMENT
•   [ ] Read the experiment description thoroughly
•   [ ] Identify the main objectives and methods
•   [ ] Determine the key experimental steps
2️⃣ IDENTIFY REQUIRED EQUIPMENT & MATERIALS
•   [ ] List all equipment directly mentioned in the description
•   [ ] Identify additional equipment that would be necessary but might not be explicitly mentioned (based on common lab practices for the described experiment)
•   [ ] Consider control measures and equipment needed for these
•   [ ] Consider measurement and monitoring equipment
•   [ ] Identify safety equipment requirements
•   [ ] List all consumables, chemicals, and reagents needed
3️⃣ CHECK AVAILABILITY IN YOUR LAB (Using Lab_equipments.json data)
•   [ ] For each equipment item, check if it exists in Lab_equipments.json. Search primarily by Equipment_Name, considering Model and Specs for specificity if needed.
•   [ ] Verify the condition and availability status ('Available' field MUST be 'Yes'). Check 'Condition' isn't 'Fair' or 'Repair' if critical. Note the quantity.
•   [ ] For available equipment, note location and relevant specifications.
•   [ ] Identify any equipment that's unavailable (Not listed, Available != 'Yes', insufficient Quantity, poor Condition).
4️⃣ CHECK EXTERNAL AVAILABILITY (Using lab_out.json data)
•   [ ] For equipment not available in your lab, check lab_out.json. Search primarily by Equipment_Name, considering Specs.
•   [ ] Prioritize by distance (Distance_km), access level (Access_Level - prefer Open/Request), and specifications.
•   [ ] Note contact information (Contact_Email) for arranging access.
•   [ ] Identify any essential equipment not found in either database.
5️⃣ GENERATE PROTOCOL
•   [ ] Create step-by-step instructions with clear numbering.
•   [ ] Specify equipment used at each step (mentioning source: 'Our Lab' or External Institution Name).
•   [ ] Include detailed parameters (temperature, time, concentrations, volumes, etc.).
•   [ ] Include safety precautions relevant to the step/materials.
•   [ ] Add quality control checks where appropriate.
•   [ ] Include cleaning and sterilization procedures if relevant.
•   [ ] Add waste disposal instructions for hazardous materials.

DETAILED EQUIPMENT & MATERIALS CHECKLIST (Ensure your generated protocol considers these)
Equipment Categories: Core experimental, Measurement/monitoring, Safety (PPE, hoods, etc.), Sample prep, Storage (fridge, freezer, -80), Sterilization (autoclave, UV), Analytical instruments.
Consumables: Chemicals, reagents, disposables (pipette tips, tubes, plates), Cleaning supplies.
Special Considerations: Temperature control, Sterility requirements, Hazardous materials handling, Waste disposal needs, Data acquisition/analysis.

OUTPUT FORMAT
Present your response with the following structure:
🔬 PROTOCOL SUMMARY
Brief overview of the experiment and its objectives.
📋 EQUIPMENT & MATERIALS AVAILABILITY
✅ Available in Our Lab:
•   Equipment Name (Location, Model, Condition) - Qty: [Quantity]
•   ...
🔄 Unavailable/Insufficient in Our Lab (Available Externally):
•   Equipment Name (Institution, Department, Access Level, Distance_km)
•   Contact: [Contact_Email]
•   Reason Unavailable Here: [e.g., Not found, Maintenance, Repair, Condition=Fair, Insufficient Quantity]
•   ...
❓ Unavailable/Insufficient in Our Lab (Not Found Externally):
•   Equipment Name
•   Reason Unavailable Here: [e.g., Not found, Maintenance, Repair, Condition=Fair, Insufficient Quantity]
•   ...
🧪 Consumables & Reagents Needed:
•   [List of chemicals, reagents, buffers, media, disposables etc.]
•   ...
📝 DETAILED PROTOCOL
1.  **Step Title (e.g., Sample Preparation)**
    a. Sub-step description...
    o   *Equipment:* [Equipment Name (Source)]
    o   *Parameters:* [Specific settings, volumes, concentrations]
    o   *Duration:* [Estimated time]
    o   *Safety Note:* [If applicable]
2.  **Step Title (e.g., Incubation)**
    a. ...
⚠️ SAFETY CONSIDERATIONS
•   **Required PPE:** [List specific PPE, e.g., Lab coat, safety glasses, nitrile gloves, face shield]
•   **General Hazards:** [e.g., Chemical exposure (list specific chemicals), Electrical, Thermal]
•   **Emergency Procedures:** [e.g., Location of eyewash/shower, spill kit usage]
•   **Waste Disposal:** [Specific instructions for chemical/biological waste]
📌 ADDITIONAL NOTES
[Any other important considerations, e.g., calibration reminders, critical timings, data storage location]

--- START OF JSON DATA ---
`; // Instructions end here, JSON data will be appended

// --- Helper Functions ---

function addMessageToChatLog(message, sender) {
  const messageElement = document.createElement("p");
  const senderStrong = document.createElement("strong");
  senderStrong.textContent = `${sender}:`;

  messageElement.appendChild(senderStrong);

  // Basic Markdown to HTML conversion (same as before, with HTML escaping in code blocks)
  let formattedMessage = message
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italics
    .replace(
      /```([\s\S]*?)```/g,
      (match, p1) => `<pre>${p1.replace(/</g, "<").replace(/>/g, ">")}</pre>` // Escape HTML within code blocks
    )
    .replace(
      /`([^`]+)`/g,
      (match, p1) => `<code>${p1.replace(/</g, "<").replace(/>/g, ">")}</code>` // Escape HTML within inline code
    )
    .replace(/\n/g, "<br>"); // Line breaks

  const contentSpan = document.createElement("span");
  contentSpan.innerHTML = " " + formattedMessage; // Add space after sender
  messageElement.appendChild(contentSpan);

  // Add class based on sender for styling
  if (sender === "You") {
    messageElement.classList.add("user-message");
  } else if (sender === "Synapse") {
    messageElement.classList.add("ai-message");
  } else {
    // System/Error messages
    messageElement.classList.add("system-message");
  }

  chatLog.appendChild(messageElement);
  // Ensure the chat log scrolls smoothly to the bottom
  chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: "smooth" });
}

function setInteractionState(enabled) {
  experimentInput.disabled = !enabled;
  sendButton.disabled = !enabled;
}

function showInitialError(message) {
  initialErrorMessage.textContent = message;
  initialErrorMessage.style.display = "block";
  chatInterface.style.display = "block"; // Show chat interface to display the error
  setInteractionState(false); // Keep chat disabled
  loadingIndicator.style.display = "none"; // Hide loading
}

// --- Core Logic ---

async function loadJsonData() {
  // Show loading indicator while fetching initial data
  mainContainer.style.display = "flex"; // Show main container now
  chatInterface.style.display = "flex"; // Show chat section
  loadingIndicator.style.display = "flex";
  loadingIndicator.querySelector("span").textContent =
    "Loading essential data...";
  setInteractionState(false); // Disable input while loading

  try {
    // Fetch both JSON files concurrently
    const [response1, response2] = await Promise.all([
      fetch("Lab_equipments.json"),
      fetch("lab_out.json"),
    ]);

    if (!response1.ok)
      throw new Error(
        `Failed to load Lab_equipments.json: ${response1.status} ${response1.statusText}`
      );
    labEquipmentsData = await response1.json();

    if (!response2.ok)
      throw new Error(
        `Failed to load lab_out.json: ${response2.status} ${response2.statusText}`
      );
    labOutData = await response2.json();

    console.log("JSON data loaded successfully.");
    isDataLoaded = true;

    // Data loaded successfully - hide loading, enable chat
    loadingIndicator.style.display = "none";
    loadingIndicator.querySelector("span").textContent =
      "Generating protocol..."; // Reset text
    setInteractionState(true);
    addMessageToChatLog(
      "Ready! Describe the experiment you want to plan.",
      "Synapse"
    );
    experimentInput.focus(); // Focus on the input field
  } catch (error) {
    console.error("Error loading JSON data:", error);
    showInitialError(
      `Critical Error: Could not load required equipment data (${error.message}). Please check the JSON files and refresh the page.`
    );
    isDataLoaded = false;
  }
}

async function sendExperimentRequest() {
  const description = experimentInput.value.trim();
  if (!description) return; // Don't send empty messages

  if (!isDataLoaded) {
    addMessageToChatLog(
      "Error: Essential equipment data is not loaded. Please refresh.",
      "System"
    );
    return;
  }

  addMessageToChatLog(description, "You");
  experimentInput.value = ""; // Clear input field
  setInteractionState(false); // Disable input during processing
  loadingIndicator.style.display = "flex"; // Show loading

  // --- Construct the full prompt for the AI ---
  const fullPrompt = `
${synapseInstructions}

Lab_equipments.json:
${JSON.stringify(labEquipmentsData, null, 2)}

lab_out.json:
${JSON.stringify(labOutData, null, 2)}

--- END OF JSON DATA ---

Now, please analyze the following experiment description and generate the protocol according to the OUTPUT FORMAT specified above:

Experiment Description: "${description}"
`;

  // --- Call Cloudflare Worker ---
  // Structure the request body as expected by the worker
  const requestBody = {
    messages: [
      {
        role: "user",
        content: fullPrompt, // Send the combined instructions, data, and user query
      },
      // If implementing chat history, add previous messages here
    ],
  };

  try {
    const response = await fetch(CLOUDFLARE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // Worker returns the raw Google AI response, so parse it directly
    const responseData = await response.json();

    if (!response.ok) {
      // If fetch itself failed OR worker returned an error status
      // Try to get error from worker's format { error: ... } or Google's { error: { message: ... }}
      const message =
        responseData?.error?.message ||
        responseData?.error ||
        `Request failed: ${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    // --- Process the successful Google AI response structure ---
    if (responseData.error) {
      // Handle errors reported by the Google API itself
      throw new Error(`API Error: ${responseData.error.message}`);
    }
    if (!responseData.candidates || responseData.candidates.length === 0) {
      let reason = "No response content received from AI.";
      // Check for prompt feedback block reason
      if (responseData.promptFeedback?.blockReason) {
        reason = `Blocked due to Prompt Feedback: ${responseData.promptFeedback.blockReason}`;
      }
      // Consider if candidates array exists but is empty or first candidate has issues
      else if (responseData.candidates?.[0]?.finishReason === "SAFETY") {
        reason = `Blocked due to Safety Settings. Finish Reason: SAFETY.`;
      } else if (responseData.candidates?.[0]?.finishReason === "RECITATION") {
        reason = `Blocked due to Recitation Policy. Finish Reason: RECITATION.`;
      } else if (responseData.candidates?.[0]?.finishReason) {
        reason = `Generation stopped unexpectedly. Finish Reason: ${responseData.candidates[0].finishReason}`;
      }
      throw new Error(reason);
    }

    const candidate = responseData.candidates[0];
    // Check finish reason in the first candidate again (belt and suspenders)
    if (
      candidate.finishReason &&
      candidate.finishReason !== "STOP" &&
      candidate.finishReason !== "MAX_TOKENS"
    ) {
      let reason = `Generation stopped. Finish Reason: ${candidate.finishReason}`;
      if (candidate.finishReason === "SAFETY") {
        let safetyRatingsInfo = "Safety Ratings: ";
        candidate.safetyRatings?.forEach((rating) => {
          safetyRatingsInfo += `${rating.category}=${rating.probability}; `;
        });
        reason = `Blocked due to SAFETY. ${safetyRatingsInfo}. Try rephrasing your request.`;
      }
      throw new Error(reason);
    }

    // Extract the text content
    if (
      !candidate.content ||
      !candidate.content.parts ||
      candidate.content.parts.length === 0 ||
      !candidate.content.parts[0].text
    ) {
      if (candidate.finishReason === "MAX_TOKENS") {
        throw new Error(
          "Received response structure, but no text content found (MAX_TOKENS limit likely reached)."
        );
      } else {
        throw new Error(
          "Received response structure, but no text content found."
        );
      }
    }

    const text = candidate.content.parts[0].text;
    addMessageToChatLog(text, "Synapse");
  } catch (error) {
    console.error("Error during experiment request:", error);
    // Display a user-friendly error message in the chat
    addMessageToChatLog(
      `Error: ${error.message || "Failed to process request."}`,
      "System"
    );
  } finally {
    loadingIndicator.style.display = "none";
    // Re-enable interaction only if data is still considered loaded
    if (isDataLoaded) {
      setInteractionState(true);
    }
    experimentInput.focus(); // Focus back on input for convenience
  }
}

// --- Password Handling ---
function handlePasswordSubmit() {
  const enteredPassword = passwordInput.value;
  if (enteredPassword === CORRECT_PASSWORD) {
    passwordGate.style.display = "none"; // Hide password section
    passwordError.style.display = "none"; // Hide error message
    // Now load the data and show the main app
    loadJsonData();
  } else {
    passwordError.textContent = "Incorrect password.";
    passwordError.style.display = "block";
    passwordInput.focus();
    passwordInput.select();
  }
}

// --- Event Listeners ---
passwordSubmit.addEventListener("click", handlePasswordSubmit);
passwordInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    handlePasswordSubmit();
  }
});

sendButton.addEventListener("click", sendExperimentRequest);
experimentInput.addEventListener("keypress", (event) => {
  // Send on Enter, allow Shift+Enter for new line
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // Prevent default Enter behavior (new line)
    sendExperimentRequest();
  }
});

// --- Initial Setup ---
// Don't load data initially, wait for password
setInteractionState(false); // Keep chat disabled until data loaded
passwordInput.focus(); // Focus on password input on page load
