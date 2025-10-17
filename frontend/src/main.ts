import './style.css';
import { router } from './shared/router';
import { mountLanding } from './routes/landing';
import { mountExplorer } from './routes/explorer';
import { mountArena } from './routes/arena';

// Register routes
router.register('/', mountLanding);
router.register('/explorer', mountExplorer);
router.register('/arena', mountArena);

// Start routing
router.start();
