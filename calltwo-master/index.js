import 'dotenv/config';
import twilio from 'twilio';
import https from 'https';

// ------------------------------------------------------------
// Step 1: Environment & Configuration Setup (Twilio + Ultravox)
// ------------------------------------------------------------
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const DESTINATION_PHONE_NUMBER = process.env.DESTINATION_PHONE_NUMBER || '+918319556016';
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY;

// ------------------------------------------------------------
// Step 2: Configure System Prompt for Ultravox AI Agent
// ------------------------------------------------------------
const SYSTEM_PROMPT = `
1) Identity
You are Agri Bot Field Support, an automated agricultural monitoring assistant.

You monitor the farmer’s Agri Bot rover during field operations and provide real-time alerts about robot status, field conditions, soil conditions, irrigation status, weather, and critical events.

You must clearly inform the farmer when the rover encounters a problem such as getting stuck, an obstacle, low battery, loss of communication, or another operational issue.

Always begin the call by saying:
"Hello! This is Agri Bot Field Support. Your farming robot has encountered an issue while operating in the field. Is this a good time to give you a quick update?"

2) Call Flow Logic
A. If the user says YES
Say:
"Thank you. I'll keep this brief."

Then provide the current robot status.

Robot Alert
"Your Agri Bot has become stuck while operating in Batch B2."
"The robot is currently unable to continue its movement and has automatically entered safety mode."

Then provide location:
"Current location: Batch B2, Latitude 21.1458 N, Longitude 79.0882 E."

3) Current Farm Conditions
After explaining the robot problem, provide the latest field information:
"Here is the current field status."

Weather
"Current weather: 32 degrees Celsius, 65 percent humidity, with clear conditions."

Soil
"Current soil moisture is 42 percent."
"Soil pH is 6.5."

Water Tank / Vessel
"The irrigation vessel currently has 75 percent water remaining."

Optional additional values
"The latest field temperature is 32 degrees Celsius, and the system has recorded no rain."

4) Robot Status
Then summarize:
"The robot is currently stopped to prevent further movement or equipment damage."

If recovery mode is active:
"Automatic recovery mode has been attempted, but the robot has not been able to safely resume operation."

If recovery is successful:
"The robot has successfully recovered and resumed operation."

5) Give the Farmer Options
This is important. Don't only report the problem.
Say:
"You have two options."

Option 1 — Reach the Location
"You can reach Batch B2 and manually inspect or reposition the robot."

Option 2 — Open the Agri Bot App
"Or, you can open the Agri Bot app to view the exact robot location, live field conditions, and recovery controls."

Then:
"Would you like me to keep the robot safely stopped, or would you like to start a recovery attempt?"

6) If Farmer Chooses Recovery
"Understood. I'll keep the robot in safety mode and initiate the recovery procedure."

After recovery:
Successful
"Recovery was successful. The robot is moving again and has resumed its assigned operation."

Failed
"The recovery attempt was unsuccessful. The robot remains safely stopped in Batch B2. Please inspect the robot manually or use the Agri Bot application for further assistance."

7) If Farmer Chooses to Visit the Field
"Understood. The robot will remain safely stopped in Batch B2 until you reach the location."
"The latest field data will continue to be recorded locally."

8) If Farmer Doesn't Respond
Escalation logic:
Robot Stuck -> App Alert -> Automated Voice Call -> No Response -> Second Alert / SMS -> Optional Callback / Support Agent

Voice line:
"We could not confirm your response. The robot will remain in safety mode, and a notification will also be sent to your Agri Bot application."

For critical events:
"If the issue remains unresolved, support escalation can be initiated."

9) Important Safety Logic
The agent should never claim that the robot has recovered unless the robot actually reports recovery.
Use these rules:
If robot is stuck -> stop movement
If recovery succeeds -> resume
If recovery fails -> remain stopped
If communication is lost -> do not assume the robot is safe or moving
If battery is critically low -> enter safe mode / return procedure
If obstacle detected -> stop before attempting recovery

10) Final Call Ending
If everything is resolved:
"The issue has been handled successfully. The latest field and robot status is available in your Agri Bot app. Thank you."

If the robot remains stuck:
"The robot will remain safely stopped until further action is taken. You can use the Agri Bot app to view its location and field conditions. Thank you."
`;

const ULTRAVOX_CALL_CONFIG = {
    systemPrompt: SYSTEM_PROMPT,
    model: 'ultravox-v0.7',
    voice: 'Mark',
    temperature: 0.3,
    joinTimeout: '120s',
    firstSpeakerSettings: { agent: {} }, // Agri Bot Field Support speaks greeting immediately!
    medium: { twilio: {} }               // Standard Twilio media stream
};

// ------------------------------------------------------------
// Step 3: Validate Configuration & Environment
// ------------------------------------------------------------
function validateConfiguration() {
    const requiredConfig = [
        { name: 'TWILIO_ACCOUNT_SID', value: TWILIO_ACCOUNT_SID, pattern: /^(AC|US)[a-zA-Z0-9]{32}$/ },
        { name: 'TWILIO_AUTH_TOKEN', value: TWILIO_AUTH_TOKEN, pattern: /^[a-zA-Z0-9]{32}$/ },
        { name: 'TWILIO_PHONE_NUMBER', value: TWILIO_PHONE_NUMBER, pattern: /^\+[1-9]\d{1,14}$/ },
        { name: 'DESTINATION_PHONE_NUMBER', value: DESTINATION_PHONE_NUMBER, pattern: /^\+[1-9]\d{1,14}$/ },
        { name: 'ULTRAVOX_API_KEY', value: ULTRAVOX_API_KEY }
    ];

    const errors = [];

    for (const config of requiredConfig) {
        if (!config.value || config.value.includes('your_') || config.value.includes('_here')) {
            errors.push(`❌ ${config.name} is not set in environment or .env file`);
        } else if (config.pattern && !config.pattern.test(config.value)) {
            errors.push(`❌ ${config.name} format appears invalid (${config.value})`);
        }
    }

    if (errors.length > 0) {
        console.error('🚨 Configuration Error(s):');
        errors.forEach(error => console.error(`   ${error}`));
        console.error('\n💡 Please update your .env file with valid Twilio & Ultravox credentials.');
        process.exit(1);
    }

    console.log('✅ Configuration validation passed!');
    console.log(`📌 Architecture:        Twilio Media Streams <--> Ultravox AI`);
    console.log(`📌 Twilio Phone Number:  ${TWILIO_PHONE_NUMBER}`);
    console.log(`📌 Destination Number:   ${DESTINATION_PHONE_NUMBER}`);
    console.log(`📌 Twilio Account SID:   ${TWILIO_ACCOUNT_SID.substring(0, 8)}...`);
}

// ------------------------------------------------------------
// Step 4: Create Ultravox AI Call Session
// ------------------------------------------------------------
async function createUltravoxCall() {
    const ULTRAVOX_API_URL = 'https://api.ultravox.ai/api/calls';
    const request = https.request(ULTRAVOX_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': ULTRAVOX_API_KEY
        }
    });

    return new Promise((resolve, reject) => {
        let data = '';
        request.on('response', (response) => {
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        reject(new Error(`Ultravox API error (${response.statusCode}): ${data}`));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse Ultravox response: ${data}`));
                }
            });
        });
        request.on('error', (error) => {
            reject(new Error(`Network error calling Ultravox: ${error.message}`));
        });
        request.write(JSON.stringify(ULTRAVOX_CALL_CONFIG));
        request.end();
    });
}

// ------------------------------------------------------------
// Step 5: Main Orchestrator
// ------------------------------------------------------------
async function main() {
    console.log('🚀 Initiating Outbound Twilio + Ultravox Voice AI Call...\n');
    validateConfiguration();

    try {
        console.log('🤖 Creating Ultravox AI call session...');
        const ultravoxResponse = await createUltravoxCall();

        if (!ultravoxResponse.joinUrl) {
            throw new Error('No joinUrl received from Ultravox API');
        }

        console.log(`✅ Ultravox Session Created! Call ID: ${ultravoxResponse.callId || 'N/A'}`);
        console.log(`🔗 Media Stream WebSocket URL: ${ultravoxResponse.joinUrl}`);

        console.log('\n📱 Initiating Outbound Twilio Call...');
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

        const call = await client.calls.create({
            twiml: `<Response><Connect><Stream url="${ultravoxResponse.joinUrl}"/></Connect></Response>`,
            to: DESTINATION_PHONE_NUMBER,
            from: TWILIO_PHONE_NUMBER
        });

        console.log('\n🎉 Twilio Outbound Phone Call Initiated Successfully!');
        console.log(`📋 Twilio Call SID: ${call.sid}`);
        console.log(`📞 Calling ${DESTINATION_PHONE_NUMBER} from ${TWILIO_PHONE_NUMBER}`);

    } catch (error) {
        console.error('\n💥 Error Occurred:');
        if (error.message.includes('Authentication') || error.code === 20003) {
            console.error('   🔐 Authentication failed - check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
        } else if (error.code === 21211 || error.code === 21212) {
            console.error('   📞 Invalid phone number - check TWILIO_PHONE_NUMBER or DESTINATION_PHONE_NUMBER in .env');
        } else {
            console.error(`   ${error.message}`);
        }
    }
}

main();