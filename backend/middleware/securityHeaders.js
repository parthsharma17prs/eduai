/**
 * Security Headers Middleware
 * Adds essential security headers to all responses
 */

export function securityHeadersMiddleware(req, res, next)
{
    // Prevent clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Enforce HTTPS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Content Security Policy - restrict resource loading while allowing WebSockets & Media
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self' https: http:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https: fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' data: https: fonts.gstatic.com; connect-src 'self' https: http: wss: ws:; media-src 'self' data: https: blob:; frame-ancestors 'none';"
    );

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Feature Policy — allow camera & microphone for interview video/proctoring
    res.setHeader(
        'Permissions-Policy',
        'geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    );

    // CORS - prevent CORS mitigation bypass
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    next();
}
