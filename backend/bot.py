import asyncio
import logging
import os
from pathlib import Path
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.enums import ParseMode
from downloader import Downloader
from database import Database

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize bot and dispatcher
BOT_TOKEN = os.getenv('BOT_TOKEN')
API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
WEBAPP_URL = os.getenv('WEBAPP_URL', 'https://your-username.github.io/your-repo')

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Initialize downloader and database
downloader = Downloader()
db = Database()

@dp.message(Command("start"))
async def start_command(message: types.Message):
    """Send welcome message with Mini App button"""
    user_name = message.from_user.first_name or "صديقي"
    
    # Keyboard with Mini App button
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🎵 فتح المشغل", 
            web_app=WebAppInfo(url=WEBAPP_URL)
        )],
        [InlineKeyboardButton(
            text="📥 تحميل مباشر", 
            callback_data="download_direct"
        )],
        [InlineKeyboardButton(
            text="❓ مساعدة", 
            callback_data="help"
        )]
    ])
    
    welcome_text = f"""
🎵 **مرحباً {user_name}!**

أنا بوت الموسيقى الذكي. يمكنك:
• 🎧 تشغيل الموسيقى من يوتيوب في الخلفية
• 📥 تحميل الأغاني كـ MP3
• 🔒 إغلاق الشاشة والاستمرار في الاستماع

**ابدأ الآن:** اضغط على زر "فتح المشغل" أدناه!
    """
    
    await message.answer(welcome_text, reply_markup=keyboard, parse_mode=ParseMode.MARKDOWN)

@dp.message(Command("help"))
async def help_command(message: types.Message):
    """Show help message"""
    help_text = """
🎵 **دليل استخدام بوت الموسيقى**

**🎧 تشغيل في الخلفية:**
• افتح المشغل من زر "فتح المشغل"
• أضف روابط يوتيوب
• استمتع بالموسيقى حتى مع إغلاق الشاشة

**📥 تحميل الأغاني:**
• استخدم الأمر: `/download <رابط يوتيوب>`
• أو من داخل المشغل اضغط على زر التحميل

**🔧 الأوامر المتاحة:**
• `/start` - فتح المشغل
• `/help` - عرض هذه المساعدة
• `/download <رابط>` - تحميل أغنية MP3
• `/play <رابط>` - تشغيل في الخلفية

**⚠️ ملاحظات:**
• الحد الأقصى للتحميل: 50 ميجابايت
• يدعم روابط يوتيوب القصيرة والطويلة
• جودة الصوت: 128 كيلوبت/ثانية MP3
    """
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🎵 فتح المشغل", 
            web_app=WebAppInfo(url=WEBAPP_URL)
        )]
    ])
    
    await message.answer(help_text, reply_markup=keyboard, parse_mode=ParseMode.MARKDOWN)

@dp.message(Command("download"))
async def download_command(message: types.Message):
    """Download audio from YouTube directly"""
    args = message.text.split(maxsplit=1)
    
    if len(args) < 2:
        await message.answer("⚠️ الرجاء إرسال رابط يوتيوب مع الأمر.\nمثال: `/download https://youtu.be/XXXXX`")
        return
    
    url = args[1].strip()
    
    # Validate URL
    if not any(domain in url for domain in ['youtube.com', 'youtu.be']):
        await message.answer("⚠️ الرجاء إرسال رابط يوتيوب صحيح")
        return
    
    # Send processing message
    processing_msg = await message.answer("⏳ جاري تحميل الأغنية... قد يستغرق هذا بضع ثوانٍ")
    
    try:
        # Check cache first
        video_id = downloader.extract_video_id(url)
        cached_file_id = db.get_file_id(video_id)
        
        if cached_file_id:
            await processing_msg.delete()
            await message.answer_audio(
                cached_file_id,
                caption=f"✅ موجود مسبقاً! 🎵\n`{url}`",
                parse_mode=ParseMode.MARKDOWN
            )
            return
        
        # Download the audio
        audio_path, metadata = await downloader.download_audio(url)
        
        if not audio_path:
            await processing_msg.edit_text("❌ فشل التحميل. تأكد من الرابط وحاول مرة أخرى")
            return
        
        # Send audio file
        with open(audio_path, 'rb') as audio_file:
            sent_message = await message.answer_audio(
                audio_file,
                title=metadata.get('title', 'أغنية بدون عنوان'),
                performer=metadata.get('artist', 'فنان غير معروف'),
                duration=metadata.get('duration', 0),
                caption=f"✅ تم التحميل بنجاح! 🎵\n{metadata.get('title', '')}"
            )
        
        # Cache the file_id
        if sent_message.audio:
            db.save_file_id(video_id, sent_message.audio.file_id)
        
        # Clean up
        if os.path.exists(audio_path):
            os.remove(audio_path)
        
        await processing_msg.delete()
        
    except Exception as e:
        logger.error(f"Download error: {e}")
        await processing_msg.edit_text(f"❌ حدث خطأ: {str(e)[:100]}")

@dp.message(Command("play"))
async def play_command(message: types.Message):
    """Open Mini App with the URL"""
    args = message.text.split(maxsplit=1)
    url = args[1].strip() if len(args) > 1 else ""
    
    # Open Mini App with URL parameter
    webapp_url = f"{WEBAPP_URL}?url={url}" if url else WEBAPP_URL
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🎵 فتح المشغل", 
            web_app=WebAppInfo(url=webapp_url)
        )]
    ])
    
    if url:
        await message.answer(
            f"🎶 جاري تجهيز الأغنية...\nاضغط على الزر لفتح المشغل والاستماع في الخلفية.",
            reply_markup=keyboard
        )
    else:
        await message.answer(
            "🎵 اضغط على الزر لفتح مشغل الموسيقى",
            reply_markup=keyboard
        )

@dp.callback_query()
async def handle_callback(callback: types.CallbackQuery):
    """Handle callback queries"""
    if callback.data == "download_direct":
        await callback.message.answer(
            "📥 أرسل رابط يوتيوب مع الأمر:\n`/download <رابط>`",
            parse_mode=ParseMode.MARKDOWN
        )
    
    elif callback.data == "help":
        await help_command(callback.message)
    
    await callback.answer()

@dp.message()
async def handle_any_message(message: types.Message):
    """Handle any message - check for YouTube URLs"""
    text = message.text or ""
    
    # Check if message contains a YouTube URL
    if 'youtube.com' in text or 'youtu.be' in text:
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                text="🎵 فتح المشغل", 
                web_app=WebAppInfo(url=f"{WEBAPP_URL}?url={text}")
            )],
            [InlineKeyboardButton(
                text="📥 تحميل مباشر", 
                callback_data=f"download_url"
            )]
        ])
        
        await message.answer(
            "🎵 تم اكتشاف رابط يوتيوب!\nاختر الإجراء المناسب:",
            reply_markup=keyboard
        )

from aiohttp import web
import json

routes = web.RouteTableDef()

@routes.get('/')
async def api_health(request):
    """Health check for UptimeRobot and Render"""
    return web.Response(text="Bot is running! 🚀", status=200)

@routes.get('/track_info')
async def api_track_info(request):
    url = request.query.get('url')
    if not url:
        return web.json_response({'error': 'No URL provided'}, status=400, headers={'Access-Control-Allow-Origin': '*'})
    
    info = downloader.get_track_info(url)
    if info:
        return web.json_response(info, headers={'Access-Control-Allow-Origin': '*'})
    return web.json_response({'error': 'Not found'}, status=404, headers={'Access-Control-Allow-Origin': '*'})

@routes.get('/stream')
async def api_stream(request):
    url = request.query.get('url')
    if not url:
        return web.json_response({'error': 'No URL provided'}, status=400, headers={'Access-Control-Allow-Origin': '*'})
    
    # In a real scenario, this should fetch the direct audio URL.
    # For now, we'll try to get it from track info
    opts = downloader.ydl_opts.copy()
    opts['extract_flat'] = False
    
    search_query = url
    if not (url.startswith('http://') or url.startswith('https://')):
        search_query = f"ytsearch1:{url}"
        
    try:
        import yt_dlp
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(search_query, download=False)
            if 'entries' in info:
                info = info['entries'][0]
            
            # Find the best audio url
            audio_url = info.get('url')
            if not audio_url:
                for format in info.get('formats', []):
                    if format.get('acodec') != 'none' and format.get('vcodec') == 'none':
                        audio_url = format.get('url')
                        break
            
            if audio_url:
                import urllib.parse
                # We must proxy the audio to avoid YouTube IP binding blocks (403 Forbidden)
                proxy_url = f"{request.scheme}://{request.host}/proxy?target_url={urllib.parse.quote(audio_url)}"
                return web.json_response({'audio_url': proxy_url}, headers={'Access-Control-Allow-Origin': '*'})
    except Exception as e:
        logger.error(f"Stream error: {e}")
        
    return web.json_response({'error': 'Stream not found'}, status=404, headers={'Access-Control-Allow-Origin': '*'})

@routes.get('/proxy')
async def api_proxy(request):
    import aiohttp
    target_url = request.query.get('target_url')
    if not target_url:
        return web.Response(status=400, text="Missing target_url")
        
    async with aiohttp.ClientSession() as session:
        async with session.get(target_url) as resp:
            response = web.StreamResponse(
                status=resp.status,
                headers={
                    'Content-Type': resp.headers.get('Content-Type', 'audio/webm'),
                    'Access-Control-Allow-Origin': '*',
                    'Accept-Ranges': 'bytes'
                }
            )
            await response.prepare(request)
            async for chunk in resp.content.iter_chunked(65536):
                try:
                    await response.write(chunk)
                except ConnectionResetError:
                    break
            return response

@routes.post('/download')
async def api_download(request):
    try:
        data = await request.json()
        url = data.get('url')
        if not url:
            return web.json_response({'error': 'No URL'}, status=400, headers={'Access-Control-Allow-Origin': '*'})
            
        # We trigger the download in the background so we don't block the API
        # We would need the user's chat_id to send it back, but the Mini App 
        # doesn't send the initData yet. For now, the user uses sendData back to the bot
        # and the bot handles it.
        return web.json_response({'status': 'ok'}, headers={'Access-Control-Allow-Origin': '*'})
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500, headers={'Access-Control-Allow-Origin': '*'})

@routes.options('/{tail:.*}')
async def cors_handler(request):
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    return web.Response(headers=headers)

async def start_bot():
    """Background task to run the bot"""
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

async def main():
    """Main entry point"""
    logger.info("🚀 Starting bot and web server...")
    
    # Start bot polling in the background
    asyncio.create_task(start_bot())
    
    # Start aiohttp web server
    app = web.Application()
    app.add_routes(routes)
    
    runner = web.AppRunner(app)
    await runner.setup()
    
    port = int(os.getenv("PORT", 8080))
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    
    logger.info(f"🌐 Web server running on port {port}")
    
    # Keep the main task running indefinitely
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    asyncio.run(main())
