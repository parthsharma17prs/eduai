import { AvatarManager } from './avatar.js';

// Configuration
const DEFAULT_AVATAR_URL = '/images/avatar.jpg';

class AppOrchestrator {
  constructor() {
    // State Variables
    this.userName = 'Candidate';
    this.topic = '';
    this.difficulty = 'Mid-Level';
    this.totalQuestions = 5;
    this.currentQuestionIndex = 0;
    this.chatHistory = []; // { question, answer }
    this.interviewActive = false;

    // Call timer variables
    this.timerInterval = null;
    this.elapsedSeconds = 0;

    // Web Media streams
    this.localStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.volumeVisualizerActive = false;

    // Speech APIs
    this.recognition = null;
    this.isListening = false;
    this.synthesisVoice = null;
    this.currentUtterance = null;
    this.recognitionIsStartingOrRunning = false;
    this.isRecruiterSpeaking = false;

    // 3D Avatar Manager
    this.avatarManager = null;

    // Device selection state
    this.selectedCameraId = '';
    this.selectedMicrophoneId = '';
    this.selectedSpeakerId = '';
    this.currentTtsAudio = null; // Active proxy TTS Audio element
    this.lobbyStream = null;
    this.lobbyAudioContext = null;

    // Mic test state
    this.isTestingMic = false;
    this.testMicStream = null;
    this.testMicAudio = null;
    this.micTestTimeout = null;

    // Coding workspace state
    this.currentCodingQuestion = null;
    this.codingPhase = false;
    this.passedCount = 0;
    this.totalCount = 0;
    this.includeCoding = true;

    // Proctoring & warnings state (Limit 5 warnings per category before automatic termination)
    this.warningCounts = {
      tab: 0,
      focus: 0,
      fullscreen: 0,
      clipboard: 0,
      camera: 0,
      monitor: 0,
      noface: 0,
      multiface: 0,
      lookaway: 0,
      eyegaze: 0,
      audio: 0,
      mobile_device: 0
    };
    this.tabChangeWarnings = 0;
    this.monitorCheckInterval = null;
    this.proctorModel = null;
    this.webcamProctorInterval = null;
    this.consecutiveNoFace = 0;
    this.consecutiveMultiFace = 0;
    this.consecutiveLookAway = 0;
    this.continuousLoudSoundTicks = 0;

    // Mobile Phone Detection State
    this.mobileDetectionInterval = null;
    this.mobileDetectionCanvas = null;
    this.mobileDetectionCtx = null;
    this.mobileWarningCount = 0;
    this.MAX_MOBILE_WARNINGS = 3;
    this.isMobileDetectionRunning = false;
    this.violationScreenshots = [];

    // Cache DOM Elements
    this.initElements();
    // Bind Event Listeners
    this.bindEvents();
    // Setup Advanced Code Writer
    this.setupAdvancedCodeEditor();
    // Setup Security and Anti-Cheating listeners
    this.setupSecurityListeners();
    // Initialize Web Speech Recognition
    this.initSpeechRecognition();
    // Load Saved API Key
    this.loadSavedApiKey();
    // Load BlazeFace proctoring model in background
    this.loadProctorModel();
    // Start Lobby Camera Preview
    this.startLobbyPreview();
  }

  initElements() {
    // Screens
    this.lobbyScreen = document.getElementById('lobby-screen');
    this.interviewScreen = document.getElementById('interview-screen');
    this.reportScreen = document.getElementById('report-screen');
    this.globalLoader = document.getElementById('global-loader');

    // Setup form & inputs
    this.setupForm = document.getElementById('setup-form');
    this.nameInput = document.getElementById('candidate-name');
    this.topicInput = document.getElementById('interview-topic');
    this.difficultySelect = document.getElementById('interview-difficulty');
    this.questionCountSelect = document.getElementById('question-count');
    this.apiKeyInput = document.getElementById('groq-key');

    // Interview customization mode toggle elements
    this.interviewModeSelect = document.getElementById('interview-mode');
    this.topicInputGroup = document.getElementById('topic-input-group');
    this.resumeUploadGroup = document.getElementById('resume-upload-group');

    // Devices previews
    this.lobbyPreview = document.getElementById('lobby-preview');
    this.lobbyPreviewOverlay = document.getElementById('lobby-preview-overlay');
    this.camStatusDot = document.getElementById('cam-status');
    this.micStatusDot = document.getElementById('mic-status');

    // Interview screen displays
    this.callTopicDisplay = document.getElementById('call-topic-display');
    this.callTimer = document.getElementById('call-timer');
    this.questionProgress = document.getElementById('question-progress');
    this.subtitleText = document.getElementById('subtitle-text');
    this.sttOverlay = document.getElementById('stt-overlay');
    this.sttTranscriptText = document.getElementById('stt-transcript-text');
    this.sttHeaderSpan = this.sttOverlay ? this.sttOverlay.querySelector('.stt-header span') : null;
    this.candidateWebcam = document.getElementById('candidate-webcam');
    this.volumeIndicator = document.getElementById('volume-indicator');
    this.chatLog = document.getElementById('chat-log');
    this.chatContainer = document.getElementById('chat-container');

    // Call controls
    this.micToggleBtn = document.getElementById('mic-toggle-btn');
    this.camToggleBtn = document.getElementById('cam-toggle-btn');
    this.chatToggleBtn = document.getElementById('chat-toggle-btn');
    this.toggleChatBtn = document.getElementById('toggle-chat-btn');

    // Device selectors
    this.cameraSelect = document.getElementById('camera-select');
    this.micSelect = document.getElementById('mic-select');
    this.speakerSelect = document.getElementById('speaker-select');
    this.testSpeakerBtn = document.getElementById('test-speaker-btn');
    this.micStatusBadge = document.getElementById('mic-status-badge');
    this.micStatusText = document.getElementById('mic-status-text');
    this.endInterviewBtn = document.getElementById('end-interview-btn');
    this.textResponseInput = document.getElementById('candidate-text-response');
    this.submitTextBtn = document.getElementById('submit-text-btn');

    // Report elements
    this.reportScoreValue = document.getElementById('report-score-value');
    this.reportScoreCircle = document.getElementById('report-score-circle');
    this.reportLevelBadge = document.getElementById('report-level-badge');
    this.strengthsList = document.getElementById('strengths-list');
    this.improvementsList = document.getElementById('improvements-list');
    this.breakdownList = document.getElementById('report-breakdown-list');
    this.tipsList = document.getElementById('tips-list');
    this.restartBtn = document.getElementById('restart-interview-btn');

    // Loader controls
    this.loaderTitle = document.getElementById('loader-title');
    this.loaderDesc = document.getElementById('loader-desc');

    // Lobby mic volume indicator
    this.lobbyVolumeIndicator = document.getElementById('lobby-volume-indicator');
    this.testMicBtn = document.getElementById('test-mic-btn');

    // Confirmation Modal Elements
    this.confirmModal = document.getElementById('confirm-modal');
    this.confirmCandidateName = document.getElementById('confirm-candidate-name');
    this.confirmInterviewTopic = document.getElementById('confirm-interview-topic');
    this.confirmInterviewDifficulty = document.getElementById('confirm-interview-difficulty');
    this.confirmQuestionCount = document.getElementById('confirm-question-count');
    this.confirmCameraName = document.getElementById('confirm-camera-name');
    this.confirmMicName = document.getElementById('confirm-mic-name');
    this.confirmSpeakerName = document.getElementById('confirm-speaker-name');
    this.confirmSecondaryCameraName = document.getElementById('confirm-secondary-camera-name');
    this.confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    this.confirmStartBtn = document.getElementById('confirm-start-btn');

    // Coding Workspace Elements
    this.codingWorkspace = document.getElementById('coding-workspace');
    this.codingProblemTitle = document.getElementById('coding-problem-title');
    this.codingProblemDesc = document.getElementById('coding-problem-desc');
    this.testCasesList = document.getElementById('test-cases-list');
    this.codeEditor = document.getElementById('code-editor');
    this.runTestsBtn = document.getElementById('run-tests-btn');
    this.submitCodeBtn = document.getElementById('submit-code-btn');

    // Coding Report Elements
    this.reportCodingCard = document.getElementById('coding-report-card');
    this.reportCodingTitle = document.getElementById('report-coding-title');
    this.reportCodingPassBadge = document.getElementById('report-coding-pass-badge');
    this.reportCodingCode = document.getElementById('report-coding-code');
    this.reportCodingFeedback = document.getElementById('report-coding-feedback');

    // Configuration Elements
    this.includeCodingSelect = document.getElementById('include-coding');
    this.confirmIncludeCoding = document.getElementById('confirm-include-coding');

    // Cheat warning modal elements
    this.cheatWarningModal = document.getElementById('cheat-warning-modal');
    this.cheatWarningMessage = document.getElementById('cheat-warning-message');
    this.cheatWarningCount = document.getElementById('cheat-warning-count');
    this.cheatResumeBtn = document.getElementById('cheat-resume-btn');

    // Custom alert popup elements
    this.customAlertPopup = document.getElementById('custom-alert-popup');
    this.customAlertTitle = document.getElementById('custom-alert-title');
    this.customAlertMessage = document.getElementById('custom-alert-message');
    this.customAlertCloseBtn = document.getElementById('custom-alert-close-btn');

    // Proctor status indicator elements
    this.proctorStatusIndicator = document.getElementById('proctor-status-indicator');
    this.proctorMetricFace = document.getElementById('proctor-metric-face');
    this.proctorMetricGaze = document.getElementById('proctor-metric-gaze');
    this.proctorMetricAudio = document.getElementById('proctor-metric-audio');

    // Resume elements
    this.resumeUpload = document.getElementById('resume-upload');
    this.resumeUploadLabel = document.getElementById('resume-upload-label');
    this.resumeStatus = document.getElementById('resume-status');
    this.resumeDetails = document.getElementById('resume-details');
    this.resumeText = '';
    this.hasResume = false;
    this.codingQuestionsList = [];
    this.currentCodingQuestionIndex = 0;
    this.codingScoreDetails = [];

    // Secondary Camera Elements & State
    this.secondaryCameraModeSelect = document.getElementById('secondary-camera-mode');
    this.secondaryCameraSelectGroup = document.getElementById('secondary-camera-select-group');
    this.secondaryCameraSelect = document.getElementById('secondary-camera-select');
    this.phoneCameraConnectGroup = document.getElementById('phone-camera-connect-group');
    this.phoneQrContainer = document.getElementById('phone-qr-container');
    this.phoneStatusInfo = document.getElementById('phone-status-info');
    
    this.selectedSecondaryCameraId = '';
    this.secondaryCamStream = null;
    this.peerConnection = null;
    this.phoneAnswerPollInterval = null;
    this.cachedNetworkIp = '';
    this.preFetchNetworkIp();
  }

  bindEvents() {
    // Setup Form submission (Intercepted to show Confirmation Modal)
    this.setupForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Ensure secondary camera is configured and connected
      const secondaryMode = this.secondaryCameraModeSelect ? this.secondaryCameraModeSelect.value : '';
      if (!secondaryMode) {
        this.showCustomAlert("Secondary Camera Required", "Webcam or Mobile Phone secondary proctoring camera setup is compulsory. Please select an option to continue.", true);
        return;
      }
      if (!this.secondaryCamStream) {
        const errorMsg = secondaryMode === 'phone'
          ? "Please scan the QR code and connect your mobile phone camera first."
          : "Please choose a USB secondary webcam from the dropdown list first.";
        this.showCustomAlert("Secondary Camera Not Connected", errorMsg, true);
        return;
      }

      // If resume mode, ensure a resume is uploaded
      const isResumeMode = this.interviewModeSelect && this.interviewModeSelect.value === 'resume';
      if (isResumeMode && !this.resumeText) {
        this.showCustomAlert("Resume Required", "Please upload a resume (PDF or TXT) before starting a Resume-based interview.", true);
        return;
      }

      this.showSetupConfirmation();
    });

    // Mode selection change listener
    if (this.interviewModeSelect) {
      this.interviewModeSelect.addEventListener('change', () => this.handleInterviewModeChange());
    }

    // Confirmation Modal actions
    if (this.confirmCancelBtn) {
      this.confirmCancelBtn.addEventListener('click', () => {
        if (this.confirmModal) this.confirmModal.classList.remove('active');
      });
    }
    if (this.confirmStartBtn) {
      this.confirmStartBtn.addEventListener('click', () => {
        if (this.confirmModal) this.confirmModal.classList.remove('active');
        this.startInterview();
      });
    }

    // Control bar buttons
    this.micToggleBtn.addEventListener('click', () => this.toggleMicrophone());
    this.camToggleBtn.addEventListener('click', () => this.toggleCamera());
    this.chatToggleBtn.addEventListener('click', () => this.toggleChatDrawer());
    this.toggleChatBtn.addEventListener('click', () => this.toggleChatDrawer());
    this.chatHeader = document.querySelector('.chat-header');
    this.chatHeader.addEventListener('click', () => this.toggleChatDrawer());

    // Speaking / Response controls
    this.submitTextBtn.addEventListener('click', () => this.submitTextResponse());
    this.textResponseInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.submitTextResponse();
    });

    // End call / Restart buttons
    this.endInterviewBtn.addEventListener('click', () => this.endInterviewEarly());
    this.restartBtn.addEventListener('click', () => this.resetToLobby());

    // Device selectors change
    if (this.cameraSelect) {
      this.cameraSelect.addEventListener('change', () => {
        this.selectedCameraId = this.cameraSelect.value;
        this.updateLobbyPreview();
      });
    }
    if (this.micSelect) {
      this.micSelect.addEventListener('change', () => {
        this.selectedMicrophoneId = this.micSelect.value;
        this.stopMicTest();
        this.updateLobbyPreview();
      });
    }
    if (this.speakerSelect) {
      this.speakerSelect.addEventListener('change', () => {
        this.selectedSpeakerId = this.speakerSelect.value;
      });
    }
    if (this.testSpeakerBtn) {
      this.testSpeakerBtn.addEventListener('click', () => this.testSpeaker());
    }
    if (this.testMicBtn) {
      this.testMicBtn.addEventListener('click', () => this.testMicrophone());
    }
    if (this.runTestsBtn) {
      this.runTestsBtn.addEventListener('click', () => this.runCodingTests());
    }
    if (this.submitCodeBtn) {
      this.submitCodeBtn.addEventListener('click', () => this.submitCodingTest());
    }
    if (this.cheatResumeBtn) {
      this.cheatResumeBtn.addEventListener('click', () => this.resumeFromCheatWarning());
    }
    if (this.resumeUpload) {
      this.resumeUpload.addEventListener('change', (e) => this.handleResumeUpload(e));
    }
    if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
      navigator.mediaDevices.addEventListener('devicechange', () => this.loadDevices());
    }

    // Secondary Camera Mode Event Listener
    if (this.secondaryCameraModeSelect) {
      this.secondaryCameraModeSelect.addEventListener('change', async () => {
        const mode = this.secondaryCameraModeSelect.value;
        if (this.secondaryCameraSelectGroup) this.secondaryCameraSelectGroup.style.display = 'none';
        if (this.phoneCameraConnectGroup) this.phoneCameraConnectGroup.style.display = 'none';
        
        this.stopPhoneConnection();

        if (mode === 'webcam') {
          if (this.secondaryCameraSelectGroup) this.secondaryCameraSelectGroup.style.display = 'block';
          if (this.secondaryCameraSelect && this.secondaryCameraSelect.value) {
            this.secondaryCameraSelect.dispatchEvent(new Event('change'));
          }
        } else if (mode === 'phone') {
          if (this.phoneCameraConnectGroup) this.phoneCameraConnectGroup.style.display = 'block';
          if (this.phoneStatusInfo) {
            this.phoneStatusInfo.innerHTML = `
              <span class="status-dot-blink" style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; display: inline-block;"></span>
              <span>Waiting for phone connection...</span>
            `;
          }
          await this.generatePhoneConnectionQR();
        }
      });
    }

    // Secondary USB Camera Change Event Listener
    if (this.secondaryCameraSelect) {
      this.secondaryCameraSelect.addEventListener('change', async () => {
        if (this.secondaryCamStream) {
          this.secondaryCamStream.getTracks().forEach(track => track.stop());
          this.secondaryCamStream = null;
        }
        this.selectedSecondaryCameraId = this.secondaryCameraSelect.value;
        if (this.selectedSecondaryCameraId) {
          try {
            this.secondaryCamStream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: this.selectedSecondaryCameraId } }
            });
            console.log("[MobileDetect] Secondary camera stream selected and started:", this.selectedSecondaryCameraId);
          } catch (err) {
            console.error("[MobileDetect] Failed to start secondary USB camera stream:", err);
            try {
              this.secondaryCamStream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { ideal: this.selectedSecondaryCameraId } }
              });
            } catch (err2) {
              console.error("[MobileDetect] Failed secondary camera fallback:", err2);
            }
          }
        }
      });
    }

    // Set initial custom mode state
    this.handleInterviewModeChange();
  }

  // Handle toggle between Topic-wise and Resume-based interview modes
  handleInterviewModeChange() {
    if (!this.interviewModeSelect) return;
    const mode = this.interviewModeSelect.value;
    if (mode === 'resume') {
      if (this.topicInputGroup) this.topicInputGroup.classList.add('hidden-mode');
      if (this.resumeUploadGroup) this.resumeUploadGroup.classList.remove('hidden-mode');
      if (this.topicInput) {
        this.topicInput.removeAttribute('required');
      }
      if (this.questionCountSelect) {
        this.questionCountSelect.value = "8";
      }
    } else {
      if (this.topicInputGroup) this.topicInputGroup.classList.remove('hidden-mode');
      if (this.resumeUploadGroup) this.resumeUploadGroup.classList.add('hidden-mode');
      if (this.topicInput) {
        this.topicInput.setAttribute('required', 'required');
      }
    }
  }

  // Setup Advanced Code Writer: Auto-indent, Bracket auto-close, Tab handling
  setupAdvancedCodeEditor() {
    const editor = this.codeEditor;
    if (!editor) return;

    editor.addEventListener('keydown', (e) => {
      const val = editor.value;
      const start = editor.selectionStart;
      const end = editor.selectionEnd;

      // 1. Tab Key: Insert 2 spaces (or indent selected text)
      if (e.key === 'Tab') {
        e.preventDefault();
        if (start === end) {
          // No selection: just insert 2 spaces
          const tabSpaces = "  ";
          editor.value = val.substring(0, start) + tabSpaces + val.substring(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
        } else {
          // Multiline selection: indent all selected lines
          const selectedText = val.substring(start, end);
          const lines = selectedText.split('\n');

          if (e.shiftKey) {
            // Shift+Tab: Unindent
            const indentedLines = lines.map(line => {
              if (line.startsWith('  ')) return line.substring(2);
              if (line.startsWith(' ')) return line.substring(1);
              return line;
            });
            editor.value = val.substring(0, start) + indentedLines.join('\n') + val.substring(end);
            editor.selectionStart = start;
            editor.selectionEnd = start + indentedLines.join('\n').length;
          } else {
            // Tab: Indent
            const indentedLines = lines.map(line => '  ' + line);
            editor.value = val.substring(0, start) + indentedLines.join('\n') + val.substring(end);
            editor.selectionStart = start;
            editor.selectionEnd = start + indentedLines.join('\n').length;
          }
        }
      }

      // 2. Bracket Auto-Closing
      const pairs = {
        '{': '}',
        '[': ']',
        '(': ')',
        '"': '"',
        "'": "'",
        '`': '`'
      };

      if (pairs[e.key] !== undefined) {
        e.preventDefault();
        const openChar = e.key;
        const closeChar = pairs[openChar];

        if (start !== end) {
          // Wrap selected text
          const selectedText = val.substring(start, end);
          editor.value = val.substring(0, start) + openChar + selectedText + closeChar + val.substring(end);
          editor.selectionStart = start + 1;
          editor.selectionEnd = end + 1;
        } else {
          // Insert character pair
          editor.value = val.substring(0, start) + openChar + closeChar + val.substring(start);
          editor.selectionStart = editor.selectionEnd = start + 1;
        }
      }

      // 3. Skip Closing Bracket if typed
      const closingChars = ['}', ']', ')', '"', "'", '`'];
      if (closingChars.includes(e.key) && start === end) {
        const charAfterCursor = val.charAt(start);
        if (charAfterCursor === e.key) {
          e.preventDefault();
          editor.selectionStart = editor.selectionEnd = start + 1;
        }
      }

      // 4. Backspace deletes matching pairs
      if (e.key === 'Backspace' && start === end && start > 0) {
        const charBefore = val.charAt(start - 1);
        const charAfter = val.charAt(start);
        const matchingPairs = {
          '{': '}',
          '[': ']',
          '(': ')',
          '"': '"',
          "'": "'",
          '`': '`'
        };
        if (matchingPairs[charBefore] === charAfter) {
          e.preventDefault();
          editor.value = val.substring(0, start - 1) + val.substring(start + 1);
          editor.selectionStart = editor.selectionEnd = start - 1;
        }
      }

      // 5. Enter Key: Auto-indentation
      if (e.key === 'Enter' && start === end) {
        e.preventDefault();

        // Get current line content
        const linesBefore = val.substring(0, start).split('\n');
        const currentLine = linesBefore[linesBefore.length - 1];

        // Find leading whitespace
        const match = currentLine.match(/^(\s*)/);
        let indent = match ? match[1] : '';

        const charBeforeCursor = val.charAt(start - 1);
        const charAfterCursor = val.charAt(start);

        // If we are between { and }, format nicely on three lines
        if (charBeforeCursor === '{' && charAfterCursor === '}') {
          const extraIndent = "  ";
          const newLineContent = "\n" + indent + extraIndent + "\n" + indent;
          editor.value = val.substring(0, start) + newLineContent + val.substring(start);
          editor.selectionStart = editor.selectionEnd = start + indent.length + extraIndent.length + 1;
        } else if (['{', '[', '('].includes(charBeforeCursor)) {
          // Just indent one level extra
          const extraIndent = "  ";
          const newLineContent = "\n" + indent + extraIndent;
          editor.value = val.substring(0, start) + newLineContent + val.substring(start);
          editor.selectionStart = editor.selectionEnd = start + newLineContent.length;
        } else {
          // Keep same indent level
          const newLineContent = "\n" + indent;
          editor.value = val.substring(0, start) + newLineContent + val.substring(start);
          editor.selectionStart = editor.selectionEnd = start + newLineContent.length;
        }
      }
    });
  }

  setupSecurityListeners() {
    // 1. Block right-click context menu during interview
    document.addEventListener('contextmenu', (e) => {
      if (this.interviewActive) {
        e.preventDefault();
        this.showCustomAlert("Security Warning", "Right-click menu is deactivated during the interview.", true);
      }
    });

    // 2. Block keyboard shortcuts for copy/paste/cut, viewing source, developer tools
    document.addEventListener('keydown', (e) => {
      if (this.interviewActive) {
        const isCtrl = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();

        if (
          (isCtrl && ['c', 'v', 'x', 'u', 'a'].includes(key)) || // Ctrl+C/V/X/U/A
          e.key === 'F12' ||                                     // F12 DevTools
          (isCtrl && e.shiftKey && ['i', 'j', 'c'].includes(key)) // Ctrl+Shift+I/J/C
        ) {
          e.preventDefault();
          e.stopPropagation();
          this.showCustomAlert("Security Warning", "This keyboard shortcut is deactivated during the interview.", true);
          this.triggerCheatWarning("Prohibited keyboard shortcut pressed.", "clipboard");
        }
      }
    });

    // 3. Deactivate standard clipboard operations
    document.addEventListener('copy', (e) => {
      if (this.interviewActive) {
        e.preventDefault();
        this.showCustomAlert("Security Warning", "Copying content is strictly disabled.", true);
        this.triggerCheatWarning("Copy attempt detected.", "clipboard");
      }
    });

    document.addEventListener('cut', (e) => {
      if (this.interviewActive) {
        e.preventDefault();
        this.showCustomAlert("Security Warning", "Cutting content is strictly disabled.", true);
        this.triggerCheatWarning("Cut attempt detected.", "clipboard");
      }
    });

    document.addEventListener('paste', (e) => {
      if (this.interviewActive) {
        e.preventDefault();
        this.showCustomAlert("Security Warning", "Pasting content is strictly disabled.", true);
        this.triggerCheatWarning("Paste attempt detected.", "clipboard");
      }
    });

    // 4. Monitor Tab switching (visibilitychange)
    document.addEventListener('visibilitychange', () => {
      if (this.interviewActive && document.visibilityState === 'hidden') {
        this.triggerCheatWarning("Tab switch detected. Please stay on the active interview tab to avoid disqualification.", "tab");
      }
    });

    // 5. Monitor window blur (losing focus to other apps or windows)
    window.addEventListener('blur', () => {
      if (this.interviewActive) {
        // Delay slightly to prevent focus/blur loops when browser dialogs open
        setTimeout(() => {
          // Verify they haven't closed/refocused immediately and that the modal is not already open
          if (this.interviewActive && !document.hasFocus() && (!this.cheatWarningModal || !this.cheatWarningModal.classList.contains('active'))) {
            this.triggerCheatWarning("Focus loss detected. You clicked outside the interview window or switched applications.", "focus");
          }
        }, 200);
      }
    });

    // 6. Monitor fullscreen exit
    document.addEventListener('fullscreenchange', () => {
      if (this.interviewActive && !document.fullscreenElement) {
        this.triggerCheatWarning("Fullscreen was exited. Mandatory fullscreen mode is required during the interview.", "fullscreen");
      }
    });

    // 7. Monitor screen layout changes (connecting secondary monitors)
    if (window.screen) {
      window.screen.addEventListener('change', () => {
        if (this.interviewActive) {
          this.checkSecondaryMonitor();
        }
      });
    }
  }

  // Handle proctoring warnings via DOM modal overlay
  triggerCheatWarning(message, type = "tab") {
    if (!this.interviewActive) return;

    // Increment tabChangeWarnings for backwards compatibility
    if (type === "tab") {
      this.tabChangeWarnings = (this.tabChangeWarnings || 0) + 1;
    }

    // Increment category warning count
    this.warningCounts[type] = (this.warningCounts[type] || 0) + 1;
    const currentCategoryCount = this.warningCounts[type];

    // Save state of recruiter speaking before we stop it
    this.wasRecruiterSpeakingBeforeWarning = this.isRecruiterSpeaking;

    // Pause speaking and speech synthesis
    this.cancelSpeech();

    // Pause speech recognition if listening
    if (this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) { }
    }

    // Check for immediate disqualification (5 counts in any category)
    if (currentCategoryCount >= 5) {
      this.terminateInterviewDueToDisqualification(type);
      return;
    }

    // Show warning modal
    if (this.cheatWarningModal) {
      const displayReason = type.charAt(0).toUpperCase() + type.slice(1);
      if (this.cheatWarningMessage) this.cheatWarningMessage.innerText = message;
      if (this.cheatWarningCount) {
        this.cheatWarningCount.innerHTML = `
          <span style="font-size: 30px; font-weight: 800; color: var(--color-danger);">${displayReason} Warning: ${currentCategoryCount} / 5</span>
          <br>
          <span style="font-size: 13.5px; color: var(--text-muted); font-weight: 500; margin-top: 8px; display: block;">
            Total warning instances logged: ${Object.values(this.warningCounts).reduce((a, b) => a + b, 0)}
          </span>
        `;
      }
      this.cheatWarningModal.classList.add('active');
    } else {
      // Fallback if elements not ready
      this.showCustomAlert("Security Warning", `${message}\nWarning Count in ${type} category: ${currentCategoryCount} / 5`, true);
    }
  }

  // Resume interview, request fullscreen again, resume listening state if appropriate
  resumeFromCheatWarning() {
    if (this.cheatWarningModal) {
      this.cheatWarningModal.classList.remove('active');
    }

    // Re-enter fullscreen
    this.enterFullscreen();

    // Check secondary screen again on resume
    this.checkSecondaryMonitor();

    // Replay the question if the recruiter was speaking when warning occurred
    if (this.wasRecruiterSpeakingBeforeWarning && this.subtitleText && this.subtitleText.innerText) {
      console.log("[CheatWarning] Replaying question upon resuming interview.");
      this.wasRecruiterSpeakingBeforeWarning = false;
      this.speakText(this.subtitleText.innerText);
    } else {
      this.wasRecruiterSpeakingBeforeWarning = false;
      // Resume listening state if it was active
      if (this.isListening && this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          console.warn("Failed to restart speech recognition on resume:", e);
        }
      }
    }
  }

  // Reusable custom alert modal that preserves fullscreen mode
  showCustomAlert(title, message, isWarning = false) {
    const alertOverlay = this.customAlertPopup;
    const alertTitle = this.customAlertTitle;
    const alertMsg = this.customAlertMessage;
    const closeBtn = this.customAlertCloseBtn;

    if (!alertOverlay || !alertTitle || !alertMsg || !closeBtn) {
      // Fallback to browser alert if HTML elements are missing
      alert(`${title}: ${message}`);
      return Promise.resolve();
    }

    // Set content
    const icon = isWarning
      ? '<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger);"></i>'
      : '<i class="fa-solid fa-circle-info" style="color: var(--color-accent-1);"></i>';
    alertTitle.innerHTML = `${icon} ${title}`;
    alertMsg.innerText = message;

    // Apply color styles
    const modalBox = alertOverlay.querySelector('#custom-alert-box') || alertOverlay.querySelector('.modal-panel');
    if (modalBox) {
      if (isWarning) {
        modalBox.style.borderColor = "var(--color-danger)";
        closeBtn.className = "btn btn-danger";
      } else {
        modalBox.style.borderColor = "var(--panel-border)";
        closeBtn.className = "btn btn-primary";
      }
    }

    // Display the custom alert overlay modal
    alertOverlay.classList.add('active');

    // Return a promise that resolves when the user clicks the OK close button
    return new Promise((resolve) => {
      const handleClose = () => {
        alertOverlay.classList.remove('active');
        closeBtn.removeEventListener('click', handleClose);
        resolve();
      };
      closeBtn.addEventListener('click', handleClose);
    });
  }

  // Reusable custom confirm modal that preserves fullscreen mode
  showCustomConfirm(title, message) {
    const confirmOverlay = document.getElementById('custom-confirm-popup');
    const confirmTitle = document.getElementById('custom-confirm-title');
    const confirmMsg = document.getElementById('custom-confirm-message');
    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');
    const okBtn = document.getElementById('custom-confirm-ok-btn');

    if (!confirmOverlay || !confirmTitle || !confirmMsg || !cancelBtn || !okBtn) {
      // Fallback to browser confirm if HTML elements are missing
      return Promise.resolve(confirm(message));
    }

    confirmTitle.innerHTML = `<i class="fa-solid fa-circle-question icon-accent"></i> ${title}`;
    confirmMsg.innerText = message;

    confirmOverlay.classList.add('active');

    return new Promise((resolve) => {
      const handleCancel = () => {
        confirmOverlay.classList.remove('active');
        cancelBtn.removeEventListener('click', handleCancel);
        okBtn.removeEventListener('click', handleOk);
        resolve(false);
      };

      const handleOk = () => {
        confirmOverlay.classList.remove('active');
        cancelBtn.removeEventListener('click', handleCancel);
        okBtn.removeEventListener('click', handleOk);
        resolve(true);
      };

      cancelBtn.addEventListener('click', handleCancel);
      okBtn.addEventListener('click', handleOk);
    });
  }

  // Check for connected extended secondary displays
  checkSecondaryMonitor() {
    if (window.screen && window.screen.isExtended === true) {
      this.triggerCheatWarning("Multiple displays connection detected. Under strict proctoring rules, you must disconnect all secondary monitors to continue.", "monitor");
    }
  }

  // Initialize mobile phone detection canvas and start loop
  initMobileDetection() {
    console.log("[MobileDetect] Initializing mobile phone detection...");
    this.mobileDetectionCanvas = document.createElement('canvas');
    this.mobileDetectionCanvas.width = 640;
    this.mobileDetectionCanvas.height = 480;
    this.mobileDetectionCtx = this.mobileDetectionCanvas.getContext('2d');
    this.startMobileDetectionLoop();
  }

  // Start mobile detection interval
  startMobileDetectionLoop() {
    if (this.mobileDetectionInterval) {
      clearInterval(this.mobileDetectionInterval);
    }
    this.mobileDetectionInterval = setInterval(async () => {
      // Pause if not active, recruiter is speaking, or secondary stream is not active
      if (!this.interviewActive) return;
      if (this.isRecruiterSpeaking) return;
      if (!this.secondaryCamStream) return;

      await this.runMobileDetection();
    }, 3000);
  }

  // Perform a single mobile detection tick
  async runMobileDetection() {
    if (this.isMobileDetectionRunning) return;
    if (!this.interviewActive) return;

    this.isMobileDetectionRunning = true;

    try {
      let video = this.secondaryVideo || document.getElementById('secondary-webcam');
      if (!video) {
        video = document.createElement('video');
        video.id = 'secondary-webcam';
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.style.display = 'none';
        document.body.appendChild(video);
        this.secondaryVideo = video;
      }

      if (video.srcObject !== this.secondaryCamStream) {
        video.srcObject = this.secondaryCamStream;
        video.play().catch(err => console.warn("[MobileDetect] Error playing secondary video:", err));
      }

      if (video.readyState < 2) {
        // Video stream not ready for frame capture
        return;
      }

      const canvas = this.mobileDetectionCanvas;
      const ctx = this.mobileDetectionCtx;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Compress to JPEG at 0.7 quality to keep base64 size small
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const base64string = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
      const customKey = this.apiKeyInput ? this.apiKeyInput.value.trim() : '';

      const response = await fetch('/api/detect-mobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: base64string, groqApiKey: customKey })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const result = await response.json();
      const timeStr = new Date().toLocaleTimeString();

      if (!result.success) {
        console.error(`[MobileDetect] ${timeStr} — detection failed:`, result.error || "Unknown server error");
        return;
      }

      console.log(`[MobileDetect] ${timeStr} — detected: ${result.mobile_detected} | confidence: ${result.confidence}`);

      if (result.mobile_detected === true) {
        if (result.confidence === "high" || result.confidence === "medium") {
          this.handleMobileViolation(result.location, result.screenshot);
        } else if (result.confidence === "low") {
          console.log(`[MobileDetect] Low confidence detection ignored: ${result.location}`);
        }
      }
    } catch (err) {
      console.warn("[MobileDetect] Error during mobile phone detection:", err);
    } finally {
      this.isMobileDetectionRunning = false;
    }
  }

  // Handle a detected mobile phone violation
  handleMobileViolation(location, screenshotUrl = null) {
    this.mobileWarningCount++;
    this.logViolation("mobile_device", location);

    if (screenshotUrl) {
      if (!this.violationScreenshots) this.violationScreenshots = [];
      this.violationScreenshots.push(screenshotUrl);
    }

    // Show dynamic on-screen warning banner
    this.showMobileWarningBanner(this.mobileWarningCount, this.MAX_MOBILE_WARNINGS);

    if (this.mobileWarningCount >= this.MAX_MOBILE_WARNINGS) {
      this.terminateSession("Mobile device detected repeatedly");
    }
  }

  // Log mobile violation to warningCounts
  logViolation(type, location) {
    console.warn(`[Violation] ${type} detected: ${location}`);
    this.warningCounts[type] = (this.warningCounts[type] || 0) + 1;
  }

  // Terminate session due to mobile violations
  terminateSession(reason) {
    console.error(`[Session Terminated] ${reason}`);
    this.terminateInterviewDueToDisqualification("mobile_device");
  }

  // Helper to show a premium top alert banner for mobile warnings
  showMobileWarningBanner(count, max) {
    let banner = document.getElementById('mobile-warning-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'mobile-warning-banner';
      banner.style.position = 'fixed';
      banner.style.top = '20px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.backgroundColor = 'rgba(239, 68, 68, 0.95)';
      banner.style.color = '#ffffff';
      banner.style.padding = '16px 24px';
      banner.style.borderRadius = '8px';
      banner.style.zIndex = '99999';
      banner.style.fontWeight = 'bold';
      banner.style.fontSize = '16px';
      banner.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      banner.style.border = '1px solid #ef4444';
      banner.style.textAlign = 'center';
      banner.style.transition = 'all 0.3s ease';
      document.body.appendChild(banner);
    }

    banner.innerText = `Mobile device detected! Warning ${count} of ${max}`;
    banner.style.display = 'block';
    banner.style.opacity = '1';

    if (this.mobileBannerTimeout) clearTimeout(this.mobileBannerTimeout);
    this.mobileBannerTimeout = setTimeout(() => {
      banner.style.opacity = '0';
      setTimeout(() => {
        banner.style.display = 'none';
      }, 300);
    }, 5000);
  }

  // Stop mobile detection interval
  stopMobileDetection() {
    if (this.mobileDetectionInterval) {
      clearInterval(this.mobileDetectionInterval);
      this.mobileDetectionInterval = null;
    }
    this.isMobileDetectionRunning = false;
  }

  // Stop WebRTC phone connection & cleanup
  stopPhoneConnection() {
    if (this.phoneAnswerPollInterval) {
      clearInterval(this.phoneAnswerPollInterval);
      this.phoneAnswerPollInterval = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) { }
      this.peerConnection = null;
    }
    if (this.secondaryCamStream) {
      try {
        this.secondaryCamStream.getTracks().forEach(track => track.stop());
      } catch (e) { }
      this.secondaryCamStream = null;
    }
  }

  // Pre-fetch network IP for fast QR load
  async preFetchNetworkIp() {
    try {
      const response = await fetch('/api/network-ip');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.ip) {
          this.cachedNetworkIp = data.ip;
          console.log("[MobileDetect] Pre-fetched server network IP:", this.cachedNetworkIp);
        }
      }
    } catch (err) {
      console.warn("[MobileDetect] Failed to pre-fetch network IP:", err);
    }
  }

  // Generate connection link QR and coordinate WebRTC signaling
  async generatePhoneConnectionQR() {
    try {
      this.stopPhoneConnection();

      // Generate random session ID
      const sessionId = 'session-' + Math.random().toString(36).substring(2, 15);
      console.log("[MobileDetect] Generating phone connection session:", sessionId);

      // Create peer connection. Configure public STUN servers so WebRTC can connect
      // across different networks / over the internet (e.g. deployed on Railway).
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      this.peerConnection = pc;

      // Request WebRTC transceiver for receiving video
      pc.addTransceiver('video', { direction: 'recvonly' });

      // Handle incoming stream
      pc.ontrack = (event) => {
        console.log("[MobileDetect] WebRTC peer track received:", event.streams);
        if (event.streams && event.streams[0]) {
          this.secondaryCamStream = event.streams[0];
          if (this.phoneStatusInfo) {
            this.phoneStatusInfo.innerHTML = `
              <span class="status-dot" style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block;"></span>
              <span style="color: #10b981;">Connected</span>
            `;
          }
        }
      };

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete with a 3s timeout fallback
      if (pc.iceGatheringState !== 'complete') {
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }, 3000);

          function checkState() {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          }
          pc.addEventListener('icegatheringstatechange', checkState);
        });
      }

      // POST Offer to server
      const offerRes = await fetch('/api/webrtc/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, offer: pc.localDescription })
      });

      if (!offerRes.ok) {
        throw new Error(`Failed to upload offer: ${offerRes.status}`);
      }

      // Build connection URL using the deployed Railway URL as requested
      const origin = 'https://ai-avatar.up.railway.app';
      const connectionUrl = origin + '/mobile-cam.html?session=' + sessionId;
      console.log("[MobileDetect] Connection link URL:", connectionUrl);

      // Generate QR Code instantly using the local QRious library (drawing on canvas)
      if (this.phoneQrContainer) {
        this.phoneQrContainer.innerHTML = '<canvas id="phone-qr-canvas" style="display: block; width: 100%; height: 100%; object-fit: contain;"></canvas>';
        
        // Check if QRious is loaded
        if (typeof QRious !== 'undefined') {
          new QRious({
            element: document.getElementById('phone-qr-canvas'),
            value: connectionUrl,
            size: 150,
            background: '#ffffff',
            foreground: '#000000',
            level: 'H'
          });
        } else {
          // Fallback to text link if QRious load failed
          this.phoneQrContainer.innerHTML = `<a href="${connectionUrl}" target="_blank" style="color: var(--color-primary); font-size: 12px; font-weight: bold; text-decoration: underline;">Open connection link</a>`;
        }
      }

      // Poll for WebRTC Answer from the signaling server
      this.phoneAnswerPollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/webrtc/answer?sessionId=${sessionId}`);
          if (!response.ok) return;
          const data = await response.json();
          if (data.success && data.answer) {
            clearInterval(this.phoneAnswerPollInterval);
            this.phoneAnswerPollInterval = null;
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log("[MobileDetect] Remote description (answer) set successfully");
          }
        } catch (err) {
          console.warn("[MobileDetect] Error polling for WebRTC answer:", err);
        }
      }, 1500);

    } catch (err) {
      console.error("[MobileDetect] Failed to generate connection QR or set up WebRTC:", err);
      if (this.phoneStatusInfo) {
        this.phoneStatusInfo.innerHTML = `
          <span class="status-dot" style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block;"></span>
          <span style="color: #ef4444;">Failed to initialize WebRTC</span>
        `;
      }
    }
  }

  async loadProctorModel() {
    try {
      console.log("Loading BlazeFace proctoring model...");
      this.proctorModel = await blazeface.load();
      console.log("BlazeFace proctoring model loaded successfully.");
    } catch (e) {
      console.error("Failed to load BlazeFace proctoring model:", e);
    }
  }

  startWebcamProctoring() {
    if (this.webcamProctorInterval) {
      clearInterval(this.webcamProctorInterval);
    }
    this.webcamProctorInterval = setInterval(async () => {
      if (!this.interviewActive || !this.proctorModel) return;

      // Skip analysis if camera feed is disabled/inactive
      const videoTrack = this.localStream ? this.localStream.getVideoTracks()[0] : null;
      if (!videoTrack || !videoTrack.enabled || videoTrack.readyState === 'ended') {
        this.updateProctorMetric('face', 'yellow', 'CAM OFF');
        this.updateProctorMetric('gaze', 'yellow', 'CAM OFF');
        return;
      }

      try {
        const predictions = await this.proctorModel.estimateFaces(this.candidateWebcam, false);
        this.analyzeWebcamProctoring(predictions);
      } catch (err) {
        console.warn("BlazeFace face estimation error:", err);
      }
    }, 1500);
  }

  analyzeWebcamProctoring(predictions) {
    if (!this.interviewActive) return;

    // 1. Check Face Presence
    if (predictions.length === 0) {
      this.consecutiveNoFace++;
      this.consecutiveMultiFace = 0;
      this.consecutiveLookAway = 0;

      this.updateProctorMetric('face', 'red', 'NO FACE');

      if (this.consecutiveNoFace >= 2) { // 3 seconds
        this.consecutiveNoFace = 0;
        this.triggerCheatWarning("No face detected. Please make sure you are in front of the camera.", "noface");
      }
      return;
    }

    // 2. Check Multiple Faces
    if (predictions.length > 1) {
      this.consecutiveMultiFace++;
      this.consecutiveNoFace = 0;
      this.consecutiveLookAway = 0;

      this.updateProctorMetric('face', 'red', 'MULTIPLE');

      if (this.consecutiveMultiFace >= 2) { // 3 seconds
        this.consecutiveMultiFace = 0;
        this.triggerCheatWarning("Multiple faces detected. Only the candidate is allowed in frame.", "multiface");
      }
      return;
    }

    // 3. Single Face: Analyze Head Pose / Gaze
    this.consecutiveNoFace = 0;
    this.consecutiveMultiFace = 0;
    this.updateProctorMetric('face', 'green', 'OK');

    const face = predictions[0];
    const landmarks = face.landmarks;

    // Landmarks are: [rightEye, leftEye, nose, mouth, rightEar, leftEar]
    if (landmarks && landmarks.length >= 4) {
      const leftEyeX = landmarks[1][0];
      const rightEyeX = landmarks[0][0];
      const noseX = landmarks[2][0];

      const distLeft = Math.abs(noseX - leftEyeX);
      const distRight = Math.abs(noseX - rightEyeX);

      // Horizontal turn check
      const ratio = distLeft / (distRight || 0.001);
      if (ratio > 3.0 || ratio < 0.33) {
        this.consecutiveLookAway++;
        this.updateProctorMetric('gaze', 'red', 'AWAY');

        if (this.consecutiveLookAway >= 3) { // 4.5 seconds
          this.consecutiveLookAway = 0;
          this.triggerCheatWarning("Looking away from screen detected. Please focus on the screen.", "lookaway");
        }
      } else {
        this.consecutiveLookAway = 0;
        this.updateProctorMetric('gaze', 'green', 'OK');
      }
    } else {
      this.updateProctorMetric('gaze', 'green', 'OK');
    }
  }

  updateProctorMetric(metric, status, label) {
    let element = null;
    if (metric === 'face') element = this.proctorMetricFace;
    if (metric === 'gaze') element = this.proctorMetricGaze;
    if (metric === 'audio') element = this.proctorMetricAudio;

    if (element) {
      const statusTextSpan = element.querySelector('.status-text');
      if (statusTextSpan) {
        statusTextSpan.className = `status-text ${status}`;
        statusTextSpan.innerText = label;
      }
    }
  }

  async handleResumeUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.resumeUploadLabel.innerText = "Parsing: " + file.name + "...";
    if (this.resumeStatus) this.resumeStatus.style.display = 'none';

    try {
      let text = '';
      if (file.name.endsWith('.txt')) {
        text = await this.readTxtFile(file);
      } else if (file.name.endsWith('.pdf')) {
        text = await this.readPdfFile(file);
      } else {
        throw new Error("Unsupported format. Please upload PDF or TXT.");
      }

      this.resumeText = text;

      const skills = [];
      const keywords = ['javascript', 'python', 'react', 'node', 'html', 'css', 'sql', 'nosql', 'git', 'c++', 'java', 'typescript'];
      keywords.forEach(kw => {
        if (text.toLowerCase().includes(kw)) {
          skills.push(kw.toUpperCase());
        }
      });

      this.resumeUploadLabel.innerText = "Resume: " + file.name;
      if (this.resumeStatus && this.resumeDetails) {
        this.resumeDetails.innerText = skills.length > 0 ? skills.join(', ') : "Text loaded";
        this.resumeStatus.style.display = 'block';
      }
    } catch (err) {
      console.error("Resume parsing error:", err);
      this.showCustomAlert("Upload Error", "Failed to parse resume: " + err.message, true);
      this.resumeUploadLabel.innerText = "Click to upload resume";
    }
  }

  readTxtFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async readPdfFile(file) {
    if (!window.pdfjsLib) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js');
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      text += strings.join(' ') + '\n';
    }
    return text;
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Terminate and auto-submit interview when 5 warnings are logged in a single category
  terminateInterviewDueToDisqualification(type) {
    this.interviewActive = false;
    this.isSpeechActive = false;
    this.clearAllSpeechTimers();
    this.safeAbortSpeechRecognition();
    this.stopTimer();

    // Clear checks
    if (this.monitorCheckInterval) {
      clearInterval(this.monitorCheckInterval);
      this.monitorCheckInterval = null;
    }
    if (this.webcamProctorInterval) {
      clearInterval(this.webcamProctorInterval);
      this.webcamProctorInterval = null;
    }

    // Hide warning modal
    if (this.cheatWarningModal) {
      this.cheatWarningModal.classList.remove('active');
    }

    this.stopLocalMedia();

    const displayReason = type.charAt(0).toUpperCase() + type.slice(1);
    this.showCustomAlert(
      "Interview Disqualification",
      `The mock session has been automatically terminated and submitted due to reaching the limit of 5 proctoring violations in the "${displayReason}" category.`,
      true
    ).then(() => {
      this.compileFinalReport(true, type);
    });
  }

  enterFullscreen() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(err => console.warn("Fullscreen request failed:", err));
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
      docEl.msRequestFullscreen();
    }
  }

  // Save/Load API Keys in localstorage
  loadSavedApiKey() {
    const savedKey = localStorage.getItem('GROQ_API_KEY');
    if (savedKey) {
      this.apiKeyInput.value = savedKey;
    }
    // Listen to changes to save it
    this.apiKeyInput.addEventListener('change', () => {
      localStorage.setItem('GROQ_API_KEY', this.apiKeyInput.value.trim());
    });
  }

  // Get media stream based on selected camera/microphone, using exact constraints and fallback to ideal
  async getStreamForDevices(videoDeviceId, audioDeviceId) {
    try {
      const constraints = {};
      if (videoDeviceId) {
        constraints.video = { deviceId: { exact: videoDeviceId } };
      } else {
        constraints.video = true;
      }
      if (audioDeviceId) {
        constraints.audio = { deviceId: { exact: audioDeviceId } };
      } else {
        constraints.audio = true;
      }
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (exactErr) {
      console.warn("Exact media constraints failed, trying ideal:", exactErr);
      try {
        const constraints = {};
        if (videoDeviceId) {
          constraints.video = { deviceId: { ideal: videoDeviceId } };
        } else {
          constraints.video = true;
        }
        if (audioDeviceId) {
          constraints.audio = { deviceId: { ideal: audioDeviceId } };
        } else {
          constraints.audio = true;
        }
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (idealErr) {
        console.warn("Ideal media constraints failed, trying default:", idealErr);
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
    }
  }

  // Pre-interview device tests
  async startLobbyPreview() {
    try {
      // Clear previous lobby audio context
      if (this.lobbyAudioContext) {
        try {
          this.lobbyAudioContext.close();
        } catch (e) { }
        this.lobbyAudioContext = null;
      }

      const stream = await this.getStreamForDevices(this.selectedCameraId, this.selectedMicrophoneId);
      this.lobbyStream = stream;
      this.lobbyPreview.srcObject = stream;
      this.lobbyPreviewOverlay.style.opacity = 0;
      setTimeout(() => this.lobbyPreviewOverlay.style.display = 'none', 300);

      this.camStatusDot.classList.add('green');
      this.micStatusDot.classList.add('green');

      // Setup microphone volume level diagnostics on the lobby video preview
      if (this.lobbyVolumeIndicator) {
        this.lobbyAudioContext = this.setupStreamVolumeAnalyzer(stream, this.lobbyVolumeIndicator);
      }

      // Populate camera, mic, and speaker devices now that we have permissions
      await this.loadDevices();
    } catch (err) {
      console.warn("Camera or microphone permission denied in lobby tester:", err);
      this.lobbyPreviewOverlay.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i>
        <p style="padding: 10px; text-align: center;">Permission Denied. Please enable camera and mic permissions in your browser settings to continue.</p>
      `;
      this.camStatusDot.classList.remove('green');
      this.micStatusDot.classList.remove('green');
    }
  }

  async loadDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.warn("Media devices enumeration not supported in this browser.");
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      // Clear dropdowns
      this.cameraSelect.innerHTML = '';
      this.micSelect.innerHTML = '';
      this.speakerSelect.innerHTML = '';
      if (this.secondaryCameraSelect) {
        this.secondaryCameraSelect.innerHTML = '<option value="">Choose camera...</option>';
      }

      let camCount = 0;
      let micCount = 0;
      let speakerCount = 0;

      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;

        if (device.kind === 'videoinput') {
          option.text = device.label || `Camera ${++camCount}`;
          if (device.deviceId === this.selectedCameraId) {
            option.selected = true;
          }
          this.cameraSelect.appendChild(option);

          if (this.secondaryCameraSelect) {
            const secondaryOption = document.createElement('option');
            secondaryOption.value = device.deviceId;
            secondaryOption.text = device.label || `Camera ${camCount}`;
            if (device.deviceId === this.selectedSecondaryCameraId) {
              secondaryOption.selected = true;
            }
            this.secondaryCameraSelect.appendChild(secondaryOption);
          }
        } else if (device.kind === 'audioinput') {
          option.text = device.label || `Microphone ${++micCount}`;
          if (device.deviceId === this.selectedMicrophoneId) {
            option.selected = true;
          }
          this.micSelect.appendChild(option);
        } else if (device.kind === 'audiooutput') {
          option.text = device.label || `Speaker ${++speakerCount}`;
          if (device.deviceId === this.selectedSpeakerId) {
            option.selected = true;
          }
          this.speakerSelect.appendChild(option);
        }
      });

      // Add default placeholders if empty
      if (this.cameraSelect.children.length === 0) {
        this.cameraSelect.appendChild(new Option("No camera detected", ""));
      } else {
        if (!this.selectedCameraId) {
          this.selectedCameraId = this.cameraSelect.value;
        } else {
          this.cameraSelect.value = this.selectedCameraId;
        }
      }

      if (this.micSelect.children.length === 0) {
        this.micSelect.appendChild(new Option("No microphone detected", ""));
      } else {
        if (!this.selectedMicrophoneId) {
          this.selectedMicrophoneId = this.micSelect.value;
        } else {
          this.micSelect.value = this.selectedMicrophoneId;
        }
      }

      if (this.speakerSelect.children.length === 0) {
        this.speakerSelect.appendChild(new Option("Default Speaker", ""));
        const speakerGroup = document.getElementById('speaker-select-group');
        if (speakerGroup) speakerGroup.style.display = 'none';
      } else {
        const speakerGroup = document.getElementById('speaker-select-group');
        if (speakerGroup) speakerGroup.style.display = 'block';
        if (!this.selectedSpeakerId) {
          this.selectedSpeakerId = this.speakerSelect.value;
        } else {
          this.speakerSelect.value = this.selectedSpeakerId;
        }
      }
    } catch (err) {
      console.warn("Failed to enumerate devices:", err);
    }
  }

  async updateLobbyPreview() {
    if (this.lobbyAudioContext) {
      try {
        this.lobbyAudioContext.close();
      } catch (e) { }
      this.lobbyAudioContext = null;
    }

    if (this.lobbyStream) {
      this.lobbyStream.getTracks().forEach(track => track.stop());
    }
    this.lobbyPreview.srcObject = null; // Release hardware locks

    try {
      this.lobbyStream = await this.getStreamForDevices(this.selectedCameraId, this.selectedMicrophoneId);
      this.lobbyPreview.srcObject = this.lobbyStream;
      this.lobbyPreviewOverlay.style.opacity = 0;
      this.lobbyPreviewOverlay.style.display = 'none';

      this.camStatusDot.classList.add('green');
      this.micStatusDot.classList.add('green');

      // Update microphone volume level diagnostics
      if (this.lobbyVolumeIndicator) {
        this.lobbyAudioContext = this.setupStreamVolumeAnalyzer(this.lobbyStream, this.lobbyVolumeIndicator);
      }
    } catch (err) {
      console.warn("Failed to switch hardware in lobby preview:", err);
      this.lobbyPreviewOverlay.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i>
        <p style="padding: 10px; text-align: center;">Could not switch to chosen device. It might be in use or disconnected.</p>
      `;
      this.lobbyPreviewOverlay.style.display = 'flex';
      this.lobbyPreviewOverlay.style.opacity = 1;
      this.camStatusDot.classList.remove('green');
      this.micStatusDot.classList.remove('green');
    }
  }

  async testSpeaker() {
    try {
      this.cancelSpeech();
      const text = "In springtime, the garden comes alive with colorful flowers and singing birds. The old oak tree provides shade for visitors, while butterflies dance among the roses. A small fountain creates peaceful sounds, making this the perfect spot to relax and enjoy nature's beauty.";
      const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}&model=elevenlabs&voice=YZHSTqsq1isdXNsFLzBw`;
      const audio = new Audio(ttsUrl);

      // Attempt to route audio output if setSinkId is supported
      if (this.selectedSpeakerId && typeof audio.setSinkId === 'function') {
        try {
          await audio.setSinkId(this.selectedSpeakerId);
        } catch (sinkErr) {
          console.warn("Failed to set speaker output sink on test audio:", sinkErr);
        }
      }

      this.currentTtsAudio = audio;
      await audio.play();
    } catch (err) {
      console.error("Audio speaker test failed:", err);
    }
  }

  showSetupConfirmation() {
    if (!this.confirmModal) return;

    const isResumeMode = this.interviewModeSelect && this.interviewModeSelect.value === 'resume';

    // Populate Settings details
    if (this.confirmCandidateName) this.confirmCandidateName.innerText = this.nameInput.value.trim() || 'Candidate';
    if (this.confirmInterviewTopic) {
      this.confirmInterviewTopic.innerText = isResumeMode ? 'Resume Evaluation' : (this.topicInput.value.trim() || 'React Developer');
    }
    if (this.confirmInterviewDifficulty) this.confirmInterviewDifficulty.innerText = this.difficultySelect.value;
    if (this.confirmQuestionCount) {
      this.confirmQuestionCount.innerText = isResumeMode ? '8 Questions' : `${this.questionCountSelect.value} Questions`;
    }

    // Populate Device details
    if (this.confirmCameraName) {
      this.confirmCameraName.innerText = this.cameraSelect.options[this.cameraSelect.selectedIndex]?.text || 'Default Camera';
    }
    if (this.confirmMicName) {
      this.confirmMicName.innerText = this.micSelect.options[this.micSelect.selectedIndex]?.text || 'Default Microphone';
    }
    if (this.confirmSpeakerName) {
      this.confirmSpeakerName.innerText = this.speakerSelect.options[this.speakerSelect.selectedIndex]?.text || 'Default Speaker';
    }
    if (this.confirmSecondaryCameraName) {
      const secondaryMode = this.secondaryCameraModeSelect ? this.secondaryCameraModeSelect.value : '';
      if (secondaryMode === 'phone') {
        this.confirmSecondaryCameraName.innerText = 'Connected Mobile Phone';
      } else if (secondaryMode === 'webcam') {
        this.confirmSecondaryCameraName.innerText = this.secondaryCameraSelect.options[this.secondaryCameraSelect.selectedIndex]?.text || 'Secondary Webcam';
      } else {
        this.confirmSecondaryCameraName.innerText = 'Not Connected (Compulsory)';
      }
    }
    if (this.confirmIncludeCoding && this.includeCodingSelect) {
      this.confirmIncludeCoding.innerText = this.includeCodingSelect.value === 'yes' ? 'Yes, Include coding assessment' : 'No, Theory questions only';
    }

    // Toggle confirm speaker group depending on availability
    const speakerGroup = document.getElementById('speaker-select-group');
    const confirmSpeakerGroup = document.getElementById('confirm-speaker-group');
    if (confirmSpeakerGroup) {
      confirmSpeakerGroup.style.display = (speakerGroup && speakerGroup.style.display === 'none') ? 'none' : 'flex';
    }

    this.confirmModal.classList.add('active');
  }

  // Initialize Speech Recognition API
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech Recognition API not supported in this browser.");
      if (this.micStatusBadge) this.micStatusBadge.style.display = 'none';
      document.getElementById('text-input-fallback-wrapper').style.opacity = '1';
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.recognitionIsStartingOrRunning = true;
      if (this.micStatusText) this.micStatusText.innerText = 'Listening...';
      if (this.micStatusBadge) {
        this.micStatusBadge.className = 'mic-status-badge listening';
      }
      this.sttOverlay.classList.add('active');

      if (this.sttHeaderSpan) {
        this.sttHeaderSpan.innerText = 'Listening... (Continuous Mode)';
      }

      const currentVal = this.textResponseInput.value.trim();
      if (!currentVal || currentVal === 'Listening for your response...') {
        this.sttTranscriptText.innerText = 'Listening for your response...';
      }
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentSessionTranscript = finalTranscript || interimTranscript;
      if (currentSessionTranscript) {
        const fullTranscript = this.accumulatedTranscript
          ? `${this.accumulatedTranscript} ${currentSessionTranscript}`
          : currentSessionTranscript;

        this.sttTranscriptText.innerText = fullTranscript;
        this.textResponseInput.value = fullTranscript;

        // Mark that candidate has started speaking
        if (fullTranscript.trim().length > 3) {
          this.hasSpoken = true;
          // Clear any idle timers since they spoke
          if (this.idleWarningTimer) {
            clearTimeout(this.idleWarningTimer);
            this.idleWarningTimer = null;
          }
          if (this.idleSkipTimer) {
            clearTimeout(this.idleSkipTimer);
            this.idleSkipTimer = null;
          }
        }

        // Voice input active: refresh the smart silence auto-submit window (3 seconds)
        this.resetSmartSilenceTimer();
      }
    };

    this.recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);

      // Treat no-speech as non-fatal, allowing SpeechRecognition to restart
      if (event.error === 'no-speech') {
        return;
      }

      this.hasSttError = true;
      this.clearAllSpeechTimers();

      let errorMsg = "Speech recognition error occurred.";
      if (event.error === 'not-allowed') {
        errorMsg = 'Microphone permission denied. Please allow microphone access in your browser settings.';
        this.showCustomAlert("Microphone Blocked", "Microphone access is blocked. Please click the lock/microphone icon in your browser address bar and enable microphone permissions for this site.", true);
      } else if (event.error === 'audio-capture') {
        errorMsg = 'No microphone detected or it is in use by another application.';
        this.showCustomAlert("Audio Capture Failed", "Microphone capture failed. Please check that your microphone is connected and not occupied by another app.", true);
      } else if (event.error === 'network') {
        errorMsg = 'Network error. Speech recognition requires an active internet connection.';
      }

      this.sttTranscriptText.innerText = errorMsg;
    };

    this.recognition.onend = () => {
      this.recognitionIsStartingOrRunning = false;
      this.isListening = false;

      // If there was a fatal error, close STT
      if (this.hasSttError) {
        setTimeout(() => {
          this.stopListeningState();
          this.hasSttError = false;
        }, 3000);
        return;
      }

      // Save whatever text was transcribed in this session block
      this.accumulatedTranscript = this.textResponseInput.value.trim();

      // If speech session remains active and mic is enabled, restart browser recognition
      if (this.isSpeechActive) {
        const audioTrack = this.localStream ? this.localStream.getAudioTracks()[0] : null;
        if (audioTrack && audioTrack.enabled) {
          this.safeStartSpeechRecognition();
        }
      } else {
        // Recognition stopped logically, sync UI state
        if (this.micStatusText) {
          if (this.isRecruiterSpeaking) {
            this.micStatusText.innerText = 'Recruiter Speaking';
            if (this.micStatusBadge) this.micStatusBadge.className = 'mic-status-badge speaking';
          } else {
            const audioTrack = this.localStream ? this.localStream.getAudioTracks()[0] : null;
            if (audioTrack && !audioTrack.enabled) {
              this.micStatusText.innerText = 'Microphone Muted';
              if (this.micStatusBadge) this.micStatusBadge.className = 'mic-status-badge muted';
            } else {
              this.micStatusText.innerText = 'Microphone Active';
              if (this.micStatusBadge) this.micStatusBadge.className = 'mic-status-badge';
            }
          }
        }
      }
    };
  }

  safeStartSpeechRecognition() {
    if (!this.recognition) return;
    if (this.recognitionIsStartingOrRunning) {
      console.log("[SpeechRecognition] Already starting or running. Ignoring start request.");
      return;
    }
    try {
      this.recognition.start();
      this.recognitionIsStartingOrRunning = true;
    } catch (err) {
      console.warn("[SpeechRecognition] Error in start():", err);
      if (err.message && err.message.includes("already started")) {
        this.recognitionIsStartingOrRunning = true;
      } else {
        this.recognitionIsStartingOrRunning = false;
      }
    }
  }

  safeStopSpeechRecognition() {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch (err) {
      console.warn("[SpeechRecognition] Error in stop():", err);
    }
  }

  safeAbortSpeechRecognition() {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
    } catch (err) {
      console.warn("[SpeechRecognition] Error in abort():", err);
    }
  }

  stopListeningState() {
    this.isListening = false;
    this.isSpeechActive = false;
    this.clearAllSpeechTimers();
    if (this.micStatusText) {
      const audioTrack = this.localStream ? this.localStream.getAudioTracks()[0] : null;
      if (audioTrack && !audioTrack.enabled) {
        this.micStatusText.innerText = 'Microphone Muted';
        if (this.micStatusBadge) this.micStatusBadge.className = 'mic-status-badge muted';
      } else {
        this.micStatusText.innerText = 'Microphone Active';
        if (this.micStatusBadge) this.micStatusBadge.className = 'mic-status-badge';
      }
    }
    this.sttOverlay.classList.remove('active');
  }

  clearAllSpeechTimers() {
    this.clearSmartSilenceTimer();
    if (this.idleWarningTimer) {
      clearTimeout(this.idleWarningTimer);
      this.idleWarningTimer = null;
    }
    if (this.idleSkipTimer) {
      clearTimeout(this.idleSkipTimer);
      this.idleSkipTimer = null;
    }
  }

  resetSmartSilenceTimer() {
    this.clearSmartSilenceTimer();
    if (this.isSpeechActive && this.hasSpoken) {
      this.smartSilenceTimer = setTimeout(() => {
        console.log("[Smart Silence] 3 seconds of silence detected after speech. Auto-submitting response.");
        const finalVal = this.textResponseInput.value.trim();
        if (finalVal && finalVal.length > 3) {
          this.submitCandidateAnswer(finalVal);
        }
      }, 3000);
    }
  }

  clearSmartSilenceTimer() {
    if (this.smartSilenceTimer) {
      clearTimeout(this.smartSilenceTimer);
      this.smartSilenceTimer = null;
    }
  }

  startListeningForCandidateAnswer() {
    if (!this.interviewActive || this.codingPhase) return;

    // Check if mic is muted
    const audioTrack = this.localStream ? this.localStream.getAudioTracks()[0] : null;
    if (audioTrack && !audioTrack.enabled) {
      console.log("Mic is muted. Not starting recognition, waiting for unmute.");
      if (this.micStatusText) this.micStatusText.innerText = 'Microphone Muted';
      if (this.micStatusBadge) this.micStatusBadge.className = 'mic-status-badge muted';
      this.sttOverlay.classList.add('active');
      this.sttTranscriptText.innerText = 'Microphone is muted. Please unmute to speak, or type your answer below.';
      return;
    }

    this.cancelSpeech();
    this.clearAllSpeechTimers();

    this.textResponseInput.value = '';
    this.accumulatedTranscript = '';
    this.hasSttError = false;
    this.hasSpoken = false;
    this.isSpeechActive = true;

    // Start recognition
    this.safeStartSpeechRecognition();

    // Start 15s idle warning timer
    this.idleWarningTimer = setTimeout(() => {
      if (!this.hasSpoken && this.interviewActive && !this.codingPhase) {
        this.sttTranscriptText.innerText = "No speech detected yet. Please speak your answer, or type it below.";
      }
    }, 15000);

    // Start 30s idle skip timer
    this.idleSkipTimer = setTimeout(() => {
      if (!this.hasSpoken && this.interviewActive && !this.codingPhase) {
        console.log("30 seconds of absolute silence. Skipping question.");
        this.submitCandidateAnswer("Candidate remained silent.");
      }
    }, 30000);
  }


  // Toggle controls
  toggleMicrophone() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        if (audioTrack.enabled) {
          this.micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
          this.micToggleBtn.classList.remove('disabled');

          // Unmuted: start listening again if in verbal phase and recruiter isn't speaking
          if (this.interviewActive && !this.codingPhase && !this.isRecruiterSpeaking) {
            this.startListeningForCandidateAnswer();
          }
        } else {
          this.micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
          this.micToggleBtn.classList.add('disabled');

          // Muted: stop speech recognition and timers immediately
          this.isSpeechActive = false;
          this.clearAllSpeechTimers();
          this.safeAbortSpeechRecognition();

          if (this.micStatusText) this.micStatusText.innerText = 'Microphone Muted';
          if (this.micStatusBadge) this.micStatusBadge.className = 'mic-status-badge muted';
          this.sttOverlay.classList.add('active');
          this.sttTranscriptText.innerText = 'Microphone is muted. Please unmute to speak, or type your answer below.';
        }
      }
    }
  }

  toggleCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        if (videoTrack.enabled) {
          this.camToggleBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
          this.camToggleBtn.classList.remove('disabled');
          this.candidateWebcam.style.opacity = '1';
        } else {
          this.camToggleBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i>';
          this.camToggleBtn.classList.add('disabled');
          this.candidateWebcam.style.opacity = '0';

          // Camera disabled manually: trigger proctor warning!
          this.triggerCheatWarning("Webcam was disabled. Keeping your camera enabled is mandatory.", "camera");
        }
      }
    }
  }

  toggleChatDrawer() {
    const isCollapsed = this.chatContainer.classList.toggle('collapsed');
    if (isCollapsed) {
      this.interviewScreen.classList.add('chat-collapsed');
    } else {
      this.interviewScreen.classList.remove('chat-collapsed');
    }
    // Trigger Three.js canvas redraw
    if (this.avatarManager) {
      setTimeout(() => {
        this.avatarManager.onWindowResize();
        window.dispatchEvent(new Event('resize'));
      }, 150);
    }
  }

  // Fallback text responder submit
  submitTextResponse() {
    const text = this.textResponseInput.value.trim();
    if (!text) return;
    if (this.submitTimeout) clearTimeout(this.submitTimeout);
    this.submitCandidateAnswer(text);
  }

  // Show/Hide global loaders
  showLoader(title, desc) {
    this.loaderTitle.innerText = title;
    this.loaderDesc.innerText = desc;
    this.globalLoader.classList.add('active');
  }

  hideLoader() {
    this.globalLoader.classList.remove('active');
  }

  // Setup/Start Interview Process
  async startInterview() {
    this.isRecruiterSpeaking = false;
    this.recognitionIsStartingOrRunning = false;
    const isResumeMode = this.interviewModeSelect && this.interviewModeSelect.value === 'resume';

    this.userName = this.nameInput.value.trim() || 'Candidate';
    this.topic = isResumeMode ? 'Resume Evaluation' : (this.topicInput.value.trim() || 'React Developer');
    this.difficulty = this.difficultySelect.value;
    this.totalQuestions = isResumeMode ? 8 : (parseInt(this.questionCountSelect.value) || 5);
    this.currentQuestionIndex = 0;
    this.chatHistory = [];
    this.elapsedSeconds = 0;

    // Trigger Fullscreen on interview start
    this.enterFullscreen();

    // Reset warning logs
    this.warningCounts = {
      tab: 0,
      focus: 0,
      fullscreen: 0,
      clipboard: 0,
      camera: 0,
      monitor: 0,
      noface: 0,
      multiface: 0,
      lookaway: 0,
      eyegaze: 0,
      audio: 0,
      mobile_device: 0
    };
    this.tabChangeWarnings = 0;
    this.mobileWarningCount = 0;
    this.violationScreenshots = [];

    // Reset Stepper UI
    const stepVerbal = document.getElementById('step-verbal-indicator');
    const stepCoding = document.getElementById('step-coding-indicator');
    const stepReport = document.getElementById('step-report-indicator');
    const divider1 = document.getElementById('step-divider-1');
    const divider2 = document.getElementById('step-divider-2');

    if (stepVerbal) stepVerbal.className = 'step step-verbal active';
    if (stepCoding) stepCoding.className = 'step step-coding';
    if (stepReport) stepReport.className = 'step step-report';
    if (divider1) divider1.className = 'step-divider';
    if (divider2) divider2.className = 'step-divider';

    // Reset coding phase variables
    this.currentCodingQuestion = null;
    this.codingPhase = false;
    this.passedCount = 0;
    this.totalCount = 0;
    this.includeCoding = this.includeCodingSelect ? (this.includeCodingSelect.value === 'yes') : true;
    if (this.codeEditor) this.codeEditor.value = '';
    this.interviewScreen.classList.remove('coding-active');
    if (this.codingWorkspace) this.codingWorkspace.style.display = 'none';

    // Display configuration in call header
    this.callTopicDisplay.innerText = `${this.topic} - ${this.difficulty}`;
    this.questionProgress.innerText = `Q 1 / ${this.totalQuestions}`;

    // Show setting up loader
    this.showLoader("Setting Up Session", "Activating camera, testing audio, and initializing AI recruiter model...");

    this.stopMicTest(); // Stop any running mic test

    // 1. Setup Camera and Audio Stream
    try {
      // Release lobby preview audio context and streams so camera/mic are free
      if (this.lobbyAudioContext) {
        try {
          this.lobbyAudioContext.close();
        } catch (e) { }
        this.lobbyAudioContext = null;
      }
      if (this.lobbyStream) {
        this.lobbyStream.getTracks().forEach(track => track.stop());
        this.lobbyStream = null;
      }
      this.lobbyPreview.srcObject = null;

      this.localStream = await this.getStreamForDevices(this.selectedCameraId, this.selectedMicrophoneId);
      this.candidateWebcam.srcObject = this.localStream;

      // Setup active call room volume level indicator
      if (this.volumeIndicator) {
        this.audioContext = this.setupStreamVolumeAnalyzer(this.localStream, this.volumeIndicator);
      }

      // Monitor camera track muting or hardware disconnects
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('mute', () => {
          if (this.interviewActive) {
            this.triggerCheatWarning("Your webcam track was muted at the hardware source.", "camera");
          }
        });
        videoTrack.addEventListener('ended', () => {
          if (this.interviewActive) {
            this.triggerCheatWarning("Your webcam track disconnected or was terminated.", "camera");
          }
        });
      }
    } catch (err) {
      console.error("Failed to fetch camera stream for call room:", err);
      // Let interview continue in text mode if camera fails
      this.candidateWebcam.style.opacity = 0;
      this.showCustomAlert("Hardware Access", "Could not access camera/mic. The interview will run in Text Fallback Mode.", false);
    }

    // 2. Load 3D Recruiter Avatar
    const canvasContainer = document.getElementById('canvas-container');
    canvasContainer.innerHTML = ''; // Clear previous elements

    document.getElementById('avatar-loader').style.display = 'flex';

    this.avatarManager = new AvatarManager(
      'canvas-container',
      DEFAULT_AVATAR_URL,
      () => {
        // Hide avatar progress spinner
        document.getElementById('avatar-loader').style.display = 'none';
        console.log("Avatar loaded successfully inside app.js");
      }
    );

    // 3. Initiate first question from Express backend
    this.hasResume = isResumeMode && !!this.resumeText;
    this.totalQuestions = this.hasResume ? 8 : this.totalQuestions;
    const apiPayload = {
      name: this.userName,
      topic: this.topic,
      difficulty: this.difficulty,
      numQuestions: this.totalQuestions,
      resumeText: this.hasResume ? (this.resumeText || '') : ''
    };

    try {
      // Dynamic header inject if frontend API key is supplied
      const customKey = this.apiKeyInput.value.trim();
      const headers = { 'Content-Type': 'application/json' };

      // Let's send the API Key directly to backend in headers so it can set it dynamically!
      // This is a highly robust method, supporting dynamic developer testing.
      if (customKey) {
        headers['x-groq-key'] = customKey;
        apiPayload.groqApiKey = customKey;
      }

      const response = await fetch('/api/start-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
      });

      if (!response.ok) throw new Error("Server start call failed");
      const data = await response.json();

      // Retrieve generated coding challenges from backend
      this.totalQuestions = data.totalQuestions || this.totalQuestions;
      if (data.codingQuestions && Array.isArray(data.codingQuestions)) {
        this.codingQuestionsList = data.codingQuestions;
        this.currentCodingQuestion = data.codingQuestions[0];
      } else {
        this.codingQuestionsList = data.codingQuestion ? [data.codingQuestion] : [];
        this.currentCodingQuestion = data.codingQuestion;
      }
      if (this.codingQuestionsList.length === 0) {
        this.includeCoding = false;
        // update Stepper UI to show step-coding is disabled/skipped
        const stepCoding = document.getElementById('step-coding-indicator');
        if (stepCoding) {
          stepCoding.style.opacity = '0.5';
          stepCoding.style.cursor = 'not-allowed';
          stepCoding.title = `Not available for ${this.topic}`;
        }
      }
      this.currentCodingQuestionIndex = 0;
      this.codingScoreDetails = [];

      // Clear transcripts log
      this.chatLog.innerHTML = '';

      // Hide global loader overlay
      this.hideLoader();

      // Show call screen
      this.lobbyScreen.classList.remove('active');
      this.interviewScreen.classList.add('active');
      this.interviewActive = true;

      // Show proctoring indicators
      if (this.proctorStatusIndicator) {
        this.proctorStatusIndicator.style.display = 'flex';
      }
      this.consecutiveNoFace = 0;
      this.consecutiveMultiFace = 0;
      this.consecutiveLookAway = 0;
      this.continuousLoudSoundTicks = 0;
      this.startWebcamProctoring();

      // Start real-time mobile phone detection proctoring
      this.mobileWarningCount = 0;
      this.initMobileDetection();

      // Trigger a resize update to ensure the canvas container has correct dimensions
      if (this.avatarManager) {
        setTimeout(() => {
          this.avatarManager.onWindowResize();
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }

      // Start duration clock
      this.startTimer();

      // Start periodic monitor checker (every 3 seconds)
      this.monitorCheckInterval = setInterval(() => {
        if (this.interviewActive) {
          this.checkSecondaryMonitor();
        }
      }, 3000);

      // Present question
      this.presentRecruiterQuestion(data.question, data.emotion || 'smiling');

    } catch (err) {
      console.error("Failed starting interview session:", err);
      this.hideLoader();
      this.showCustomAlert("Connection Error", "Error initiating interview. Please ensure the backend server is running and reachable.", true);
    }
  }

  // Present Recruiter Question (Speech + Subtitles + Chat bubble)
  presentRecruiterQuestion(questionText, emotion = 'smiling') {
    if (!this.interviewActive) return;

    this.repeatCount = 0; // Reset repeat counter for the new question

    // Set avatar expression
    if (this.avatarManager) {
      this.avatarManager.setEmotion(emotion);
    }

    // Update progress overlay and captions
    this.questionProgress.innerText = `Q ${this.currentQuestionIndex + 1} / ${this.totalQuestions}`;
    this.subtitleText.innerText = questionText;

    // Append to Chat Log drawer
    this.appendMessage('Recruiter', questionText, 'recruiter-msg');

    // Trigger TTS (Voice Output)
    this.speakText(questionText);
  }

  // Helper to cancel any active speech synthesis or custom audio playback
  cancelSpeech() {
    this.isRecruiterSpeaking = false;

    // Cancel native SpeechSynthesis
    window.speechSynthesis.cancel();

    // Cancel custom audio TTS
    if (this.currentTtsAudio) {
      try {
        this.currentTtsAudio.pause();
        this.currentTtsAudio.src = '';
      } catch (e) { }
      this.currentTtsAudio = null;
    }

    if (this.avatarManager) {
      this.avatarManager.setSpeaking(false);
    }
  }

  // Voice Speech Synthesis (Attempts backend proxy for headphone routing, falls back to native)
  async speakText(text) {
    this.cancelSpeech();

    // Clean text from emojis or brackets
    const cleanText = text.replace(/\[.*?\]/g, '').trim();

    this.isRecruiterSpeaking = true;
    this.isSpeechActive = false;
    this.clearAllSpeechTimers();
    this.safeAbortSpeechRecognition();
    if (this.micStatusText) this.micStatusText.innerText = 'Recruiter Speaking';
    if (this.micStatusBadge) this.micStatusBadge.className = 'mic-status-badge speaking';

    try {
      const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&model=elevenlabs&voice=YZHSTqsq1isdXNsFLzBw`;
      const audio = new Audio(ttsUrl);
      this.currentTtsAudio = audio;

      // Attempt to route audio output if setSinkId is supported
      if (typeof audio.setSinkId === 'function') {
        try {
          await audio.setSinkId(this.selectedSpeakerId);
        } catch (sinkErr) {
          console.warn("Failed to set speaker output sink on custom audio TTS:", sinkErr);
        }
      }

      audio.onplay = () => {
        if (this.avatarManager) {
          this.avatarManager.setSpeaking(true);
        }
      };

      audio.onended = () => {
        if (this.avatarManager) {
          this.avatarManager.setSpeaking(false);
        }
        this.currentTtsAudio = null;
        this.isRecruiterSpeaking = false;
        this.startListeningForCandidateAnswer();
      };

      audio.onerror = (err) => {
        if (!this.isRecruiterSpeaking || this.currentTtsAudio !== audio) {
          console.log("[TTS] Audio error ignored because speaking state is cancelled or changed.");
          return;
        }
        console.warn("Audio TTS failed to load/play, falling back to native SpeechSynthesis:", err);
        this.currentTtsAudio = null;
        this.playNativeSpeech(cleanText);
      };

      await audio.play();
    } catch (err) {
      if (!this.isRecruiterSpeaking || this.currentTtsAudio !== audio) {
        console.log("[TTS] Audio play exception caught and ignored because speaking state is cancelled or changed.");
        return;
      }
      console.warn("Audio TTS play request failed, falling back to native SpeechSynthesis:", err);
      this.currentTtsAudio = null;
      this.playNativeSpeech(cleanText);
    }
  }

  // Native Speech Synthesis Fallback
  playNativeSpeech(cleanText) {
    this.currentUtterance = new SpeechSynthesisUtterance(cleanText);

    // Get English Voices (Prioritize Indian English for natural local tone, then fallback)
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = voices.find(v => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('en-in') && v.name.toLowerCase().includes('google');
    }) || voices.find(v => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('en-in');
    }) || voices.find(v => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('en-us') && v.name.includes('Natural');
    }) || voices.find(v => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('en-us') && v.name.includes('Google');
    }) || voices.find(v => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('en-us');
    }) || voices.find(v => {
      const lang = v.lang.toLowerCase().replace('_', '-');
      return lang.startsWith('en');
    });

    if (selectedVoice) {
      this.currentUtterance.voice = selectedVoice;
    }

    this.currentUtterance.rate = 1.0;
    this.currentUtterance.pitch = 1.0;

    this.currentUtterance.onstart = () => {
      if (this.avatarManager) {
        this.avatarManager.setSpeaking(true);
      }
    };

    this.currentUtterance.onend = () => {
      if (this.avatarManager) {
        this.avatarManager.setSpeaking(false);
      }
      this.isRecruiterSpeaking = false;
      this.startListeningForCandidateAnswer();
    };

    this.currentUtterance.onerror = (e) => {
      console.warn("Native TTS Synthesis Error:", e);
      if (this.avatarManager) {
        this.avatarManager.setSpeaking(false);
      }
      this.isRecruiterSpeaking = false;
      this.startListeningForCandidateAnswer();
    };

    window.speechSynthesis.speak(this.currentUtterance);
  }

  // Get the core question part (last 1 or 2 sentences)
  getCoreQuestion(text) {
    if (!text) return '';
    // Split by sentence boundaries, keeping punctuation
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
    if (sentences.length <= 2) {
      return text;
    }
    // Return the last 1 or 2 sentences
    return sentences.slice(-2).join('').trim();
  }

  // Submit Answer to Server
  async submitCandidateAnswer(answerText) {
    if (!answerText || !this.interviewActive) return;

    this.isSpeechActive = false;
    this.clearAllSpeechTimers();
    this.safeAbortSpeechRecognition();
    this.stopListeningState();

    // Detect if candidate is asking to repeat the question
    const cleanAnswer = answerText.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const repeatPhrases = [
      "repeat",
      "repeat please",
      "can you repeat",
      "can you repeat the question",
      "repeat the question",
      "pardon",
      "please repeat",
      "repeat that",
      "could you repeat",
      "could you repeat the question"
    ];

    if (repeatPhrases.includes(cleanAnswer) || cleanAnswer === 'repeat' || cleanAnswer === 'pardon' || cleanAnswer.endsWith('repeat') || cleanAnswer.endsWith('repeat the question')) {
      if (!this.repeatCount) {
        this.repeatCount = 0;
      }

      if (this.repeatCount < 2) {
        this.repeatCount++;
        const fullQuestion = this.subtitleText.innerText;
        const coreQuestion = this.getCoreQuestion(fullQuestion);

        // Append repeated question notification to chat drawer
        this.appendMessage('Recruiter (Repeated)', coreQuestion, 'recruiter-msg');

        // Speak the core question
        this.speakText(coreQuestion);
        this.textResponseInput.value = '';
        return;
      } else {
        const msg = "We have already repeated this question twice. Please try to answer as best as you can, or say 'skip' to move on.";
        this.appendMessage('Recruiter', msg, 'recruiter-msg');
        this.speakText(msg);
        this.textResponseInput.value = '';
        return;
      }
    }

    // Append response to chat drawer
    this.appendMessage('You', answerText, 'candidate-msg');

    // Clear input box
    this.textResponseInput.value = '';

    // Add to local history
    const currentQuestionObj = {
      question: this.subtitleText.innerText,
      answer: answerText
    };
    this.chatHistory.push(currentQuestionObj);

    // Stop speaking if recruiter is still speaking
    this.cancelSpeech();

    // Show loading indicator
    this.showLoader("Processing Response", "AI recruiter is evaluating your response and preparing the next question...");

    const customKey = this.apiKeyInput.value.trim();

    const apiPayload = {
      name: this.userName,
      topic: this.topic,
      difficulty: this.difficulty,
      numQuestions: this.totalQuestions,
      currentQuestionIndex: this.currentQuestionIndex,
      candidateAnswer: answerText,
      history: this.chatHistory,
      groqApiKey: customKey
    };

    try {
      const response = await fetch('/api/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
      });

      if (!response.ok) throw new Error("Failed to submit response");
      const data = await response.json();

      this.hideLoader();

      // Show brief popup or log recruiter's brief feedback
      console.log("Recruiter feedback:", data.feedback);

      this.currentQuestionIndex = data.currentQuestionIndex;

      if (data.isComplete || this.currentQuestionIndex >= this.totalQuestions) {
        if (this.includeCoding && this.codingQuestionsList.length > 0) {
          // Call is complete - transition recruiter and screen to coding challenge phase
          const transitionMsg = "We have finished the verbal theory questions. Now, let's proceed to the coding assessment. Please look at the challenge on the screen, write your solution in the editor, and run the tests.";
          this.presentRecruiterQuestion(transitionMsg, 'friendly');
          setTimeout(() => this.startCodingTestPhase(), 4000);
        } else {
          // Immediately compile report and finish
          let endMsg = data.question || "Thank you. I will now compile your feedback report.";
          if (this.codingQuestionsList.length === 0) {
            endMsg = `We have finished the verbal theory questions. Since a live coding environment is not possible for ${this.topic}, there is no coding question for ${this.topic}. I will now compile your feedback report.`;
          }
          this.presentRecruiterQuestion(endMsg, 'friendly');
          setTimeout(() => this.compileFinalReport(), 5000);
        }
      } else {
        // Load next question
        this.presentRecruiterQuestion(data.question, data.emotion || 'smiling');
      }

    } catch (err) {
      console.error("Error submitting answer:", err);
      this.hideLoader();
      this.showCustomAlert("Error", "Failed submitting response. Check server logs.", true);
    }
  }

  // Compile final interview analytics report
  async compileFinalReport(disqualified = false, disqualificationReason = '') {
    this.interviewActive = false;
    this.isSpeechActive = false;
    this.clearAllSpeechTimers();
    this.safeAbortSpeechRecognition();
    this.stopTimer();

    // Clear secondary monitor check interval
    if (this.monitorCheckInterval) {
      clearInterval(this.monitorCheckInterval);
      this.monitorCheckInterval = null;
    }
    if (this.webcamProctorInterval) {
      clearInterval(this.webcamProctorInterval);
      this.webcamProctorInterval = null;
    }
    this.stopMobileDetection();

    // Show compiling analysis loader
    this.showLoader("Compiling Performance Analytics", "Evaluating technical accuracy, generating career tips, and building report card...");

    // Stop and release web camera
    this.stopLocalMedia();

    const customKey = this.apiKeyInput.value.trim();

    // Sum up aggregate passed / total count for all challenges
    const totalPassed = this.codingScoreDetails.reduce((sum, item) => sum + item.passedCount, 0);
    const totalCount = this.codingScoreDetails.reduce((sum, item) => sum + item.totalCount, 0);

    const apiPayload = {
      name: this.userName,
      topic: this.topic,
      difficulty: this.difficulty,
      history: this.chatHistory,
      codingQuestion: this.currentCodingQuestion,
      codingQuestionsList: this.codingQuestionsList,
      codingScoreDetails: this.codingScoreDetails,
      candidateCode: this.codeEditor ? this.codeEditor.value : '',
      codingTestResults: {
        passedCount: totalPassed,
        totalCount: totalCount,
        testCases: this.currentCodingQuestion ? this.currentCodingQuestion.testCases : []
      },
      tabWarningsCount: this.tabChangeWarnings || 0,
      warningCounts: this.warningCounts,
      violationScreenshots: this.violationScreenshots || [],
      disqualified: disqualified,
      disqualificationReason: disqualificationReason,
      groqApiKey: customKey
    };

    try {
      const response = await fetch('/api/end-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
      });

      if (!response.ok) throw new Error("Failed to compile report");
      const data = await response.json();

      // Destroy Three.js canvas to free memory
      if (this.avatarManager) {
        this.avatarManager.destroy();
        this.avatarManager = null;
      }

      this.hideLoader();

      // Transition to report screen
      this.interviewScreen.classList.remove('active');
      this.reportScreen.classList.add('active');

      // Update Stepper UI to completed
      const stepCoding = document.getElementById('step-coding-indicator');
      const stepReport = document.getElementById('step-report-indicator');
      const divider1 = document.getElementById('step-divider-1');
      const divider2 = document.getElementById('step-divider-2');

      if (stepCoding) stepCoding.className = 'step step-coding completed';
      if (stepReport) stepReport.className = 'step step-report completed';
      if (divider1) divider1.className = 'step-divider completed';
      if (divider2) divider2.className = 'step-divider completed';

      // Populate performance feedback report card
      this.renderReport(data);

    } catch (err) {
      console.error("Error compiling report:", err);
      this.hideLoader();
      this.showCustomAlert("Report Error", "Failed generating report. Displaying local report card instead.", true);

      // local fallback display
      this.renderReport({
        overallScore: 70,
        strengths: ["Communication speed.", "Basic comprehension."],
        improvements: ["Elaborate on technical examples.", "Address edge-cases."],
        breakdown: this.chatHistory.map(h => ({
          question: h.question,
          answer: h.answer,
          feedback: "Attempted. Expand answers for higher score.",
          score: 70
        })),
        generalTips: ["Keep technical definitions simple."]
      });
    }
  }

  // Draw/Populate Report Card
  renderReport(reportData) {
    const score = parseInt(reportData.overallScore) || 0;
    this.reportScoreValue.innerText = score;

    // Render proctoring violation screenshots if any exist
    let screenshotsSection = document.getElementById('report-screenshots-section');
    if (!screenshotsSection) {
      const mainContent = document.querySelector('.report-main-content');
      if (mainContent) {
        screenshotsSection = document.createElement('div');
        screenshotsSection.id = 'report-screenshots-section';
        screenshotsSection.className = 'glass-panel breakdown-card';
        screenshotsSection.style.marginTop = '20px';
        mainContent.appendChild(screenshotsSection);
      }
    }

    if (reportData.violationScreenshots && reportData.violationScreenshots.length > 0) {
      if (screenshotsSection) {
        screenshotsSection.style.display = 'block';
        screenshotsSection.innerHTML = `
          <h2><i class="fa-solid fa-shield-halved text-danger" style="color: var(--color-danger); margin-right: 8px;"></i> Proctoring Integrity Violations</h2>
          <p style="font-size: 13.5px; color: var(--text-muted); margin-bottom: 20px;">
            The proctoring system detected potential mobile phone usage. The captured frames with highlighted detection areas are shown below:
          </p>
          <div class="screenshots-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
            ${reportData.violationScreenshots.map((url, idx) => `
              <div class="screenshot-card" style="border: 1px solid var(--panel-border); border-radius: 10px; overflow: hidden; background: rgba(0, 0, 0, 0.2);">
                <img src="${url}" alt="Violation Capture ${idx + 1}" style="width: 100%; height: auto; display: block; border-bottom: 1px solid var(--panel-border);" />
                <div style="padding: 12px; font-size: 13px; font-weight: bold; color: var(--color-danger); text-align: center; background: rgba(239, 68, 68, 0.05);">
                  Violation Event #${idx + 1}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    } else {
      if (screenshotsSection) screenshotsSection.style.display = 'none';
    }

    // Animate circular progress ring stroke
    // Circumference of r=76 circle = 2 * Math.PI * 76 = 477.5
    const circumference = 477.5;
    const offset = circumference - (score / 100) * circumference;
    this.reportScoreCircle.style.strokeDashoffset = offset;

    // Grade badge color
    if (reportData.isDisqualified) {
      this.reportLevelBadge.innerText = "DISQUALIFIED";
      this.reportLevelBadge.className = "score-badge fail";
      this.reportLevelBadge.style.background = "rgba(239, 68, 68, 0.15)";
      this.reportLevelBadge.style.color = "var(--color-danger)";
      this.reportLevelBadge.style.borderColor = "var(--color-danger)";
    } else if (score >= 70) {
      this.reportLevelBadge.innerText = "PASSED";
      this.reportLevelBadge.className = "score-badge";
      this.reportLevelBadge.style.background = "";
      this.reportLevelBadge.style.color = "";
      this.reportLevelBadge.style.borderColor = "";
    } else {
      this.reportLevelBadge.innerText = "NEEDS PRACTICE";
      this.reportLevelBadge.className = "score-badge fail";
      this.reportLevelBadge.style.background = "";
      this.reportLevelBadge.style.color = "";
      this.reportLevelBadge.style.borderColor = "";
    }

    // Strengths
    this.strengthsList.innerHTML = '';
    reportData.strengths.forEach(str => {
      const li = document.createElement('li');
      li.innerText = str;
      this.strengthsList.appendChild(li);
    });

    // Improvements
    this.improvementsList.innerHTML = '';
    reportData.improvements.forEach(imp => {
      const li = document.createElement('li');
      li.innerText = imp;
      this.improvementsList.appendChild(li);
    });

    // Q&A Breakdown list
    this.breakdownList.innerHTML = '';
    reportData.breakdown.forEach((item, index) => {
      const bItem = document.createElement('div');
      bItem.className = 'breakdown-item';

      bItem.innerHTML = `
        <div class="breakdown-item-header">
          <h4>Q${index + 1}: ${item.question}</h4>
          <span class="item-score-badge">Score: ${item.score}%</span>
        </div>
        <div class="breakdown-answer">
          <strong>Your Answer:</strong> ${item.answer}
        </div>
        <div class="breakdown-ideal-answer">
          <i class="fa-solid fa-circle-check" style="color: var(--color-success);"></i>
          <div><strong>Model Answer:</strong> ${item.idealAnswer || item.technicalAnswer || 'A model answer is not available.'}</div>
        </div>
        <div class="breakdown-feedback">
          <i class="fa-solid fa-compass"></i>
          <div><strong>Feedback:</strong> ${item.feedback}</div>
        </div>
      `;
      this.breakdownList.appendChild(bItem);
    });

    // Tips list
    this.tipsList.innerHTML = '';
    reportData.generalTips.forEach(tip => {
      const li = document.createElement('li');
      li.innerText = tip;
      this.tipsList.appendChild(li);
    });

    // Populate coding review details card on the report screen
    if (reportData.codingFeedback) {
      const totalPassed = this.codingScoreDetails && this.codingScoreDetails.length > 0
        ? this.codingScoreDetails.reduce((sum, item) => sum + item.passedCount, 0)
        : this.passedCount;
      const totalCount = this.codingScoreDetails && this.codingScoreDetails.length > 0
        ? this.codingScoreDetails.reduce((sum, item) => sum + item.totalCount, 0)
        : this.totalCount;

      if (this.reportCodingCard) this.reportCodingCard.style.display = 'block';
      if (this.reportCodingTitle) {
        this.reportCodingTitle.innerText = this.codingQuestionsList && this.codingQuestionsList.length > 1
          ? "Coding Assessment Evaluation"
          : (this.currentCodingQuestion ? this.currentCodingQuestion.title : 'Coding Challenge');
      }
      if (this.reportCodingPassBadge) {
        this.reportCodingPassBadge.innerText = `${totalPassed} / ${totalCount} Passed`;
        if (totalPassed === totalCount) {
          this.reportCodingPassBadge.style.background = 'rgba(16, 185, 129, 0.1)';
          this.reportCodingPassBadge.style.color = 'var(--color-success)';
          this.reportCodingPassBadge.style.borderColor = 'rgba(16, 185, 129, 0.2)';
        } else {
          this.reportCodingPassBadge.style.background = 'rgba(239, 68, 68, 0.1)';
          this.reportCodingPassBadge.style.color = 'var(--color-danger)';
          this.reportCodingPassBadge.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        }
      }
      if (this.reportCodingCode) {
        if (this.codingScoreDetails && this.codingScoreDetails.length > 0) {
          this.reportCodingCode.innerText = this.codingScoreDetails.map((item, idx) => {
            return `// Challenge ${idx + 1}: ${item.title}\n${item.code}`;
          }).join('\n\n');
        } else {
          this.reportCodingCode.innerText = this.codeEditor ? this.codeEditor.value : '// No code submitted';
        }
      }
      if (this.reportCodingFeedback) {
        // Format basic markdown elements for the code review window
        let rawFeedback = reportData.codingFeedback;
        let formattedFeedback = rawFeedback
          .replace(/\n/g, '<br>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');
        this.reportCodingFeedback.innerHTML = formattedFeedback;
      }
    } else {
      if (this.reportCodingCard) this.reportCodingCard.style.display = 'none';
    }
  }

  // End Interview manually / click red button
  async endInterviewEarly() {
    const confirmed = await this.showCustomConfirm("End Interview", "Are you sure you want to end the interview early? Your feedback will be generated based on the completed questions.");
    if (confirmed) {
      this.compileFinalReport();
    }
  }

  // Clean and reset screen views back to lobby setup
  resetToLobby() {
    this.isSpeechActive = false;
    this.clearAllSpeechTimers();
    this.safeAbortSpeechRecognition();

    // Clear monitor checker interval
    if (this.monitorCheckInterval) {
      clearInterval(this.monitorCheckInterval);
      this.monitorCheckInterval = null;
    }
    if (this.webcamProctorInterval) {
      clearInterval(this.webcamProctorInterval);
      this.webcamProctorInterval = null;
    }
    this.stopMobileDetection();
    this.mobileWarningCount = 0;
    this.violationScreenshots = [];
    if (this.proctorStatusIndicator) {
      this.proctorStatusIndicator.style.display = 'none';
    }

    // Reset step coding styles if disabled
    const stepCoding = document.getElementById('step-coding-indicator');
    if (stepCoding) {
      stepCoding.style.opacity = '';
      stepCoding.style.cursor = '';
      stepCoding.title = '';
    }

    this.interviewScreen.classList.remove('coding-active');
    if (this.codingWorkspace) this.codingWorkspace.style.display = 'none';
    this.reportScreen.classList.remove('active');
    this.lobbyScreen.classList.add('active');
    this.startLobbyPreview();
  }

  // Clean media tracks
  stopLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.stopPhoneConnection();
    this.volumeVisualizerActive = false;
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) { }
      this.audioContext = null;
    }
    if (this.lobbyAudioContext) {
      try {
        this.lobbyAudioContext.close();
      } catch (e) { }
      this.lobbyAudioContext = null;
    }
  }

  // Helper: Append dialog logs in drawer
  appendMessage(sender, text, cssClass) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${cssClass}`;
    msgDiv.innerHTML = `
      <span class="msg-sender">${sender}</span>
      <div class="msg-bubble">${text}</div>
    `;
    this.chatLog.appendChild(msgDiv);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  // Call duration counter timer
  startTimer() {
    this.elapsedSeconds = 0;
    this.callTimer.innerText = "00:00";

    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      const mins = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0');
      const secs = (this.elapsedSeconds % 60).toString().padStart(2, '0');
      this.callTimer.innerText = `${mins}:${secs}`;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Generalized Web Audio mic volume visualizer setup
  setupStreamVolumeAnalyzer(stream, indicatorElement) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const drawVolume = () => {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0 || !audioTracks[0].enabled || audioTracks[0].readyState === 'ended' || !document.body.contains(indicatorElement)) {
          if (indicatorElement) indicatorElement.style.width = '0%';
          try {
            audioCtx.close();
          } catch (e) { }
          return;
        }

        requestAnimationFrame(drawVolume);
        analyser.getByteFrequencyData(dataArray);

        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
          total += dataArray[i];
        }
        const average = total / bufferLength;
        const volPercent = Math.min((average / 80) * 100, 100);
        if (indicatorElement) indicatorElement.style.width = `${volPercent}%`;

        // Proctoring sound energy analysis
        if (this.interviewActive && !this.isListening && !this.isTestingMic) {
          if (volPercent > 15.0) {
            this.continuousLoudSoundTicks = (this.continuousLoudSoundTicks || 0) + 1;
            this.updateProctorMetric('audio', 'yellow', 'NOISY');

            if (this.continuousLoudSoundTicks >= 180) { // ~3 seconds of continuous noise
              this.continuousLoudSoundTicks = 0;
              this.triggerCheatWarning("Continuous loud background noise or secondary speech detected. Please maintain silence.", "audio");
            }
          } else {
            if (this.continuousLoudSoundTicks > 0) {
              this.continuousLoudSoundTicks = Math.max(0, this.continuousLoudSoundTicks - 2);
            }
            if (this.continuousLoudSoundTicks === 0) {
              this.updateProctorMetric('audio', 'green', 'OK');
            }
          }
        } else {
          if (this.interviewActive) {
            if (this.isListening) {
              this.updateProctorMetric('audio', 'green', 'ACTIVE');
            } else {
              this.updateProctorMetric('audio', 'green', 'OK');
            }
          }
        }
      };

      drawVolume();
      return audioCtx;
    } catch (e) {
      console.warn("Failed setting up volume analyzer:", e);
      return null;
    }
  }

  // Microphones audio diagnostics test: record 3 seconds and play back
  async testMicrophone() {
    if (this.isTestingMic) {
      this.stopMicTest();
      return;
    }

    this.isTestingMic = true;
    this.testMicBtn.innerHTML = '<i class="fa-solid fa-square"></i> Recording... Speak now (3s)';
    this.testMicBtn.classList.add('btn-danger');

    try {
      // Fetch stream from selected microphone explicitly
      const constraints = {
        audio: this.selectedMicrophoneId ? { deviceId: { exact: this.selectedMicrophoneId } } : true
      };

      let testStream;
      try {
        testStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("Exact constraints failed for test mic, falling back to ideal:", e);
        testStream = await navigator.mediaDevices.getUserMedia({
          audio: this.selectedMicrophoneId ? { deviceId: { ideal: this.selectedMicrophoneId } } : true
        });
      }

      this.testMicStream = testStream;
      const chunks = [];
      const mediaRecorder = new MediaRecorder(testStream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Release audio track immediately after recording finishes
        testStream.getTracks().forEach(track => track.stop());

        const blob = new Blob(chunks, { type: 'audio/webm' });
        const audioURL = window.URL.createObjectURL(blob);

        this.testMicAudio = new Audio(audioURL);

        // Attempt to output playback on selected speaker
        if (this.selectedSpeakerId && typeof this.testMicAudio.setSinkId === 'function') {
          this.testMicAudio.setSinkId(this.selectedSpeakerId).catch(err => {
            console.warn("Failed to set speaker output sink for test playback:", err);
          });
        }

        this.testMicBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Playing back...';
        this.testMicBtn.classList.remove('btn-danger');
        this.testMicBtn.style.background = 'var(--gradient-success)';
        this.testMicBtn.style.color = '#fff';

        this.testMicAudio.onended = () => {
          this.stopMicTest();
        };

        this.testMicAudio.onerror = () => {
          this.stopMicTest();
        };

        this.testMicAudio.play().catch(playErr => {
          console.error("Audio test playback failed:", playErr);
          this.stopMicTest();
        });
      };

      mediaRecorder.start();

      this.micTestTimeout = setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, 3000);

    } catch (err) {
      console.error("Microphone test error:", err);
      this.showCustomAlert("Diagnostics Failed", "Microphone test failed: " + err.message, true);
      this.stopMicTest();
    }
  }

  stopMicTest() {
    this.isTestingMic = false;
    if (this.micTestTimeout) {
      clearTimeout(this.micTestTimeout);
      this.micTestTimeout = null;
    }
    if (this.testMicStream) {
      this.testMicStream.getTracks().forEach(track => track.stop());
      this.testMicStream = null;
    }
    if (this.testMicAudio) {
      try {
        this.testMicAudio.pause();
      } catch (e) { }
      this.testMicAudio = null;
    }

    if (this.testMicBtn) {
      this.testMicBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Test Microphone (Record & Playback)';
      this.testMicBtn.classList.remove('btn-danger');
      this.testMicBtn.style.background = '';
      this.testMicBtn.style.color = '';
    }
  }

  // Coding workspace phase layout trigger
  startCodingTestPhase() {
    this.codingPhase = true;
    this.isSpeechActive = false;
    this.clearAllSpeechTimers();
    this.safeAbortSpeechRecognition();

    // Toggle workspace panels & layout
    this.interviewScreen.classList.add('coding-active');
    if (this.codingWorkspace) this.codingWorkspace.style.display = 'grid';

    // Update Stepper UI
    const stepVerbal = document.getElementById('step-verbal-indicator');
    const stepCoding = document.getElementById('step-coding-indicator');
    const divider1 = document.getElementById('step-divider-1');

    if (stepVerbal) stepVerbal.className = 'step step-verbal completed';
    if (stepCoding) stepCoding.className = 'step step-coding active';
    if (divider1) divider1.className = 'step-divider active';

    // Set dynamic language badge in editor header
    const langBadge = document.querySelector('.editor-lang-badge');
    const isPython = this.topic.toLowerCase().includes('python');
    if (langBadge) {
      if (isPython) {
        langBadge.innerHTML = `<i class="fa-brands fa-python icon-accent" style="color: #3776ab; margin-right: 4px;"></i> Python`;
      } else {
        langBadge.innerHTML = `<i class="fa-brands fa-js icon-accent" style="color: #f7df1e; margin-right: 4px;"></i> JavaScript`;
      }
    }

    // Trigger window resize so Three.js canvas refits the new viewport space
    if (this.avatarManager) {
      setTimeout(() => {
        this.avatarManager.onWindowResize();
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }

    // Populate problem contents
    if (this.currentCodingQuestion) {
      if (this.codingProblemTitle) this.codingProblemTitle.innerText = this.currentCodingQuestion.title || 'Programming Challenge';
      if (this.codingProblemDesc) this.codingProblemDesc.innerHTML = this.currentCodingQuestion.description || 'Complete the solution in the editor.';
      if (this.codeEditor) this.codeEditor.value = this.currentCodingQuestion.template || '';

      // Update submit button text dynamically
      const submitBtn = this.submitCodeBtn;
      if (submitBtn) {
        const totalChallenges = this.codingQuestionsList.length;
        if (totalChallenges > 1) {
          submitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Submit Challenge (${this.currentCodingQuestionIndex + 1}/${totalChallenges})`;
        } else {
          submitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Submit Coding Test`;
        }
      }

      this.totalCount = this.currentCodingQuestion.testCases ? this.currentCodingQuestion.testCases.length : 0;
      this.passedCount = 0;

      this.renderTestCases();
    } else {
      if (this.codingProblemTitle) this.codingProblemTitle.innerText = 'Coding challenge is ready';
      if (this.codingProblemDesc) this.codingProblemDesc.innerText = 'Click submit below to conclude the session and generate your report card.';
    }
  }

  // Draw list of test cases in left panel
  renderTestCases() {
    if (!this.testCasesList) return;
    this.testCasesList.innerHTML = '';
    if (!this.currentCodingQuestion || !this.currentCodingQuestion.testCases) return;

    this.currentCodingQuestion.testCases.forEach((tc, idx) => {
      const card = document.createElement('div');
      card.className = 'test-case-card';
      card.id = `tc-card-${idx}`;

      card.innerHTML = `
        <div class="test-case-header">
          <span>Test Case ${idx + 1}</span>
          <span id="tc-status-${idx}" style="font-weight: 700; font-size: 12px; color: var(--text-muted);">
            <i class="fa-solid fa-circle-question"></i> Pending
          </span>
        </div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
          <strong>Input:</strong> <span style="font-family: monospace;">${tc.input}</span>
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          <strong>Expected:</strong> <span style="font-family: monospace;">${tc.expectedOutput}</span>
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          <strong>Actual:</strong> <span id="tc-actual-${idx}" style="font-family: monospace; color: var(--text-muted);">-</span>
        </div>
      `;
      this.testCasesList.appendChild(card);
    });
  }

  // Execute candidate's code in browser wrapper and display outputs
  runCodingTests() {
    if (!this.currentCodingQuestion || !this.currentCodingQuestion.testCases) return;

    const isPython = (this.currentCodingQuestion.language || '').toLowerCase() === 'python' ||
      (this.currentCodingQuestion.language || this.topic).toLowerCase().includes('python');
    const code = this.codeEditor ? this.codeEditor.value : '';
    const testCases = this.currentCodingQuestion.testCases;
    const functionName = this.currentCodingQuestion.functionName;

    if (isPython) {
      this.runPythonTests(code, testCases, functionName);
      return;
    }

    let passed = 0;

    testCases.forEach((tc, idx) => {
      const cardEl = document.getElementById(`tc-card-${idx}`);
      const statusEl = document.getElementById(`tc-status-${idx}`);
      const actualEl = document.getElementById(`tc-actual-${idx}`);

      try {
        // Compile a dynamic runner wrapper
        const runner = new Function(`
          ${code}
          return ${functionName}(${tc.input});
        `);

        const actualVal = runner();
        const actualStr = JSON.stringify(actualVal);

        let expectedParsed;
        try {
          expectedParsed = JSON.parse(tc.expectedOutput);
        } catch (e) {
          expectedParsed = tc.expectedOutput;
        }
        const expectedStr = JSON.stringify(expectedParsed);

        if (actualEl) actualEl.innerText = actualStr;

        if (actualStr === expectedStr) {
          if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--color-success);"></i> Passed';
          if (cardEl) cardEl.className = 'test-case-card passed';
          passed++;
        } else {
          if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color: var(--color-danger);"></i> Failed';
          if (cardEl) cardEl.className = 'test-case-card failed';
        }
      } catch (err) {
        console.warn(`Execution failed on test case ${idx + 1}:`, err);
        if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color: var(--color-warning);"></i> Error';
        if (cardEl) cardEl.className = 'test-case-card error';
        if (actualEl) actualEl.innerText = err.message;
      }
    });

    this.passedCount = passed;
    this.showCustomAlert("Test Execution Results", `Completed JavaScript tests! ${passed} / ${this.totalCount} passed.`, passed !== this.totalCount);
  }

  // Lazy load Pyodide WASM runtime
  async getPyodide() {
    if (this.pyodide) return this.pyodide;
    if (typeof loadPyodide === 'undefined') {
      try {
        await this.loadScript("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");
      } catch (err) {
        throw new Error("Pyodide script tag not loaded or browser is offline.");
      }
    }
    this.pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/"
    });
    return this.pyodide;
  }

  // Execute Python tests via Pyodide in browser
  async runPythonTests(code, testCases, functionName) {
    let pyodide;
    try {
      this.showLoader("Loading Python Runner", "Initializing Pyodide WASM runtime in your browser...");
      pyodide = await this.getPyodide();
      this.hideLoader();
    } catch (err) {
      this.hideLoader();
      console.error("Pyodide failed to load:", err);
      this.showCustomAlert("Python Environment Error", "Failed to initialize Python runner: " + err.message, true);
      return;
    }

    let passed = 0;

    for (let idx = 0; idx < testCases.length; idx++) {
      const tc = testCases[idx];
      const cardEl = document.getElementById(`tc-card-${idx}`);
      const statusEl = document.getElementById(`tc-status-${idx}`);
      const actualEl = document.getElementById(`tc-actual-${idx}`);

      try {
        // Run code script in Pyodide
        pyodide.runPython(code);
        const resultObj = pyodide.runPython(`${functionName}(${tc.input})`);

        let jsVal = resultObj;
        if (resultObj && typeof resultObj.toJs === 'function') {
          jsVal = resultObj.toJs();
        }
        if (resultObj && typeof resultObj.destroy === 'function') {
          resultObj.destroy();
        }
        const actualStr = JSON.stringify(jsVal);

        let expectedParsed;
        try {
          // Normalize Python-style True/False to JSON true/false before parsing
          let normalizedExpected = tc.expectedOutput
            .replace(/\bTrue\b/g, 'true')
            .replace(/\bFalse\b/g, 'false')
            .replace(/'/g, '"'); // Replace single quotes with double quotes for valid JSON
          expectedParsed = JSON.parse(normalizedExpected);
        } catch (e) {
          expectedParsed = tc.expectedOutput;
        }
        const expectedStr = JSON.stringify(expectedParsed);

        if (actualEl) actualEl.innerText = actualStr;

        if (actualStr === expectedStr) {
          if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--color-success);"></i> Passed';
          if (cardEl) cardEl.className = 'test-case-card passed';
          passed++;
        } else {
          if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color: var(--color-danger);"></i> Failed';
          if (cardEl) cardEl.className = 'test-case-card failed';
        }
      } catch (err) {
        console.warn(`Execution failed on Python test case ${idx + 1}:`, err);
        if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color: var(--color-warning);"></i> Error';
        if (cardEl) cardEl.className = 'test-case-card error';
        if (actualEl) actualEl.innerText = err.message;
      }
    }

    this.passedCount = passed;
    this.showCustomAlert("Test Execution Results", `Completed Python tests! ${passed} / ${this.totalCount} passed.`, passed !== this.totalCount);
  }

  // Trigger compiler endpoint
  async submitCodingTest() {
    const totalChallenges = this.codingQuestionsList.length;
    const isLast = this.currentCodingQuestionIndex >= totalChallenges - 1;

    const confirmMsg = isLast
      ? "Are you sure you want to submit your final coding solution and finish the interview? This will compile your complete evaluation report card."
      : `Are you sure you want to submit your solution for Challenge ${this.currentCodingQuestionIndex + 1}? This will proceed to the next challenge.`;

    const confirmed = await this.showCustomConfirm("Submit Code", confirmMsg);
    if (confirmed) {
      // Store passed/total count and code for current challenge
      this.codingScoreDetails.push({
        title: this.currentCodingQuestion.title,
        passedCount: this.passedCount,
        totalCount: this.totalCount,
        code: this.codeEditor ? this.codeEditor.value : ''
      });

      if (isLast) {
        this.compileFinalReport();
      } else {
        this.currentCodingQuestionIndex++;
        this.currentCodingQuestion = this.codingQuestionsList[this.currentCodingQuestionIndex];

        // Load next challenge workspace
        this.startCodingTestPhase();
      }
    }
  }
}

// Instantiate when DOM finishes loading
window.addEventListener('DOMContentLoaded', () => {
  // Pre-load voices because window.speechSynthesis.getVoices() loads asynchronously
  window.speechSynthesis.getVoices();

  new AppOrchestrator();
});
