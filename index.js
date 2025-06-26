const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

// 🧠 تشغيل المتصفح
const launchBrowser = async () => {
  return await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
};

// 🔐 تسجيل الدخول بالـ sessionid
const loginWithSession = async (page, sessionid) => {
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
  await page.goto("https://www.tiktok.com/favorites/reposts", { waitUntil: "networkidle2" });
  await page.waitForSelector("div[data-e2e='user-post-item-list']", { timeout: 10000 });
  const count = await page.$$eval("div[data-e2e='user-post-item-list'] > div", divs => divs.length);
  return count;
};

// 🗑️ حذف الريبوستات
const deleteReposts = async (page) => {
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
          await page.waitForTimeout(1000); // تأخير بسيط بين كل حذف
          deleted++;
        }
      }
    } catch (err) {
      console.warn("خطأ أثناء حذف ريبوست:", err.message);
      continue;
    }
  }

  return deleted;
};

// ✅ عداد الريبوستات
app.post("/count", async (req, res) => {
  const { sessionid } = req.body;
  if (!sessionid) return res.status(400).send({ error: "Missing sessionid" });

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await loginWithSession(page, sessionid);
    const count = await getRepostsCount(page);
    await browser.close();
    res.send({ count });
  } catch (err) {
    await browser.close();
    res.status(500).send({ error: err.message || "Unknown error while counting." });
  }
});

// ✅ حذف الريبوستات
app.post("/clean", async (req, res) => {
  const { sessionid } = req.body;
  if (!sessionid) return res.status(400).send({ error: "Missing sessionid" });

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await loginWithSession(page, sessionid);
    const deleted = await deleteReposts(page);
    await browser.close();
    res.send({ success: true, deleted });
  } catch (err) {
    await browser.close();
    res.status(500).send({ error: err.message || "Unknown error while cleaning." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
