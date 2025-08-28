import { Request, Response, Router } from "express";
import { requireAuth, requireGuildAccess } from "../middleware/auth";
import { DiscordService } from "../services/discord";
import { AuthenticatedRequest } from "../types";
import logger from "../utils/logger";

const router = Router();

// Send message to Discord channel
// router.post('/:guildId/send', requireAuth, requireGuildAccess, async (req: Request, res: Response) => {
//   try {
//     const authReq = req as AuthenticatedRequest;
//     const { channelId, content } = req.body;

//     if (!channelId || !content) {
//       return res.status(400).json({
//         success: false,
//         error: 'Channel ID and content are required'
//       });
//     }

//     // TODO: Validate user has permission to send messages to this channel

//     const response = await DiscordService.sendMessage(channelId, content);

//     // Forward Discord API response
//     res.status(response.status);

//     // Copy headers from Discord response
//     for (const [key, value] of response.headers) {
//       res.setHeader(key, value);
//     }

//     const responseBody = await response.text();

//     if (response.ok) {
//       res.json({
//         success: true,
//         message: 'Message sent successfully',
//         data: JSON.parse(responseBody)
//       });
//     } else {
//       res.json({
//         success: false,
//         error: 'Failed to send message',
//         details: responseBody
//       });
//     }
//   } catch (error) {
//     logger.error('Error sending message:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Internal server error'
//     });
//   }
// });

export default router;
