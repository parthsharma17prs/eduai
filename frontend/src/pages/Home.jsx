import {useState, useEffect, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {motion, useInView, useScroll, useTransform} from 'framer-motion';
import
    {
        Briefcase as BriefcaseIcon,
        Bot as RobotIcon,
        Check as CheckIcon,
        Video as VideoIcon,
        Shield as ShieldIcon,
        Brain as BrainIcon,
        Zap as ZapIcon,
        Dumbbell as DumbbellIcon,
        Code as CodeIcon,
        Target as TargetIcon,
        ArrowRight as ArrowRightIcon,
        Users as UsersIcon,
        BarChart3 as BarChartIcon,
        Globe as GlobeIcon,
        ChevronDown as ChevronDownIcon,
        Sparkles as SparklesIcon,
        MousePointerClick as MouseIcon,
    } from 'lucide-react';
import './Home.css';

/* ── Animated counter hook ── */
function useCounter(end, duration=2000, startCounting=false)
{
    const [count, setCount]=useState(0);
    useEffect(() =>
    {
        if (!startCounting) return;
        let start=0;
        const inc=end/(duration/16);
        const timer=setInterval(() =>
        {
            start+=inc;
            if (start>=end) {setCount(end); clearInterval(timer);}
            else setCount(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [end, duration, startCounting]);
    return count;
}

/* ── Subtle Grid Background ── */
function GridBackground()
{
    return (
        <div className="grid-bg">
            <div className="grid-lines" />
            <div className="grid-vignette" />
        </div>
    );
}

/* ── Scroll-reveal wrapper ── */
function ScrollReveal({children, className='', delay=0, direction='up'})
{
    const ref=useRef(null);
    const isInView=useInView(ref, {once: true, margin: '-80px'});
    const dirs={up: [40, 0], down: [-40, 0], left: [0, 0], right: [0, 0]};
    const [y]=dirs[direction]||dirs.up;

    return (
        <motion.div
            ref={ref}
            className={className}
            initial={{opacity: 0, y, scale: 0.97}}
            animate={isInView? {opacity: 1, y: 0, scale: 1}:{}}
            transition={{duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94]}}
        >
            {children}
        </motion.div>
    );
}

/* ── Navbar ── */
function Navbar()
{
    const navigate=useNavigate();
    const [scrolled, setScrolled]=useState(false);

    useEffect(() =>
    {
        const onScroll=() => setScrolled(window.scrollY>50);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <motion.nav
            className={`navbar ${scrolled? 'scrolled':''}`}
            initial={{y: -80}}
            animate={{y: 0}}
            transition={{duration: 0.6, ease: 'easeOut'}}
        >
            <div className="container navbar-inner">
                <motion.div className="navbar-brand" whileHover={{scale: 1.05}}>
                    <TargetIcon size={22} />
                    <span>EDU-AI</span>
                </motion.div>
                <div className="navbar-links">
                    <a href="#features">Features</a>
                    <a href="#modes">Solutions</a>
                    <a href="#stats">Impact</a>
                </div>
                <div className="navbar-actions">
                    <button className="btn btn-ghost" onClick={() => navigate('/login')}>Sign In</button>
                    <motion.button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate('/register')}
                        whileHover={{scale: 1.05}}
                        whileTap={{scale: 0.95}}
                    >
                        Get Started
                    </motion.button>
                </div>
            </div>
        </motion.nav>
    );
}

/* ── Stat Card ── */
function StatCard({icon: Icon, value, suffix, label, delay})
{
    const ref=useRef(null);
    const isInView=useInView(ref, {once: true, margin: '-50px'});
    const count=useCounter(value, 2000, isInView);

    return (
        <motion.div
            ref={ref}
            className="stat-card"
            initial={{opacity: 0, y: 30}}
            animate={isInView? {opacity: 1, y: 0}:{}}
            transition={{duration: 0.6, delay}}
            whileHover={{y: -4}}
        >
            <div className="stat-icon"><Icon size={22} /></div>
            <div className="stat-value">{count}{suffix}</div>
            <div className="stat-label">{label}</div>
        </motion.div>
    );
}

/* ── Mode Card ── */
function ModeCard({icon: Icon, badge, badgeAccent, title, description, features, delay})
{
    const ref=useRef(null);
    const isInView=useInView(ref, {once: true, margin: '-60px'});

    return (
        <motion.div
            ref={ref}
            className="mode-card"
            initial={{opacity: 0, y: 50, scale: 0.95}}
            animate={isInView? {opacity: 1, y: 0, scale: 1}:{}}
            transition={{duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94]}}
            whileHover={{y: -4}}
        >
            <div className="mode-card-header">
                <motion.div
                    className="mode-icon"
                    whileHover={{scale: 1.08}}
                    transition={{duration: 0.2}}
                >
                    <Icon size={28} />
                </motion.div>
                <div className={`mode-badge ${badgeAccent? 'accent':''}`}>{badge}</div>
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            <ul className="feature-list">
                {features.map((f, i) => (
                    <motion.li
                        key={i}
                        initial={{opacity: 0, x: -10}}
                        animate={isInView? {opacity: 1, x: 0}:{}}
                        transition={{duration: 0.4, delay: delay+0.1+i*0.07}}
                    >
                        <CheckIcon size={16} /><span>{f}</span>
                    </motion.li>
                ))}
            </ul>
        </motion.div>
    );
}

/* ── Feature Card ── */
function FeatureCard({icon: Icon, title, description, delay})
{
    const ref=useRef(null);
    const isInView=useInView(ref, {once: true, margin: '-60px'});

    return (
        <motion.div
            ref={ref}
            className="feature-card"
            initial={{opacity: 0, y: 40, scale: 0.95}}
            animate={isInView? {opacity: 1, y: 0, scale: 1}:{}}
            transition={{duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94]}}
            whileHover={{y: -4}}
        >
            <motion.div
                className="feature-icon"
                whileHover={{scale: 1.08}}
                transition={{duration: 0.2}}
            >
                <Icon size={32} />
            </motion.div>
            <h3>{title}</h3>
            <p>{description}</p>
        </motion.div>
    );
}

/* ── Typewriter Effect ── */
function Typewriter({text, delay=0, speed=60, onDone})
{
    const [displayed, setDisplayed]=useState('');
    const [started, setStarted]=useState(false);
    const [done, setDone]=useState(false);

    useEffect(() =>
    {
        const t=setTimeout(() => setStarted(true), delay);
        return () => clearTimeout(t);
    }, [delay]);

    useEffect(() =>
    {
        if (!started) return;
        if (displayed.length>=text.length)
        {
            setDone(true);
            onDone?.();
            return;
        }
        const t=setTimeout(() => setDisplayed(text.slice(0, displayed.length+1)), speed);
        return () => clearTimeout(t);
    }, [started, displayed, text, speed, onDone]);

    return (
        <span>
            {displayed}
            {started&&!done&&<span className="typewriter-cursor">|</span>}
        </span>
    );
}

/* ── Scroll-down indicator ── */
function ScrollIndicator()
{
    return (
        <motion.div
            className="scroll-indicator"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            transition={{delay: 2}}
        >
            <span>Scroll to explore</span>
            <motion.div
                animate={{y: [0, 8, 0]}}
                transition={{duration: 1.5, repeat: Infinity}}
            >
                <ChevronDownIcon size={18} />
            </motion.div>
        </motion.div>
    );
}

/* ═══════════ MAIN COMPONENT ═══════════ */
function Home()
{
    const navigate=useNavigate();
    const {scrollYProgress}=useScroll();
    const heroOpacity=useTransform(scrollYProgress, [0, 0.15], [1, 0]);
    const heroScale=useTransform(scrollYProgress, [0, 0.15], [1, 0.96]);
    const [line1Done, setLine1Done]=useState(false);
    const [line2Done, setLine2Done]=useState(false);

    const modeCards=[
        {
            icon: BriefcaseIcon, badge: 'Live', title: 'Recruiter Interview',
            description: 'Live video interview with anti-cheating detection',
            features: ['Real-time video calling', 'Collaborative code editor', 'AI-powered proctoring', 'Automated reports'],
        },
        {
            icon: DumbbellIcon, badge: 'Practice', title: 'Practice Interview',
            description: 'Practice with AI interviewer and instant feedback',
            features: ['AI interviewer', 'Instant feedback', 'Progress tracking', 'Unlimited attempts'],
        },
        {
            icon: CodeIcon, badge: 'DSA', badgeAccent: true, title: 'Coding Practice',
            description: 'LeetCode-style problems with AI-powered hints',
            features: ['11+ curated problems', 'Multiple languages', 'AI-generated problems', 'Smart hints'],
        },
        {
            icon: RobotIcon, badge: 'AI Avatar', badgeAccent: true, title: '3D AI Avatar Interview',
            description: 'Next-gen 3D virtual interviewer call with real-time lip-sync',
            features: ['3D animated avatar', 'Speech-to-text & TTS', 'Resume CV skills parsing', 'Comprehensive evaluation'],
        },
        {
            icon: ZapIcon, badge: 'Voice AI', badgeAccent: true, title: 'AI Phone Calling (Twilio + Ultravox)',
            description: 'Automated live telephone phone screen interviews',
            features: ['Direct phone outbound calls', 'Ultravox real-time voice streaming', 'Automated transcript generation', 'OTP verification support'],
        },
    ];

    const featureCards=[
        {icon: VideoIcon, title: 'Video Conferencing', description: 'HD video and audio with WebRTC technology for seamless communication'},
        {icon: CodeIcon, title: 'Live Code Editor', description: 'Collaborative coding with syntax highlighting and real-time sync'},
        {icon: ShieldIcon, title: 'AI Proctoring', description: 'Advanced cheating detection with face tracking and tab monitoring'},
        {icon: BrainIcon, title: 'AI Assistant', description: 'Automated feedback, code evaluation, and performance insights'},
    ];

    return (
        <div className="home">
            <Navbar />
            <GridBackground />

            {/* ─── Hero Section ─── */}
            <motion.section className="hero" style={{opacity: heroOpacity, scale: heroScale}}>
                <div className="hero-glow" />
                <div className="container hero-container">

                    {/* Badge */}
                    <motion.div
                        className="hero-badge"
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.6, delay: 0.3}}
                    >
                        <SparklesIcon size={14} />
                        <span>AI-Powered Platform</span>
                    </motion.div>

                    {/* Title */}
                    <motion.h1
                        className="hero-title"
                        initial={{opacity: 0, y: 30}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.8, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94]}}
                    >
                        <Typewriter text="AI Powered Learning & Placement" delay={800} speed={55} onDone={() => setLine1Done(true)} />
                        <br />
                        <span className="hero-title-accent">
                            {line1Done&&<Typewriter text="Platform" delay={200} speed={70} onDone={() => setLine2Done(true)} />}
                        </span>
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        className="hero-subtitle"
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.7, delay: 0.9}}
                    >
                        Conduct professional interviews with advanced AI proctoring,
                        real-time code collaboration, and comprehensive analytics.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        className="hero-cta"
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.7, delay: 1.1}}
                    >
                        <motion.button
                            className="btn btn-primary btn-large"
                            onClick={() => navigate('/register')}
                            whileHover={{scale: 1.02, y: -1}}
                            whileTap={{scale: 0.95}}
                        >
                            Get Started <ArrowRightIcon size={18} />
                        </motion.button>
                        <motion.button
                            className="btn btn-secondary btn-large"
                            onClick={() => navigate('/login')}
                            whileHover={{scale: 1.05}}
                            whileTap={{scale: 0.95}}
                        >
                            Sign In
                        </motion.button>
                        <motion.a
                            href="https://youtu.be/X7wJoscMq6A?si=-YaKwzva1m2CD9Fi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-large"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                            }}
                            whileHover={{scale: 1.05, background: 'rgba(239, 68, 68, 0.25)'}}
                            whileTap={{scale: 0.95}}
                        >
                            ▶ Watch AI Calling Demo
                        </motion.a>
                    </motion.div>

                    <ScrollIndicator />
                </div>
            </motion.section>

            {/* ─── Stats Section ─── */}
            <section className="stats-section" id="stats">
                <div className="container">
                    <ScrollReveal>
                        <div className="section-header">
                            <div className="section-badge"><BarChartIcon size={14} /> Platform Impact</div>
                            <h2>Trusted by Hiring Teams Everywhere</h2>
                            <p>Delivering measurable results in the hiring process</p>
                        </div>
                    </ScrollReveal>
                    <div className="stats-grid">
                        <StatCard icon={UsersIcon} value={10000} suffix="+" label="Interviews Conducted" delay={0.1} />
                        <StatCard icon={GlobeIcon} value={50} suffix="+" label="Companies Onboarded" delay={0.2} />
                        <StatCard icon={ShieldIcon} value={99} suffix="%" label="Proctoring Accuracy" delay={0.3} />
                        <StatCard icon={ZapIcon} value={85} suffix="%" label="Faster Hiring Cycles" delay={0.4} />
                    </div>
                </div>
            </section>

            {/* ─── Mode Cards Section ─── */}
            <section className="modes-section" id="modes">
                <div className="container">
                    <ScrollReveal>
                        <div className="section-header">
                            <div className="section-badge"><MouseIcon size={14} /> Solutions</div>
                            <h2>Choose Your Interview Mode</h2>
                            <p>Flexible solutions tailored for every stage of the hiring pipeline</p>
                        </div>
                    </ScrollReveal>
                    <div className="mode-cards">
                        {modeCards.map((card, i) => (
                            <ModeCard key={i} {...card} delay={i*0.12} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Features Section ─── */}
            <section className="features-section" id="features">
                <div className="container">
                    <ScrollReveal>
                        <div className="section-header">
                            <div className="section-badge"><SparklesIcon size={14} /> Features</div>
                            <h2>Platform Features</h2>
                            <p>Everything you need for successful interviews</p>
                        </div>
                    </ScrollReveal>
                    <div className="features-grid">
                        {featureCards.map((card, i) => (
                            <FeatureCard key={i} {...card} delay={i*0.12} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA Banner ─── */}
            <section className="cta-banner-section">
                <div className="container">
                    <ScrollReveal>
                        <div className="cta-banner">
                            <div className="cta-banner-glow" />
                            <h2>Ready to Transform Your Hiring?</h2>
                            <p>Join thousands of teams already using EDU-AI to find the best talent.</p>
                            <motion.button
                                className="btn btn-primary btn-large"
                                onClick={() => navigate('/register')}
                                whileHover={{scale: 1.02, y: -1}}
                                whileTap={{scale: 0.95}}
                            >
                                Start for Free <ArrowRightIcon size={18} />
                            </motion.button>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="footer">
                <div className="container">
                    <ScrollReveal>
                        <div className="footer-content">
                            <div className="footer-brand">
                                <TargetIcon size={24} />
                                <span>EDU-AI</span>
                            </div>
                            <p className="footer-text">AI-powered interview platform for modern hiring</p>
                            <div className="footer-links">
                                <a href="#features">Features</a>
                                <a href="#modes">Solutions</a>
                                <a href="#stats">Impact</a>
                            </div>
                        </div>
                    </ScrollReveal>
                </div>
            </footer>
        </div>
    );
}

export default Home;
