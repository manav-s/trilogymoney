import { handleLLMConversation } from '../lib/conversation';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const [,, phone, ...rest] = process.argv;
if (!phone || rest.length === 0) {
  console.error('Usage: tsx scripts/spoof-convo.ts <phone> <message>');
  process.exit(1);
}

const message = rest.join(' ');
handleLLMConversation(phone, message)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
