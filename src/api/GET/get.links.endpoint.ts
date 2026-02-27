import rateLimit from 'express-rate-limit';
import express from 'express';
import db from '../../database/database.service'
const subLinksLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    keyGenerator: (req) => String(req.params.subId),
    handler: (req, res) => {
        res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
});

export const router = express.Router();

router.get('/links/:subId', subLinksLimiter, async (req, res) => {
  try {
    const { subId } = req.params;

    const result = await db.query(
      `SELECT uc.vless_link, uc.config_name
       FROM user_configs uc
       WHERE uc.sub_id = $1
       AND uc.status IN ('active', 'test')
       AND uc.expires_at > NOW()`,
      [subId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No active config found for this id' });
    }

    const servers = await db.query(
      `SELECT name FROM servers WHERE is_active = true ORDER BY id`
    );

    const configName = result.rows[0].config_name;
    const rawLinks = result.rows[0].vless_link.split(',');

    // const beautifiedLinks = rawLinks.map((link: string, index: number) => {
    //   const serverName = servers.rows[index]?.name || 'Server';
    //   const baseName = link.split('#')[0];
    //   return `${baseName}#🇩🇪 V2Chain | ${serverName} | ${configName} | @V2chainbot`;
    // });
    const beautifiedLinks = rawLinks.map((link: string) => {
  const baseName = link.split('#')[0];
  return `${baseName}#🇩🇪 V2Chain | Frankfurt |${configName} | @V2chainbot`;
});

    const encoded = Buffer.from(beautifiedLinks.join('\n')).toString('base64');
    res.setHeader('Content-Type', 'text/plain');
    res.send(encoded);

  } catch (error: any) {
    console.error('Error fetching sub links:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
