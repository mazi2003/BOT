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

async def main():
    """Main entry point"""
    logger.info("🚀 Starting bot...")
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())
