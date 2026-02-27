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

        //     const result = await db.query(
        //         `SELECT vless_link FROM user_configs 
        //    WHERE sub_id = $1 
        //    AND status IN ('active', 'test')
        //    AND expires_at > NOW()`,
        //         [subId]
        //     );
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
        const configName = result.rows[0].config_name;

        const rawLinks = result.rows[0].vless_link.split(',').join('\n');
        const beautifiedLinks = rawLinks.map((link: string, index: number) => {
            const server = result.rows[index];
            if (!server) return link;

            const baseName = link.split('#')[0];
            return `${baseName}#🇩🇪 V2Chain | ${server.name} | ${configName} | @V2chainbot`;
        });

        const encoded = Buffer.from(beautifiedLinks).toString('base64');  // ← missing this
        res.setHeader('Content-Type', 'text/plain');
        res.send(encoded);

    } catch (error: any) {
        console.error('Error fetching sub links:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
