import "./env.js";
import app, { lanUrls } from "./app.js";

const port = Number(process.env.PORT || 8787);
app.listen(port, "0.0.0.0", () => {
  console.log(`charAIds API listening on http://0.0.0.0:${port}`);
  console.log(`Gemini: ${process.env.GEMINI_API_KEY ? "enabled" : "DISABLED (set GEMINI_API_KEY in .env.local)"}`);
  const urls = lanUrls();
  if (urls.length) console.log(`Second Mac opens: ${urls.join("  or  ")}`);
});
