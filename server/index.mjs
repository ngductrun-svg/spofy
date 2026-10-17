import { createApplication } from './app.mjs';
import { configuration } from './config.mjs';

const config = configuration();
const app = createApplication(config);
app.server.on('error', error => { console.error('Không thể khởi động máy chủ:', error.message); process.exitCode = 1; });
app.server.listen(config.port, config.host, () => console.log(`SPOFY API + website: ${config.appOrigin} (lắng nghe ${config.host}:${config.port})`));
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await app.close(); }
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
