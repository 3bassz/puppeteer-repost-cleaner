const express = require("express");
const puppeteer = require("puppeteer-core");

const app = express();
app.use(express.json());

const launchBrowser = () => {
  return puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
};

const getUsername = async (page) => {
  try {
    await page.goto("https://www.tiktok.com/foryou", { waitUntil: "networkidle2" });

    const username = await page.evaluate(() => {
      const el = document.querySelector('a[href^="/@"]');
      if (!el) return null;
      return el.getAttribute("href").split("/@")[1];
    });

    return username;
  } catch {
    return null;
  }
};

const goToRepostsTab = async (page, username) => {
  const url = `https://www.tiktok.com/@${username}/reposts`;
  await page.goto(url, { waitUntil: "networkidle2" });
};

const countReposts = async (page) => {
  return await page.evaluate(() => {
    return document.querySelectorAll('div[data-e2e="user-post-item"]').length;
  });
};

app.post("/count", async (req, res) => {
  const { sessionid } = req.body;
  if (!sessionid) return res.status(400).send({ error: "Missing sessionid" });

  const browser = await launchBrowser();
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

    const username = await getUsername(page);
    if (!username) {
      await browser.close();
      return res.status(400).send({ error: "Unable to extract username" });
    }

    await goToRepostsTab(page, username);
    const reposts = await countReposts(page);

    await browser.close();
    res.send({ success: true, reposts });
  } catch (err) {
    await browser.close();
    res.status(500).send({ error: err.message });
  }
});

app.post("/clean", async (req, res) => {
  const { sessionid } = req.body;
  if (!sessionid) return res.status(400).send({ error: "Missing sessionid" });

  const browser = await launchBrowser();
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

    const username = await getUsername(page);
    if (!username) {
      await browser.close();
      return res.status(400).send({ error: "Unable to extract username" });
    }

    await goToRepostsTab(page, username);

    let deleted = 0;
    let found = true;

    while (found) {
      found = await page.evaluate(async () => {
        const posts = document.querySelectorAll('div[data-e2e="user-post-item"]');
        if (posts.length === 0) return false;

        const firstPost = posts[0];
        firstPost.scrollIntoView();
        firstPost.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        const menuButton = document.querySelector('[data-e2e="more-button"]');
        if (!menuButton) return false;
        menuButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const deleteButton = Array.from(document.querySelectorAll("div"))
          .find(el => el.innerText === "Delete");

        if (!deleteButton) return false;
        deleteButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const confirmButton = Array.from(document.querySelectorAll("button"))
          .find(el => el.innerText.toLowerCase().includes("delete"));

        if (confirmButton) {
          confirmButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          return true;
        }

        return false;
      });

      if (found) deleted++;
      await page.goto(`https://www.tiktok.com/@${username}/reposts`, { waitUntil: "networkidle2" });
    }

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
