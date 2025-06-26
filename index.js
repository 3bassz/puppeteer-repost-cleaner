const express = require("express");
const puppeteer = require("puppeteer-core");
const path = require("path");

const app = express();
app.use(express.json());

app.post("/clean", async (req, res) => {
  const { sessionid } = req.body;
  if (!sessionid) return res.status(400).send({ error: "Missing sessionid" });

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/google-chrome", // المسار الشائع في Render
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setCookie({
      name: "sessionid",
      value: sessionid,
      domain: ".tiktok.com",
      path: "/",
      httpOnly: true,
      secure: true,
    });

    await page.goto("https://www.tiktok.com/foryou", {
      waitUntil: "networkidle2",
    });

    let deleted = 0;
    // TODO: تعديل كود الحذف حسب التصميم
    await browser.close();
    res.send({ success: true, deleted });
  } catch (err) {
    await browser.close();
    res.status(500).send({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
