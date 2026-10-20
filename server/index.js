import express from 'express';
import cors from 'cors';
import { getSaasConfig } from './src/saas/config.js';
import saasRoutes from './src/saas/routes.js';
import authMiddleware from './src/middleware/authMiddleware.js';
import { masterDataAccess, requireModules } from './src/saas/modules.js';
import { rejectTenantInjection } from './src/saas/security.js';
import connectDB from './db.js';
import authRoutes from './src/routes/authRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import masterDataRoutes from './src/routes/masterDataRoutes.js';
import purchaseOrderRoutes from './src/routes/purchaseOrderRoutes.js';
import grnRoutes from './src/routes/grnRoutes.js';
import inventoryRoutes from './src/routes/inventoryRoutes.js';
import salesOrderRoutes from './src/routes/salesOrderRoutes.js';
import salesChallanRoutes from './src/routes/salesChallanRoutes.js';
import companyProfileRoutes from './src/routes/companyProfileRoutes.js';
import warehouseRoutes from './src/routes/warehouseRoutes.js';
import userManagementRoutes from './src/routes/userManagementRoutes.js';
import reportsRoutes from './src/routes/reportsRoutes.js';
import logger from './src/utils/logger.js';

// Load environment variables based on NODE_ENV
// Load environment-specific .env file with fallback
// Default to development
// Fallback to default .env
const config = getSaasConfig();

const app = express();

// CORS Configuration
const corsOptions = {
    origin: config.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cache-Control',
        'Pragma',
        'Accept',
        'Accept-Language',
        'Accept-Encoding',
        'X-Requested-With',
        'Origin'
    ]
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle malformed JSON and oversized payloads — must be error middleware (4 args) right after parsers
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
        return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
    }
    if (err.status === 413 || err.type === 'entity.too.large') {
        return res.status(400).json({ success: false, message: 'Request payload too large' });
    }
    next(err);
});

app.use(rejectTenantInjection);
app.disable('x-powered-by');
app.set('trust proxy', false);

// Connect to database

// Health check route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "YarnFlow Server is running",
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/auth', authRoutes);  // ✅ Fixed: Added /api prefix for consistency
app.use('/api/saas', saasRoutes);
app.use('/api/dashboard', authMiddleware, requireModules('dashboard'), dashboardRoutes);
app.use('/api/master-data', authMiddleware, masterDataAccess, masterDataRoutes);
app.use('/api/purchase-orders', authMiddleware, requireModules('purchase-orders'), purchaseOrderRoutes);
app.use('/api/grn', authMiddleware, requireModules('grn'), grnRoutes);
app.use('/api/inventory', authMiddleware, requireModules('inventory'), inventoryRoutes);
app.use('/api/sales-orders', authMiddleware, requireModules('sales-orders'), salesOrderRoutes);
app.use('/api/sales-challans', authMiddleware, requireModules('sales-challans'), salesChallanRoutes);
app.use('/api/company-profile', authMiddleware, requireModules('company-profile'), companyProfileRoutes);
app.use('/api/warehouses', authMiddleware, requireModules('warehouses'), warehouseRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/reports', authMiddleware, requireModules('reports'), reportsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const safeStatuses = [400, 401, 403, 404, 409, 429];
    let status = safeStatuses.includes(error.status) ? error.status : 500;
    let message = status === 500 ? 'Internal server error' : error.message;
    if (error.code === 11000) { status = 409; message = 'A record with these details already exists'; }
    if (['ValidationError', 'CastError', 'StrictModeError'].includes(error.name)) { status = 400; message = 'Invalid request data'; }
    if (['MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkError'].includes(error.name)) { status = 503; message = 'Service temporarily unavailable'; }
    logger.error('Global error:', { name: error.name, status });
    res.status(status).json({ success: false, message });
});

const PORT = config.port;
// Binding to 127.0.0.1 only accepts connections from this machine, which
// blocks a physical phone/tablet on the same Wi-Fi/hotspot (e.g. the Expo Go
// app hitting the dev server via the laptop's LAN IP) even though the port
// is otherwise reachable. 0.0.0.0 accepts connections on every local
// interface. Fine for local development (getSaasConfig() already refuses to
// run this server outside development/test mode); a real production
// deployment sits behind its own host/process manager, not this file.
const HOST = '0.0.0.0';

// Export app for testing
export { app };
export async function startServer() {
  await connectDB();
  return app.listen(PORT, HOST, () => logger.info(`YarnFlow SaaS development server listening on ${HOST}:${PORT} (reachable at http://<this-machine-LAN-IP>:${PORT} from other devices on the same network)`));
}

// Start server only if not in test mode
if (config.mode !== 'test') {
  startServer().catch(() => {
    logger.error('SaaS startup failed; server was not started');
    process.exitCode = 1;
  });
}


