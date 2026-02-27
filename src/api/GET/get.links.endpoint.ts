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
            `SELECT vless_link FROM user_configs 
       WHERE sub_id = $1 
       AND status IN ('active', 'test')
       AND expires_at > NOW()`,
            [subId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'No active config found for this id' });
        }

        // Return each link on a new line (standard subscription format)
        // const links = result.rows[0].vless_link.split(',').join('\n');
        // res.setHeader('Content-Type', 'text/plain');
        // res.send(links);
        const links = result.rows[0].vless_link.split(',').join('\n');
        const encoded = Buffer.from(links).toString('base64');  // ← missing this
        res.setHeader('Content-Type', 'text/plain');
        res.send(encoded);

    } catch (error: any) {
        console.error('Error fetching sub links:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
