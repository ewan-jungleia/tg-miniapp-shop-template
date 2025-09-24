module.exports = async (req, res) => {
  try{
    const out = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'SET' : 'MISSING',
      TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET ? 'SET' : 'MISSING',
      WEBAPP_URL: process.env.WEBAPP_URL || '(missing)',
      APP_VERSION: process.env.APP_VERSION || '(missing)',
      VERCEL_DEPLOY_HOOK_URL: process.env.VERCEL_DEPLOY_HOOK_URL ? 'SET' : 'MISSING'
    };
    res.statusCode = 200;
    res.setHeader('content-type','application/json; charset=utf-8');
    res.end(JSON.stringify(out, null, 2));
  }catch(e){
    res.statusCode = 500;
    res.end(String(e && e.message || e));
  }
};
