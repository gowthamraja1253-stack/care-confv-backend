import { getDbStatus } from '../config/db.js';

export const getHealth = (req, res) => {
  const dbStatus = getDbStatus();
  
  res.status(200).json({
    status: 'ok',
    db: dbStatus,
    timestamp: new Date().toISOString()
  });
};

export default { getHealth };
