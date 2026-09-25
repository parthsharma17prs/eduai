import express from 'express';
import {logger} from '../services/logging.js';

/**
 * API Versioning Middleware & Router
 * Supports multiple API versions with automatic routing
 */

/**
 * API Version manager
 */
export class APIVersionManager
{
    constructor()
    {
        this.versions=new Map();
        this.currentVersion='1.0.0';
        this.deprecatedVersions=new Set();
    }

    /**
     * Register a new API version
     */
    registerVersion(version, router, options={})
    {
        this.versions.set(version, {
            router,
            deprecatedAt: options.deprecatedAt||null,
            sunsetAt: options.sunsetAt||null,
            description: options.description||'',
            breaking: options.breaking||false,
            notes: options.notes||'',
        });

        logger.info('[API-VERSION] Registered', {
            version,
            deprecated: options.deprecatedAt? true:false,
            sunset: options.sunsetAt? true:false,
        });
    }

    /**
     * Deprecate a version
     */
    deprecateVersion(version, sunsetDate)
    {
        if (this.versions.has(version))
        {
            const versionData=this.versions.get(version);
            versionData.deprecatedAt=new Date();
            versionData.sunsetAt=sunsetDate;
            this.deprecatedVersions.add(version);

            logger.warn('[API-VERSION] Deprecated', {
                version,
                sunsetDate,
            });
        }
    }

    /**
     * Get version info
     */
    getVersionInfo(version)
    {
        return this.versions.get(version);
    }

    /**
     * Get all versions
     */
    getAllVersions()
    {
        const versions=[];
        this.versions.forEach((data, version) =>
        {
            versions.push({
                version,
                deprecated: this.deprecatedVersions.has(version),
                ...data,
            });
        });
        return versions;
    }

    /**
     * Check if version is deprecated
     */
    isDeprecated(version)
    {
        return this.deprecatedVersions.has(version);
    }

    /**
     * Check if version is sunset (no longer supported)
     */
    isSunset(version)
    {
        const versionData=this.versions.get(version);
        if (!versionData||!versionData.sunsetAt) return false;
        return new Date()>new Date(versionData.sunsetAt);
    }

    /**
     * Get current version
     */
    getCurrentVersion()
    {
        return this.currentVersion;
    }

    /**
     * Set current version
     */
    setCurrentVersion(version)
    {
        if (this.versions.has(version))
        {
            this.currentVersion=version;
            logger.info('[API-VERSION] Current version set', {version});
        } else
        {
            throw new Error(`Version ${version} not registered`);
        }
    }
}

// Global version manager instance
export const versionManager=new APIVersionManager();

/**
 * Version detection middleware
 * Determines API version from URL, header, or query parameter
 */
export function versionDetectionMiddleware(req, res, next)
{
    let version=null;

    // Priority 1: URL path (e.g., /api/v1/users)
    const urlMatch=req.path.match(/^\/api\/v(\d+(?:\.\d+)?)/);
    if (urlMatch)
    {
        version=urlMatch[1];
    }

    // Priority 2: Custom header (e.g., X-API-Version: 1.0.0)
    if (!version)
    {
        version=req.headers['x-api-version'];
    }

    // Priority 3: Query parameter (e.g., ?apiVersion=1.0.0)
    if (!version)
    {
        version=req.query.apiVersion;
    }

    // Default to current version
    if (!version)
    {
        version=versionManager.getCurrentVersion();
    }

    // Normalize version
    if (!version.includes('.'))
    {
        version=`${version}.0.0`;
    }

    req.apiVersion=version;
    req.versionInfo=versionManager.getVersionInfo(version)||{};

    // Check if version is sunset
    if (versionManager.isSunset(version))
    {
        return res.status(410).json({
            success: false,
            error: 'API version is no longer supported',
            version,
            sunsetAt: req.versionInfo.sunsetAt,
        });
    }

    // Add deprecation warning to response headers
    if (versionManager.isDeprecated(version))
    {
        const deprecatedAt=req.versionInfo.deprecatedAt;
        const sunsetAt=req.versionInfo.sunsetAt;
        res.setHeader('Deprecation', 'true');
        res.setHeader('X-Deprecated-At', deprecatedAt);
        res.setHeader('Sunset', new Date(sunsetAt).toUTCString());
        res.setHeader('X-API-Warn', `This API version is deprecated and will be removed on ${sunsetAt}`);

        logger.warn('[API-VERSION] Deprecated version used', {
            version,
            deprecatedAt,
            sunsetAt,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
        });
    }

    next();
}

/**
 * Version router factory
 * Routes requests to appropriate version handler
 */
export function createVersionedRouter()
{
    const router=express.Router();

    router.use(versionDetectionMiddleware);

    // Route to version-specific handler
    router.use((req, res, next) =>
    {
        const version=req.apiVersion;
        const versionData=versionManager.getVersionInfo(version);

        if (!versionData || !versionData.router)
        {
            return next();
        }

        versionData.router(req, res, next);
    });

    return router;
}

/**
 * Version compatibility helper
 * Ensures data is compatible with requested API version
 */
export class VersionCompatibility
{
    constructor()
    {
        this.transformations=new Map();
    }

    /**
     * Register a field transformation for a version
     */
    registerTransformation(version, transformer)
    {
        this.transformations.set(version, transformer);
    }

    /**
     * Transform response data for version compatibility
     */
    transformResponse(version, data)
    {
        const transformer=this.transformations.get(version);
        if (transformer)
        {
            return transformer(data);
        }
        return data;
    }

    /**
     * Transform request data from client version
     */
    transformRequest(version, data)
    {
        // Implement version-specific request transformations
        // e.g., rename deprecated fields, convert formats
        return data;
    }
}

export const versionCompatibility=new VersionCompatibility();

/**
 * Create version-specific route handler
 */
export function createVersionHandler(version, handler)
{
    return async (req, res, next) =>
    {
        try
        {
            // Transform request if needed
            const transformedReq=versionCompatibility.transformRequest(version, req.body);

            // Call handler
            const result=await handler(transformedReq, req, res);

            // Transform response for version compatibility
            const compatibleResponse=versionCompatibility.transformResponse(version, result);

            res.json({
                success: true,
                data: compatibleResponse,
                version,
            });
        } catch (error)
        {
            next(error);
        }
    };
}

/**
 * Get API documentation for all versions
 */
export function getAPIDocs()
{
    const docs={
        current: versionManager.getCurrentVersion(),
        versions: [],
    };

    versionManager.getAllVersions().forEach(versionData =>
    {
        docs.versions.push({
            version: versionData.version,
            deprecated: versionData.deprecated,
            deprecatedAt: versionData.deprecatedAt,
            sunsetAt: versionData.sunsetAt,
            description: versionData.description,
            breaking: versionData.breaking,
            notes: versionData.notes,
        });
    });

    return docs;
}

/**
 * Express middleware for API documentation endpoint
 */
export function apiDocsMiddleware(req, res)
{
    res.json(getAPIDocs());
}

/**
 * Setup versioning for Express app
 */
export function setupAPIVersioning(app)
{
    // Mount versioned router
    app.use('/api', createVersionedRouter());

    // API documentation endpoint
    app.get('/api/docs/versions', apiDocsMiddleware);

    // Version info endpoint
    app.get('/api/version', (req, res) =>
    {
        res.json({
            current: versionManager.getCurrentVersion(),
            requested: req.apiVersion,
            available: versionManager.getAllVersions().map(v => v.version),
        });
    });

    logger.info('[API-VERSION] Setup completed');
}

export default {
    APIVersionManager,
    versionManager,
    versionDetectionMiddleware,
    createVersionedRouter,
    VersionCompatibility,
    versionCompatibility,
    createVersionHandler,
    getAPIDocs,
    apiDocsMiddleware,
    setupAPIVersioning,
};
