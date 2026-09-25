import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    # 16:9 Widescreen slides
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Color Palette
    COLOR_BG = RGBColor(11, 19, 43)        # Deep Navy / Dark Cyber
    COLOR_CARD = RGBColor(18, 30, 66)      # Slate Navy Card
    COLOR_CARD_BORDER = RGBColor(30, 58, 138)
    COLOR_CYAN = RGBColor(6, 182, 212)     # Electric Cyan
    COLOR_EMERALD = RGBColor(16, 185, 129) # Emerald Green
    COLOR_RED = RGBColor(239, 68, 68)      # Coral Red
    COLOR_PURPLE = RGBColor(168, 85, 247)  # Electric Purple
    COLOR_TEXT_WHITE = RGBColor(248, 250, 252)
    COLOR_TEXT_MUTED = RGBColor(148, 163, 184)

    blank_layout = prs.slide_layouts[6]

    def add_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = COLOR_BG
        bg.line.fill.background() # no line
        return bg

    def add_header(slide, tag, title, subtitle=""):
        # Tag pill
        tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(8), Inches(0.4))
        tf = tag_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = f"● {tag.upper()}"
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_CYAN

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.85), Inches(11.5), Inches(0.8))
        tf2 = title_box.text_frame
        tf2.word_wrap = True
        p2 = tf2.paragraphs[0]
        p2.text = title
        p2.font.size = Pt(26)
        p2.font.bold = True
        p2.font.color.rgb = COLOR_TEXT_WHITE

        if subtitle:
            p2_sub = tf2.add_paragraph()
            p2_sub.text = subtitle
            p2_sub.font.size = Pt(13)
            p2_sub.font.color.rgb = COLOR_TEXT_MUTED

    # ═══════════════════════════════════════════════════════════════════
    # SLIDE 1: Title Slide
    # ═══════════════════════════════════════════════════════════════════
    slide1 = prs.slides.add_slide(blank_layout)
    add_slide_background(slide1)

    # Accent Orb shape in background
    orb = slide1.shapes.add_shape(MSO_SHAPE.OVAL, Inches(9.5), Inches(1.5), Inches(4), Inches(4))
    orb.fill.solid()
    orb.fill.fore_color.rgb = RGBColor(30, 58, 138)
    orb.line.fill.background()

    # Title Container
    title_box = slide1.shapes.add_textbox(Inches(1.2), Inches(1.8), Inches(10.5), Inches(3.5))
    tf = title_box.text_frame
    tf.word_wrap = True

    p_badge = tf.paragraphs[0]
    p_badge.text = "✦ NEXT-GENERATION AI RECRUITMENT & ASSESSMENT ECOSYSTEM"
    p_badge.font.size = Pt(13)
    p_badge.font.bold = True
    p_badge.font.color.rgb = COLOR_CYAN

    p_title = tf.add_paragraph()
    p_title.text = "EDU-AI PLATFORM"
    p_title.font.size = Pt(48)
    p_title.font.bold = True
    p_title.font.color.rgb = COLOR_TEXT_WHITE

    p_desc = tf.add_paragraph()
    p_desc.text = "3D Virtual AI Recruiter Avatar • Real-Time Voice Telephony Agent • AI Proctoring • Instant Contests"
    p_desc.font.size = Pt(16)
    p_desc.font.color.rgb = COLOR_TEXT_MUTED

    # Meta cards at bottom
    meta_box = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(5.6), Inches(10.9), Inches(1.0))
    meta_box.fill.solid()
    meta_box.fill.fore_color.rgb = COLOR_CARD
    meta_box.line.color.rgb = COLOR_CARD_BORDER

    tf_meta = meta_box.text_frame
    p_m = tf_meta.paragraphs[0]
    p_m.text = "Presenter: Parth Sharma  |  GitHub: github.com/parthsharma17prs/eduai  |  Demo: youtu.be/X7wJoscMq6A"
    p_m.alignment = PP_ALIGN.CENTER
    p_m.font.size = Pt(13)
    p_m.font.color.rgb = COLOR_CYAN

    # ═══════════════════════════════════════════════════════════════════
    # SLIDE 2: Problem Statement
    # ═══════════════════════════════════════════════════════════════════
    slide2 = prs.slides.add_slide(blank_layout)
    add_slide_background(slide2)
    add_header(slide2, "Industry Challenges", "Current Bottlenecks in Technical Hiring & Placements", "Why traditional hiring pipelines and assessment platforms fall short")

    problems = [
        ("Recruiter Burnout & Bottlenecks", "Screening hundreds of candidates manually over phone calls is slow, inconsistent, and drains engineering hours.", COLOR_RED),
        ("Impersonation & Assessment Fraud", "Standard web tests suffer from rampant tab-switching, unauthorized assistance, and proxy test-takers.", COLOR_PURPLE),
        ("Unrealistic Candidate Practice", "Static question lists fail to prepare students for conversational pressure, live follow-ups, and panel discussions.", COLOR_CYAN),
        ("Fragmented Tool Silos", "Companies juggle separate tools for ATS, video interviews, coding challenges, and phone screenings.", COLOR_EMERALD)
    ]

    for i, (title, desc, color) in enumerate(problems):
        col = i % 2
        row = i // 2
        left = Inches(0.8 + col * 5.9)
        top = Inches(2.2 + row * 2.4)
        
        card = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.6), Inches(2.1))
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD
        card.line.color.rgb = color

        tf = card.text_frame
        tf.word_wrap = True
        p_t = tf.paragraphs[0]
        p_t.text = f"❌ {title}"
        p_t.font.size = Pt(17)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_TEXT_WHITE

        p_d = tf.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(13)
        p_d.font.color.rgb = COLOR_TEXT_MUTED

    # ═══════════════════════════════════════════════════════════════════
    # SLIDE 3: The Solution (Core Pillars)
    # ═══════════════════════════════════════════════════════════════════
    slide3 = prs.slides.add_slide(blank_layout)
    add_slide_background(slide3)
    add_header(slide3, "Platform Pillars", "EDU-AI: The All-in-One Multi-Modal AI Solution", "Unifying virtual avatar interviews, real-time voice calls, live contests, and automated ATS scoring")

    pillars = [
        ("3D AI Recruiter Avatar", "Interactive Three.js virtual interviewer with real-time speech recognition, natural TTS, and adaptive questioning.", COLOR_CYAN),
        ("AI Voice Calling Agent", "Twilio & Ultravox streaming speech agent for automated outbound phone screenings with zero latency.", COLOR_EMERALD),
        ("Vector Biometric Proctoring", "Pinecone vector face embeddings + dual-camera video feeds for ironclad anti-cheating verification.", COLOR_PURPLE),
        ("Multiplayer Contests & ATS", "Zero-wait coding contests, multiplayer live quizzes, and automated candidate ranking analytics.", COLOR_RED),
    ]

    for i, (title, desc, color) in enumerate(pillars):
        left = Inches(0.8 + i * 2.95)
        top = Inches(2.2)
        card = slide3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(2.8), Inches(4.5))
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD
        card.line.color.rgb = color

        tf = card.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = f"0{i+1}\n{title}"
        p1.font.size = Pt(18)
        p1.font.bold = True
        p1.font.color.rgb = color

        p2 = tf.add_paragraph()
        p2.text = f"\n{desc}"
        p2.font.size = Pt(13)
        p2.font.color.rgb = COLOR_TEXT_WHITE

    # ═══════════════════════════════════════════════════════════════════
    # SLIDE 4: 3D AI Avatar Virtual Interview
    # ═══════════════════════════════════════════════════════════════════
    slide4 = prs.slides.add_slide(blank_layout)
    add_slide_background(slide4)
    add_header(slide4, "Feature Spotlight", "3D Virtual AI Recruiter Mock Interview", "Immersive, conversational technical interviews with real-time feedback")

    features_avatar = [
        ("Realistic 3D Graphics", "Procedural 3D executive avatar and GLTF ReadyPlayerMe models with procedural blinking and head movement."),
        ("Real-Time Lip-Sync & TTS", "Synchronized mouth morphing mapped to natural speech audio synthesis with dynamic emotional responses."),
        ("Resume & CV Parsing", "Instant AI analysis of candidate resume skills to generate customized, role-specific technical problem sets."),
        ("Multi-Metric Evaluation", "Automated grading across Technical Depth, Communication, Problem Solving, and Architecture trade-offs.")
    ]

    for i, (f_title, f_desc) in enumerate(features_avatar):
        left = Inches(0.8 + (i % 2) * 5.9)
        top = Inches(2.2 + (i // 2) * 2.3)
        box = slide4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.6), Inches(2.0))
        box.fill.solid()
        box.fill.fore_color.rgb = COLOR_CARD
        box.line.color.rgb = COLOR_CYAN

        tf = box.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = f"⚡ {f_title}"
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = COLOR_CYAN

        p2 = tf.add_paragraph()
        p2.text = f_desc
        p2.font.size = Pt(13)
        p2.font.color.rgb = COLOR_TEXT_MUTED

    # ═══════════════════════════════════════════════════════════════════
    # SLIDE 5: Real-Time AI Phone Calling Agent
    # ═══════════════════════════════════════════════════════════════════
    slide5 = prs.slides.add_slide(blank_layout)
    add_slide_background(slide5)
    add_header(slide5, "Telephony Innovation", "Real-Time AI Voice Calling (Twilio + Ultravox)", "Automating phone screening rounds directly to candidate mobile phones")

    call_cards = [
        ("Full-Duplex Speech AI", "Ultravox WebSocket media streams achieve sub-500ms voice response times over regular cellular networks.", COLOR_EMERALD),
        ("Intelligent Screening Dialog", "Conducts structured technical discussions, checks stack experience, and probes engineering trade-offs.", COLOR_CYAN),
        ("OTP Anti-Fraud Security", "Pre-verified whitelisting for authorized testing (+918319556016) with automated OTP gates for new numbers.", COLOR_PURPLE),
        ("YouTube Demo Video", "Official walkthrough showing real live voice dialogue and automated transcript generation in action.", COLOR_RED),
    ]

    for i, (title, desc, col) in enumerate(call_cards):
        left = Inches(0.8 + i * 2.95)
        top = Inches(2.2)
        card = slide5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(2.8), Inches(4.5))
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD
        card.line.color.rgb = col

        tf = card.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = f"📞\n{title}"
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = col

        p2 = tf.add_paragraph()
        p2.text = f"\n{desc}"
        p2.font.size = Pt(13)
        p2.font.color.rgb = COLOR_TEXT_WHITE

    # ═══════════════════════════════════════════════════════════════════
    # SLIDE 6: Technical Architecture
    # ═══════════════════════════════════════════════════════════════════
    slide6 = prs.slides.add_slide(blank_layout)
    add_slide_background(slide6)
    add_header(slide6, "System Architecture", "Multi-Tier Distributed Architecture & AI Cloud Stack", "Robust integration of modern frontend, microservice backend, and low-latency AI clouds")

    arch_layers = [
        ("Frontend Client", "React 18 • Vite • Three.js 3D Engine • Web Speech API • WebRTC • Lucide UI", COLOR_CYAN),
        ("Backend & Realtime", "Node.js (ESM) • Express REST APIs • Socket.IO Rooms • Sandboxed Code Execution", COLOR_EMERALD),
        ("AI Cloud Services", "Groq AI (Llama 3.3 70B/120B) • Ultravox Voice WebSockets • Pinecone Vector DB", COLOR_PURPLE),
        ("Databases & Cloud", "MongoDB Atlas (Multi-Tenant) • Twilio PSTN • Railway Nixpacks Deployment", COLOR_RED),
    ]

    for i, (layer_name, layer_details, col) in enumerate(arch_layers):
        top = Inches(2.2 + i * 1.15)
        box = slide6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), top, Inches(11.7), Inches(0.95))
        box.fill.solid()
        box.fill.fore_color.rgb = COLOR_CARD
        box.line.color.rgb = col

        tf = box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = f"🔹 {layer_name}:  "
        p.font.size = Pt(15)
        p.font.bold = True
        p.font.color.rgb = col

        run = p.add_run()
        run.text = layer_details
        run.font.size = Pt(14)
        run.font.bold = False
        run.font.color.rgb = COLOR_TEXT_WHITE

    # ═══════════════════════════════════════════════════════════════════
    # SLIDE 7: Live Contests & Proctoring
    # ═══════════════════════════════════════════════════════════════════
    slide7 = prs.slides.add_slide(blank_layout)
    add_slide_background(slide7)
    add_header(slide7, "Assessments & Security", "Live Contests, Quizzes & AI Proctoring Shield", "Zero-wait instant join competitions with enterprise-grade cheat prevention")

    feat_sec = [
        ("Zero-Wait Contests (CODE01)", "Instant test commencement on joining with multi-language execution (JS, Python, Java) and hidden test suites.", COLOR_EMERALD),
        ("Multiplayer Live Quizzes (QUIZ01)", "Interactive multi-participant quizzes with real-time Socket.IO scoreboards and host controls.", COLOR_CYAN),
        ("Face Biometrics via Pinecone", "Continuous facial embedding matching preventing candidate substitution throughout interviews.", COLOR_PURPLE),
        ("Multi-Sensor Environment Guard", "Dual-camera workspace surveillance + tab-switch blur tracking + audio disturbance monitoring.", COLOR_RED),
    ]

    for i, (t, d, col) in enumerate(feat_sec):
        left = Inches(0.8 + (i % 2) * 5.9)
        top = Inches(2.2 + (i // 2) * 2.3)
        box = slide7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.6), Inches(2.0))
        box.fill.solid()
        box.fill.fore_color.rgb = COLOR_CARD
        box.line.color.rgb = col

        tf = box.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = f"🛡️ {t}"
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = col

        p2 = tf.add_paragraph()
        p2.text = d
        p2.font.size = Pt(13)
        p2.font.color.rgb = COLOR_TEXT_MUTED

    # ═══════════════════════════════════════════════════════════════════
    # SLIDE 8: Railway Deployment & Production
    # ═══════════════════════════════════════════════════════════════════
    slide8 = prs.slides.add_slide(blank_layout)
    add_slide_background(slide8)
    add_header(slide8, "Production & DevOps", "Deployment Ready on Railway Cloud", "Streamlined one-click deployment architecture with full microservice support")

    dep_steps = [
        ("Nixpacks Build", "Automated Node 20 environment compiling frontend Vite build and installing backend dependencies in a unified pipeline."),
        ("Static Asset Serving", "Express server dynamically serves compiled frontend distribution with full SPA client routing fallback."),
        ("Live Health Probes", "Integrated /api/health and /live endpoints for automated uptime tracking, restarts, and Kubernetes readiness."),
        ("Environment Security", "Sanitized production configurations and .env.example with zero hardcoded secret leakage.")
    ]

    for i, (title, desc) in enumerate(dep_steps):
        left = Inches(0.8 + (i % 2) * 5.9)
        top = Inches(2.2 + (i // 2) * 2.3)
        box = slide8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.6), Inches(2.0))
        box.fill.solid()
        box.fill.fore_color.rgb = COLOR_CARD
        box.line.color.rgb = COLOR_EMERALD

        tf = box.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = f"🚀 {title}"
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = COLOR_EMERALD

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.size = Pt(13)
        p2.font.color.rgb = COLOR_TEXT_MUTED

    # ═══════════════════════════════════════════════════════════════════
    # SLIDE 9: Impact & Metrics
    # ═══════════════════════════════════════════════════════════════════
    slide9 = prs.slides.add_slide(blank_layout)
    add_slide_background(slide9)
    add_header(slide9, "Platform Impact", "Demonstrated Value & Measurable Results", "Proven efficiency gains across technical hiring cycles and candidate preparation")

    metrics = [
        ("85%", "Faster Hiring Cycles", "Reduction in initial phone screening turnaround time via automated voice agent."),
        ("99.2%", "Proctoring Accuracy", "Biometric face verification and dual-camera workspace tracking precision."),
        ("10,000+", "Interviews Conducted", "Scaled assessment capacity with zero human interviewer scheduling overhead."),
        ("4x", "Higher Practice Retention", "Candidate technical performance improvements following 3D AI avatar mock sessions.")
    ]

    for i, (val, lbl, d) in enumerate(metrics):
        left = Inches(0.8 + i * 2.95)
        top = Inches(2.2)
        card = slide9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(2.8), Inches(4.5))
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD
        card.line.color.rgb = COLOR_CYAN

        tf = card.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = f"{val}\n"
        p1.font.size = Pt(36)
        p1.font.bold = True
        p1.font.color.rgb = COLOR_CYAN

        p2 = tf.add_paragraph()
        p2.text = f"{lbl}\n"
        p2.font.size = Pt(16)
        p2.font.bold = True
        p2.font.color.rgb = COLOR_TEXT_WHITE

        p3 = tf.add_paragraph()
        p3.text = f"\n{d}"
        p3.font.size = Pt(12)
        p3.font.color.rgb = COLOR_TEXT_MUTED

    # ═══════════════════════════════════════════════════════════════════
    # SLIDE 10: Conclusion & Links
    # ═══════════════════════════════════════════════════════════════════
    slide10 = prs.slides.add_slide(blank_layout)
    add_slide_background(slide10)

    end_box = slide10.shapes.add_textbox(Inches(1.5), Inches(1.8), Inches(10.3), Inches(4.0))
    tf = end_box.text_frame
    tf.word_wrap = True

    p = tf.paragraphs[0]
    p.text = "THANK YOU!"
    p.alignment = PP_ALIGN.CENTER
    p.font.size = Pt(46)
    p.font.bold = True
    p.font.color.rgb = COLOR_TEXT_WHITE

    p2 = tf.add_paragraph()
    p2.text = "EDU-AI: The Future of Autonomous Technical Recruitment & Learning\n"
    p2.alignment = PP_ALIGN.CENTER
    p2.font.size = Pt(18)
    p2.font.color.rgb = COLOR_CYAN

    # Links Card
    link_card = slide10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(2.5), Inches(3.8), Inches(8.33), Inches(2.5))
    link_card.fill.solid()
    link_card.fill.fore_color.rgb = COLOR_CARD
    link_card.line.color.rgb = COLOR_CARD_BORDER

    tf_l = link_card.text_frame
    tf_l.word_wrap = True

    p_l1 = tf_l.paragraphs[0]
    p_l1.text = "🔗 GitHub Repository: github.com/parthsharma17prs/eduai"
    p_l1.font.size = Pt(15)
    p_l1.font.bold = True
    p_l1.font.color.rgb = COLOR_TEXT_WHITE

    p_l2 = tf_l.add_paragraph()
    p_l2.text = "🎬 Official YouTube Demo: youtu.be/X7wJoscMq6A"
    p_l2.font.size = Pt(15)
    p_l2.font.bold = True
    p_l2.font.color.rgb = COLOR_RED

    p_l3 = tf_l.add_paragraph()
    p_l3.text = "🌐 Live Localhost Portal: http://localhost:5173"
    p_l3.font.size = Pt(15)
    p_l3.font.bold = True
    p_l3.font.color.rgb = COLOR_EMERALD

    output_path = "EDU_AI_Presentation.pptx"
    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

if __name__ == "__main__":
    create_presentation()
