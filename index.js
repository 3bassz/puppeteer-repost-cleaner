const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

// 🧠 تشغيل المتصفح
const launchBrowser = async () => {
  console.log("🔁 جاري تشغيل المتصفح...");
  return await puppeteer.launch({
    headless: true,
    executablePath: '/opt/render/.cache/puppeteer/chrome/linux-137.0.7151.119/chrome-linux64/chrome',
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
};

// 🔐 تسجيل الدخول بالـ sessionid
const loginWithSession = async (page, sessionid) => {
  console.log("🔐 تسجيل الدخول بـ sessionid...");
  await page.setCookie({
    name: "sessionid",
    value: sessionid,
    domain: ".tiktok.com",
    path: "/",
    httpOnly: true,
    secure: true,
  });
  await page.goto("https://www.tiktok.com/foryou", { waitUntil: "networkidle2" });
};

// 🔢 حساب عدد الريبوستات
const getRepostsCount = async (page) => {
  console.log("📥 فتح صفحة الريبوستات لحساب العدد...");
  await page.goto("https://www.tiktok.com/favorites/reposts", { waitUntil: "networkidle2" });
  await page.waitForSelector("div[data-e2e='user-post-item-list']", { timeout: 10000 });
  const count = await page.$$eval("div[data-e2e='user-post-item-list'] > div", divs => divs.length);
  console.log("✅ عدد الريبوستات:", count);
  return count;
};

// 🗑️ حذف الريبوستات
const deleteReposts = async (page) => {
  console.log("🗑️ جاري حذف الريبوستات...");
  await page.goto("https://www.tiktok.com/favorites/reposts", { waitUntil: "networkidle2" });
  await page.waitForSelector("div[data-e2e='user-post-item-list']", { timeout: 10000 });

  const videos = await page.$$("div[data-e2e='user-post-item-list'] > div");
  let deleted = 0;

  for (const video of videos) {
    try {
      const menuButton = await video.$("button[aria-label='More']");
      if (menuButton) {
        await menuButton.click();
        await page.waitForTimeout(500);

        const [unfavBtn] = await page.$x("//div[contains(text(), 'Remove from reposts') or contains(text(), 'إزالة من المشاركات')]");
        if (unfavBtn) {
          await unfavBtn.click();
          await page.waitForTimeout(1000);
          deleted++;
        }
      }
    } catch (err) {
      console.warn("⚠️ خطأ أثناء حذف ريبوست:", err.message);
      continue;
    }
  }

  console.log("✅ تم حذف", deleted, "ريبوست");
  return deleted;
};

// ✅ عداد الريبوستات
app.post("/count", async (req, res) => {
  console.log("📩 /count endpoint hit");
  const { sessionid } = req.body;
  if (!sessionid) {
    console.warn("🚫 لا يوجد sessionid في الطلب");
    return res.status(400).send({ error: "Missing sessionid" });
  }

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await loginWithSession(page, sessionid);
    const count = await getRepostsCount(page);
    await browser.close();
    res.send({ count });
  } catch (err) {
    console.error("❌ خطأ في /count:", err.message);
    await browser.close();
    res.status(500).send({ error: err.message || "Unknown error while counting." });
  }
});

// ✅ حذف الريبوستات
app.post("/clean", async (req, res) => {
  console.log("📩 /clean endpoint hit");
  const { sessionid } = req.body;
  if (!sessionid) {
    console.warn("🚫 لا يوجد sessionid في الطلب");
    return res.status(400).send({ error: "Missing sessionid" });
  }

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await loginWithSession(page, sessionid);
    const deleted = await deleteReposts(page);
    await browser.close();
    res.send({ success: true, deleted });
  } catch (err) {
    console.error("❌ خطأ في /clean:", err.message);
    await browser.close();
    res.status(500).send({ error: err.message || "Unknown error while cleaning." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
